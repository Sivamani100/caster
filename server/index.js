const http = require('http');
const { Server } = require('socket.io');

const PORT = 3001;

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// roomId (4-digit code) -> Map<socketId, { id, name, color, joinedAt, hasVideo, hasAudio, isHost }>
const rooms = new Map();

// roomId -> { code, hostId, hostName, movie, isPlaying, currentTime, lastUpdated }
const roomStates = new Map();

// roomId -> ChatMessage[]
const roomChatHistories = new Map();

function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function getChatHistory(roomId) {
  if (!roomChatHistories.has(roomId)) roomChatHistories.set(roomId, []);
  return roomChatHistories.get(roomId);
}

const COLORS = [
  '#ff2a5f', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ec4899', '#3b82f6', '#a855f7',
];

function pickColor(roomId) {
  const users = getRoomUsers(roomId);
  const used = new Set([...users.values()].map(v => v.color));
  return COLORS.find(c => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
}

const DEFAULT_MOVIE = {
  title: 'Big Buck Bunny (Animation 4K)',
  url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  genre: 'Animation / Comedy',
  duration: 596,
};

function getOrCreateRoomState(roomId, initialHostId, initialHostName, initialMovie) {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, {
      code: roomId,
      hostId: initialHostId || null,
      hostName: initialHostName || 'Host',
      movie: initialMovie || DEFAULT_MOVIE,
      isPlaying: true,
      currentTime: 0,
      lastUpdated: Date.now(),
    });
  }
  return roomStates.get(roomId);
}

// Compute accurate playback time right now
function getCurrentPlaybackTime(state) {
  if (!state.isPlaying) return state.currentTime;
  const elapsed = (Date.now() - state.lastUpdated) / 1000;
  const dur = state.movie?.duration || 596;
  return dur > 0 ? (state.currentTime + elapsed) % dur : (state.currentTime + elapsed);
}

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);
  let currentRoom = null;
  let currentUser = null;

  // --- JOIN / CREATE ROOM ---
  socket.on('join-room', ({ roomId, name, isHost = false, movie = null, hasVideo = false, hasAudio = true }) => {
    currentRoom = roomId;
    const users = getRoomUsers(roomId);

    // Determine host status: if isHost flag is passed or room has no host
    let state = roomStates.get(roomId);
    if (!state) {
      state = getOrCreateRoomState(roomId, socket.id, name, movie);
    }

    const assignedHost = !state.hostId || state.hostId === socket.id || isHost;
    if (assignedHost) {
      state.hostId = socket.id;
      state.hostName = name || 'Host';
      if (movie) state.movie = movie;
    }

    currentUser = {
      id: socket.id,
      name: name || (assignedHost ? 'Host' : `Viewer ${socket.id.slice(0, 4)}`),
      color: pickColor(roomId),
      joinedAt: Date.now(),
      hasVideo,
      hasAudio,
      isHost: assignedHost,
    };

    socket.join(roomId);
    users.set(socket.id, currentUser);

    // 1. Send other users in room
    const others = [...users.values()].filter(u => u.id !== socket.id);
    socket.emit('room-users', others);

    // 2. Send room state & host info to joining client
    const accurateTime = getCurrentPlaybackTime(state);
    socket.emit('room-synced', {
      code: state.code,
      hostId: state.hostId,
      hostName: state.hostName,
      movie: state.movie,
      isPlaying: state.isPlaying,
      currentTime: accurateTime,
      serverTime: Date.now(),
      isHost: assignedHost,
    });

    // 3. Send chat history
    socket.emit('chat-history', getChatHistory(roomId));

    // 4. Notify existing users
    socket.to(roomId).emit('user-joined', currentUser);

    const joinNotice = {
      id: `sys-${Date.now()}-${Math.random()}`,
      userId: 'system',
      name: 'System',
      color: assignedHost ? '#ff2a5f' : '#10b981',
      message: assignedHost
        ? `👑 ${currentUser.name} (Host) created/joined room #${roomId}`
        : `👋 ${currentUser.name} joined room #${roomId}`,
      timestamp: Date.now(),
      isSystem: true,
    };
    getChatHistory(roomId).push(joinNotice);
    io.to(roomId).emit('chat-message', joinNotice);

    console.log(`[Room:${roomId}] ${currentUser.name} joined. Host: ${state.hostName}. Users: ${users.size}`);
  });

  // --- HOST PLAYBACK CONTROL (Only Host can Pause/Resume/Seek) ---
  socket.on('host-playback-control', ({ roomId, isPlaying, currentTime }) => {
    const state = roomStates.get(roomId);
    if (!state) return;

    // Verify sender is the host
    if (state.hostId !== socket.id) {
      socket.emit('control-denied', { message: 'Only the room host can pause or resume the stream.' });
      return;
    }

    state.isPlaying = isPlaying;
    state.currentTime = currentTime;
    state.lastUpdated = Date.now();

    // Broadcast playback state to all clients in the room
    io.to(roomId).emit('playback-synced', {
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      serverTime: Date.now(),
      hostId: state.hostId,
      hostName: state.hostName,
    });

    console.log(`[Room:${roomId}] Host ${state.hostName} set playback: isPlaying=${isPlaying}, time=${currentTime.toFixed(1)}s`);
  });

  // --- HOST MOVIE SWITCH (Only Host can change movie) ---
  socket.on('host-change-movie', ({ roomId, movie }) => {
    const state = roomStates.get(roomId);
    if (!state) return;

    if (state.hostId !== socket.id) {
      socket.emit('control-denied', { message: 'Only the room host can change the movie.' });
      return;
    }

    state.movie = movie;
    state.currentTime = 0;
    state.isPlaying = true;
    state.lastUpdated = Date.now();

    io.to(roomId).emit('movie-synced', {
      movie: state.movie,
      currentTime: 0,
      isPlaying: true,
      serverTime: Date.now(),
      hostName: state.hostName,
    });

    const sysMsg = {
      id: `sys-${Date.now()}-${Math.random()}`,
      userId: 'system',
      name: 'System',
      color: '#8b5cf6',
      message: `🎬 Host ${state.hostName} switched screening to "${movie.title}"`,
      timestamp: Date.now(),
      isSystem: true,
    };
    getChatHistory(roomId).push(sysMsg);
    io.to(roomId).emit('chat-message', sysMsg);
  });

  // --- REQUEST SYNC ---
  socket.on('request-sync', ({ roomId }) => {
    const state = roomStates.get(roomId);
    if (!state) return;

    const accurateTime = getCurrentPlaybackTime(state);
    socket.emit('playback-synced', {
      isPlaying: state.isPlaying,
      currentTime: accurateTime,
      serverTime: Date.now(),
      hostId: state.hostId,
      hostName: state.hostName,
    });
  });

  // --- CHAT MESSAGE ---
  socket.on('chat-message', ({ roomId, message }) => {
    if (!currentRoom || !currentUser) return;
    const payload = {
      id: `${Date.now()}-${socket.id}`,
      userId: socket.id,
      name: currentUser.name,
      color: currentUser.color,
      isHost: currentUser.isHost,
      message,
      timestamp: Date.now(),
      isSystem: false,
    };

    const history = getChatHistory(roomId);
    history.push(payload);
    if (history.length > 100) history.shift();

    io.to(roomId).emit('chat-message', payload);
  });

  // --- REACTION ---
  socket.on('reaction', ({ roomId, emoji }) => {
    if (!currentRoom || !currentUser) return;
    io.to(roomId).emit('reaction', {
      userId: socket.id,
      name: currentUser.name,
      color: currentUser.color,
      emoji,
      timestamp: Date.now(),
    });
  });

  // --- WEBRTC SIGNALING ---
  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', {
      fromId: socket.id,
      fromUser: currentUser,
      offer,
    });
  });

  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', {
      fromId: socket.id,
      answer,
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', {
      fromId: socket.id,
      candidate,
    });
  });

  socket.on('video-toggle', ({ roomId, hasVideo }) => {
    if (!currentRoom || !currentUser) return;
    currentUser.hasVideo = hasVideo;
    getRoomUsers(roomId)?.set(socket.id, currentUser);
    socket.to(roomId).emit('user-video-toggle', { userId: socket.id, hasVideo });
  });

  socket.on('audio-toggle', ({ roomId, hasAudio }) => {
    if (!currentRoom || !currentUser) return;
    currentUser.hasAudio = hasAudio;
    getRoomUsers(roomId)?.set(socket.id, currentUser);
    socket.to(roomId).emit('user-audio-toggle', { userId: socket.id, hasAudio });
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
    if (currentRoom && currentUser) {
      const users = getRoomUsers(currentRoom);
      users.delete(socket.id);

      io.to(currentRoom).emit('user-left', { userId: socket.id, name: currentUser.name });

      // If the disconnecting user was the host, reassign host to the next senior user!
      const state = roomStates.get(currentRoom);
      if (state && state.hostId === socket.id && users.size > 0) {
        const nextHost = users.values().next().value;
        if (nextHost) {
          nextHost.isHost = true;
          state.hostId = nextHost.id;
          state.hostName = nextHost.name;

          io.to(currentRoom).emit('host-reassigned', {
            hostId: nextHost.id,
            hostName: nextHost.name,
          });

          const hostNotice = {
            id: `sys-${Date.now()}-${Math.random()}`,
            userId: 'system',
            name: 'System',
            color: '#f59e0b',
            message: `👑 ${nextHost.name} is now the room host`,
            timestamp: Date.now(),
            isSystem: true,
          };
          getChatHistory(currentRoom).push(hostNotice);
          io.to(currentRoom).emit('chat-message', hostNotice);
        }
      }
    }
  });
});

// Periodic heartbeat sync tick every 3 seconds
setInterval(() => {
  for (const [roomId, state] of roomStates.entries()) {
    const accurateTime = getCurrentPlaybackTime(state);
    io.to(roomId).emit('playback-tick', {
      isPlaying: state.isPlaying,
      currentTime: accurateTime,
      serverTime: Date.now(),
      hostId: state.hostId,
      hostName: state.hostName,
    });
  }
}, 3000);

server.listen(PORT, () => {
  console.log(`🎬 CineRoom Host-Controlled Live Server running on port ${PORT}`);
});
