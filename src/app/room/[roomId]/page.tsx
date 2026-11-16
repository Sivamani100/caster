'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'
import { useCineRoomStore } from '@/lib/store'
import VideoPlayer from '@/components/VideoPlayer'
import ChatPanel from '@/components/ChatPanel'
import ViewerTiles from '@/components/ViewerTiles'
import JoinModal from '@/components/JoinModal'
import ReactionOverlay from '@/components/ReactionOverlay'
import { Users, MessageSquare, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function RoomPage() {
  const params = useParams()
  const roomId = params.roomId as string

  const [joined, setJoined] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'viewers'>('chat')

  const {
    setMyId, setMyName, setMyColor,
    addUser, removeUser, setUsers, updateUserVideo,
    addReaction,
    users,
  } = useCineRoomStore()

  const handleJoin = useCallback((name: string) => {
    const socket = getSocket()

    socket.connect()

    socket.on('connect', () => {
      setMyId(socket.id ?? '')
      socket.emit('join-room', { roomId, name })
      setMyName(name)
    })

    socket.on('room-users', (existingUsers) => {
      setUsers(existingUsers)
    })

    socket.on('user-joined', (user) => {
      addUser(user)
    })

    socket.on('user-left', ({ userId }) => {
      removeUser(userId)
    })

    socket.on('user-video-toggle', ({ userId, hasVideo }) => {
      updateUserVideo(userId, hasVideo)
    })

    setJoined(true)
  }, [roomId, setMyId, setMyName, setUsers, addUser, removeUser, updateUserVideo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const socket = getSocket()
      socket.off('connect')
      socket.off('room-users')
      socket.off('user-joined')
      socket.off('user-left')
      socket.off('user-video-toggle')
      socket.disconnect()
    }
  }, [])

  const totalWatchers = users.length + (joined ? 1 : 0)

  return (
    <>
      {/* Join modal */}
      {!joined && <JoinModal onJoin={handleJoin} roomId={roomId} />}

      {/* Floating reactions */}
      <ReactionOverlay />

      {/* Main layout */}
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        {/* Top nav */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30] bg-[#13131f]">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">🎬</span>
              <span className="font-black text-white text-lg hidden sm:inline">
                Cine<span className="text-[#e94560]">Room</span>
              </span>
            </Link>
            <div className="h-5 w-px bg-[#1e1e30]" />
            <span className="text-gray-400 text-sm font-mono">#{roomId}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewer count */}
            <div className="flex items-center gap-1.5 bg-[#8b5cf6]/10 text-[#8b5cf6] px-3 py-1.5 rounded-full text-sm">
              <Users className="w-4 h-4" />
              <span className="font-bold">{totalWatchers}</span>
              <span className="hidden sm:inline text-xs">watching</span>
            </div>

            {/* LIVE indicator */}
            <div className="flex items-center gap-1.5 bg-[#e94560]/10 text-[#e94560] px-3 py-1.5 rounded-full text-sm font-bold">
              <span className="w-2 h-2 rounded-full bg-[#e94560] animate-pulse" />
              LIVE
            </div>

            {/* Leave */}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </Link>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          {/* Left: Video player */}
          <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
            <VideoPlayer title={`Room: ${roomId}`} />

            {/* Movie info bar */}
            <div className="bg-[#13131f] rounded-xl border border-[#1e1e30] px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">🎬 Now Streaming</h2>
                <p className="text-gray-400 text-sm">Big Buck Bunny — Live Screening</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#e94560] animate-pulse" />
                <span className="text-[#e94560] text-sm font-bold">LIVE</span>
              </div>
            </div>
          </div>

          {/* Right: Chat + Viewers sidebar */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-[#1e1e30] bg-[#0d0d1a]">
            {/* Tab switcher */}
            <div className="flex border-b border-[#1e1e30]">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'text-[#e94560] border-b-2 border-[#e94560] bg-[#13131f]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('viewers')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'viewers'
                    ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6] bg-[#13131f]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Users className="w-4 h-4" />
                Viewers
                {totalWatchers > 0 && (
                  <span className="bg-[#8b5cf6] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {totalWatchers}
                  </span>
                )}
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden p-3">
              {activeTab === 'chat' ? (
                <div className="h-full" style={{ minHeight: '400px' }}>
                  <ChatPanel roomId={roomId} />
                </div>
              ) : (
                <ViewerTiles roomId={roomId} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
