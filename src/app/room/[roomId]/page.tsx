'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useCineRoomStore } from '@/lib/store'
import VideoPlayer from '@/components/VideoPlayer'
import ChatPanel from '@/components/ChatPanel'
import ViewerTiles from '@/components/ViewerTiles'
import JoinModal from '@/components/JoinModal'
import ReactionOverlay from '@/components/ReactionOverlay'
import { SupabaseRoomProvider, useSupabaseRoom } from '@/lib/useSupabaseRoom'

function RoomContent({ roomId }: { roomId: string }) {
  const [joined, setJoined] = useState(false)
  const [mobileTab, setMobileTab] = useState<'cinema' | 'chat'>('cinema')

  const {
    setMyId,
    setMyName,
    setIsHost,
  } = useCineRoomStore()

  const { startMedia } = useSupabaseRoom()

  // Initialize from sessionStorage or query param if user came from Create/Join flow or ?host=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const isHostQuery = urlParams.get('host') === 'true'
      const storedName = sessionStorage.getItem(`cineroom_${roomId}_name`)
      const isHostStored = isHostQuery || sessionStorage.getItem(`cineroom_${roomId}_isHost`) === 'true'

      if (isHostQuery) {
        sessionStorage.setItem(`cineroom_${roomId}_isHost`, 'true')
      }

      if (storedName) {
        setMyName(storedName)
      } else if (isHostQuery) {
        setMyName('Host')
        sessionStorage.setItem(`cineroom_${roomId}_name`, 'Host')
      }
      setIsHost(isHostStored)

      let uid = sessionStorage.getItem(`cineroom_${roomId}_uid`)
      if (!uid) {
        uid = `user-${Math.floor(Math.random() * 89999 + 10000)}`
        sessionStorage.setItem(`cineroom_${roomId}_uid`, uid)
      }
      setMyId(uid)
    }
  }, [roomId, setMyName, setIsHost, setMyId])

  const handleJoin = useCallback(
    async (name: string, cameraOn: boolean, micOn: boolean) => {
      setMyName(name)
      await startMedia(cameraOn, micOn)
      setJoined(true)
    },
    [setMyName, startMedia]
  )

  return (
    <>
      {/* iOS Liquid Glass Check / Join Modal */}
      {!joined && <JoinModal onJoin={handleJoin} roomId={roomId} />}

      {/* Floating Reaction Overlay */}
      <ReactionOverlay />

      <div className="h-screen w-screen bg-[#000000] text-white flex flex-col font-sans selection:bg-[#0071e3] selection:text-white overflow-hidden p-2 sm:p-3 relative">
        {/* Subtle visionOS / Antigravity 2.0 ambient light accents that shine through the frosted glass */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[25%] w-[600px] h-[500px] bg-[#0071e3]/[0.08] rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[450px] bg-white/[0.03] rounded-full blur-[130px]" />
        </div>
        {/* Mobile Tab Switcher (<md screens only) */}
        <div className="flex md:hidden pb-2 justify-center gap-2 z-20 flex-shrink-0">
          <button
            onClick={() => setMobileTab('cinema')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileTab === 'cinema' ? 'bg-white text-black' : 'btn-glass text-zinc-400'
            }`}
          >
            Cinema & Viewers
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileTab === 'chat' ? 'bg-white text-black' : 'btn-glass text-zinc-400'
            }`}
          >
            Room Chat
          </button>
        </div>

        {/* Full-Bleed 100vh Two-Column Cinema Room (Top Bar Completely Removed) */}
        <main className="flex-1 flex flex-col md:flex-row gap-2.5 sm:gap-3 overflow-hidden h-full max-w-[1920px] mx-auto w-full relative">
          {/* Cinema Stage Column */}
          <div
            className={`flex-1 min-w-0 flex flex-col gap-2.5 sm:gap-3 h-full overflow-hidden relative ${
              mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* 16:9 Edge-to-Edge Cinema Screen */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center">
              <VideoPlayer roomId={roomId} />
            </div>

            {/* Screening Group (Webcam tiles directly beneath video) */}
            <div className="flex-shrink-0">
              <ViewerTiles roomId={roomId} variant="filmstrip" />
            </div>
          </div>

          {/* Right Sidebar: Liquid Glassmorphic Room Chat Column (1/4 part of the screen) */}
          <div
            className={`w-full md:w-1/4 min-w-[280px] max-w-[420px] h-full flex-shrink-0 flex flex-col ${
              mobileTab === 'cinema' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <ChatPanel roomId={roomId} />
          </div>
        </main>
      </div>
    </>
  )
}

export default function RoomPage() {
  const params = useParams()
  const roomId = (params.roomId as string) || '4821'

  return (
    <SupabaseRoomProvider roomId={roomId}>
      <RoomContent roomId={roomId} />
    </SupabaseRoomProvider>
  )
}
