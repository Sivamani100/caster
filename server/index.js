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

// roomId -> Map<socketId, { id, name, color, joinedAt }>
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

const COLORS = [
  '#e94560', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ec4899', '#3b82f6', '#84cc16',
];

function pickColor(roomId) {
  const room = getRoom(roomId);
  const used = new Set([...room.values()].map(v => v.color));
  return COLORS.find(c => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);
  let currentRoom = null;
  let currentUser = null;

  // --- JOIN ROOM ---
  socket.on('join-room', ({ roomId, name }) => {
    currentRoom = roomId;
    currentUser = {
      id: socket.id,
      name: name || `Viewer ${socket.id.slice(0, 4)}`,
      color: pickColor(roomId),
      joinedAt: Date.now(),
      hasVideo: false,
    };

    socket.join(roomId);
    getRoom(roomId).set(socket.id, currentUser);

    // Tell this user who else is here
    const others = [...getRoom(roomId).values()].filter(u => u.id !== socket.id);
    socket.emit('room-users', others);

    // Tell everyone else this user joined
    socket.to(roomId).emit('user-joined', currentUser);

    console.log(`[Room:${roomId}] ${currentUser.name} joined (${getRoom(roomId).size} users)`);
  });

  // --- CHAT MESSAGE ---
  socket.on('chat-message', ({ roomId, message }) => {
    if (!currentRoom || !currentUser) return;
    const payload = {
      id: `${Date.now()}-${socket.id}`,
      userId: socket.id,
      name: currentUser.name,
      color: currentUser.color,
      message,
      timestamp: Date.now(),
    };
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
    });
  });

  // --- WEBRTC SIGNALING ---
  // Offer: sender -> specific peer
  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', {
      fromId: socket.id,
      fromUser: currentUser,
      offer,
    });
  });

  // Answer: receiver -> back to sender
  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', {
      fromId: socket.id,
      answer,
    });
  });

  // ICE candidate relay
  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', {
      fromId: socket.id,
      candidate,
    });
  });

  // Video toggle notification
  socket.on('video-toggle', ({ roomId, hasVideo }) => {
    if (!currentRoom || !currentUser) return;
    currentUser.hasVideo = hasVideo;
    getRoom(roomId)?.set(socket.id, currentUser);
    socket.to(roomId).emit('user-video-toggle', { userId: socket.id, hasVideo });
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    if (currentRoom && currentUser) {
      getRoom(currentRoom)?.delete(socket.id);
      io.to(currentRoom).emit('user-left', { userId: socket.id });
      if (getRoom(currentRoom)?.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎬 CineRoom Socket server running on port ${PORT}`);
});
