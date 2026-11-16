import { create } from 'zustand'

export interface User {
  id: string
  name: string
  color: string
  hasVideo: boolean
}

export interface ChatMessage {
  id: string
  userId: string
  name: string
  color: string
  message: string
  timestamp: number
}

export interface Reaction {
  userId: string
  name: string
  color: string
  emoji: string
  id?: string
}

interface CineRoomStore {
  // Self
  myId: string
  myName: string
  myColor: string
  setMyId: (id: string) => void
  setMyName: (name: string) => void
  setMyColor: (color: string) => void

  // Users in room
  users: User[]
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  setUsers: (users: User[]) => void
  updateUserVideo: (userId: string, hasVideo: boolean) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void

  // Reactions
  reactions: (Reaction & { id: string })[]
  addReaction: (reaction: Reaction) => void
  removeReaction: (id: string) => void

  // Video streams (WebRTC)
  streams: Record<string, MediaStream>
  setStream: (userId: string, stream: MediaStream) => void
  removeStream: (userId: string) => void

  // My local stream
  localStream: MediaStream | null
  setLocalStream: (stream: MediaStream | null) => void
  hasVideo: boolean
  setHasVideo: (v: boolean) => void
}

export const useCineRoomStore = create<CineRoomStore>((set) => ({
  myId: '',
  myName: '',
  myColor: '',
  setMyId: (id) => set({ myId: id }),
  setMyName: (name) => set({ myName: name }),
  setMyColor: (color) => set({ myColor: color }),

  users: [],
  addUser: (user) => set((s) => ({ users: [...s.users.filter(u => u.id !== user.id), user] })),
  removeUser: (userId) => set((s) => ({ users: s.users.filter(u => u.id !== userId) })),
  setUsers: (users) => set({ users }),
  updateUserVideo: (userId, hasVideo) =>
    set((s) => ({ users: s.users.map(u => u.id === userId ? { ...u, hasVideo } : u) })),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-200), msg] })),

  reactions: [],
  addReaction: (reaction) => {
    const id = `${Date.now()}-${Math.random()}`
    set((s) => ({ reactions: [...s.reactions, { ...reaction, id }] }))
    setTimeout(() => {
      set((s) => ({ reactions: s.reactions.filter(r => r.id !== id) }))
    }, 3000)
  },
  removeReaction: (id) => set((s) => ({ reactions: s.reactions.filter(r => r.id !== id) })),

  streams: {},
  setStream: (userId, stream) => set((s) => ({ streams: { ...s.streams, [userId]: stream } })),
  removeStream: (userId) => set((s) => {
    const { [userId]: _, ...rest } = s.streams
    return { streams: rest }
  }),

  localStream: null,
  setLocalStream: (stream) => set({ localStream: stream }),
  hasVideo: false,
  setHasVideo: (v) => set({ hasVideo: v }),
}))
