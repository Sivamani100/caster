import { create } from 'zustand'

export interface UserPresence {
  id: string
  name: string
  hasVideo: boolean
  hasAudio: boolean
  isHost: boolean
  joinedAt: number
}

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string
  name: string
  color: string
  message: string
  is_system: boolean
  created_at: string
}

export interface MovieInfo {
  title: string
  url: string
  genre?: string
  duration?: number
}

export const CURATED_MOVIES: MovieInfo[] = [
  {
    title: 'Big Buck Bunny (Animation 4K)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    genre: 'Animation',
    duration: 596,
  },
  {
    title: 'Tears of Steel (Sci-Fi VFX)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    genre: 'Sci-Fi',
    duration: 734,
  },
  {
    title: 'Sintel (Fantasy Saga)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    genre: 'Fantasy',
    duration: 888,
  },
  {
    title: 'Elephants Dream (Classic)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    genre: 'Surreal',
    duration: 653,
  },
]

interface CineRoomStore {
  // Self
  myId: string
  myName: string
  isHost: boolean
  setMyId: (id: string) => void
  setMyName: (name: string) => void
  setIsHost: (isHost: boolean) => void

  // Room Host Info
  hostId: string
  hostName: string
  setHostInfo: (hostId: string, hostName: string) => void

  // Active Movie & Playback State
  currentMovie: MovieInfo
  setMovie: (movie: MovieInfo) => void
  isPlaying: boolean
  setIsPlaying: (isPlaying: boolean) => void
  playbackTime: number
  setPlaybackTime: (t: number) => void

  // Presence / Viewers (Zoom-Style)
  presenceUsers: UserPresence[]
  setPresenceUsers: (users: UserPresence[]) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  setMessages: (msgs: ChatMessage[]) => void

  // Floating Reactions
  reactions: { id: string; emoji: string; name: string }[]
  addReaction: (r: { emoji: string; name: string }) => void
  removeReaction: (id: string) => void

  // Layout & Fullscreen
  viewMode: 'cinema' | 'grid'
  setViewMode: (mode: 'cinema' | 'grid') => void
  showFullscreenChat: boolean
  setShowFullscreenChat: (show: boolean) => void

  // AV & WebRTC Streams
  streams: Record<string, MediaStream>
  setStream: (userId: string, stream: MediaStream) => void
  removeStream: (userId: string) => void
  localStream: MediaStream | null
  setLocalStream: (s: MediaStream | null) => void
  hasVideo: boolean
  setHasVideo: (v: boolean) => void
  hasAudio: boolean
  setHasAudio: (a: boolean) => void
  webrtcStatus: 'disconnected' | 'connecting' | 'connected' | 'failed'
  setWebRTCStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'failed') => void
  activePeersCount: number
  setActivePeersCount: (count: number) => void
}

export const useCineRoomStore = create<CineRoomStore>((set) => ({
  myId: '',
  myName: '',
  isHost: false,
  setMyId: (id) => set({ myId: id }),
  setMyName: (name) => set({ myName: name }),
  setIsHost: (isHost) => set({ isHost }),

  hostId: '',
  hostName: 'Host',
  setHostInfo: (hostId, hostName) => set({ hostId, hostName }),

  currentMovie: CURATED_MOVIES[0],
  setMovie: (movie) => set({ currentMovie: movie }),
  isPlaying: true,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  playbackTime: 0,
  setPlaybackTime: (playbackTime) => set({ playbackTime }),

  presenceUsers: [],
  setPresenceUsers: (presenceUsers) => set({ presenceUsers }),

  messages: [],
  addMessage: (msg) => set((s) => ({
    messages: [...s.messages.filter(m => m.id !== msg.id).slice(-150), msg]
  })),
  setMessages: (messages) => set({ messages }),

  reactions: [],
  addReaction: (r) => {
    const id = `${Date.now()}-${Math.random()}`
    set((s) => ({ reactions: [...s.reactions, { ...r, id }] }))
    setTimeout(() => {
      set((s) => ({ reactions: s.reactions.filter(x => x.id !== id) }))
    }, 3500)
  },
  removeReaction: (id) => set((s) => ({ reactions: s.reactions.filter(r => r.id !== id) })),

  viewMode: 'cinema',
  setViewMode: (viewMode) => set({ viewMode }),
  showFullscreenChat: true,
  setShowFullscreenChat: (showFullscreenChat) => set({ showFullscreenChat }),

  streams: {},
  setStream: (userId, stream) => set((s) => ({ streams: { ...s.streams, [userId]: stream } })),
  removeStream: (userId) => set((s) => {
    const { [userId]: _, ...rest } = s.streams
    return { streams: rest }
  }),

  localStream: null,
  setLocalStream: (localStream) => set({ localStream }),
  hasVideo: false,
  setHasVideo: (hasVideo) => set({ hasVideo }),
  hasAudio: true,
  setHasAudio: (hasAudio) => set({ hasAudio }),
  webrtcStatus: 'disconnected',
  setWebRTCStatus: (webrtcStatus) => set({ webrtcStatus }),
  activePeersCount: 0,
  setActivePeersCount: (activePeersCount) => set({ activePeersCount }),
}))
