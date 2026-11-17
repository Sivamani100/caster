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
  const [joined, setJoined] = useState(() => {
    if (typeof window !== 'undefined') {
      const alreadyJoined = sessionStorage.getItem(`cineroom_${roomId}_joined`) === 'true'
      const hasSessionName = !!sessionStorage.getItem(`cineroom_${roomId}_name`)
      return alreadyJoined || hasSessionName
    }
    return false
  })
  const [mobileTab, setMobileTab] = useState<'split' | 'cinema' | 'chat'>('split')

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
      const storedName =
        sessionStorage.getItem(`cineroom_${roomId}_name`) ||
        localStorage.getItem('cineroom_user_name') ||
        (isHostQuery ? 'Host' : '')

      const isHostStored = isHostQuery || sessionStorage.getItem(`cineroom_${roomId}_isHost`) === 'true'

      if (isHostQuery) {
        sessionStorage.setItem(`cineroom_${roomId}_isHost`, 'true')
      }

      if (storedName) {
        setMyName(storedName)
        sessionStorage.setItem(`cineroom_${roomId}_name`, storedName)
      }
      setIsHost(isHostStored)

      let uid = sessionStorage.getItem(`cineroom_${roomId}_uid`)
      if (!uid) {
        uid = `user-${Math.floor(Math.random() * 89999 + 10000)}`
        sessionStorage.setItem(`cineroom_${roomId}_uid`, uid)
      }
      setMyId(uid)

      // If user is already joined (e.g. from homepage or page refresh), start media automatically
      if (sessionStorage.getItem(`cineroom_${roomId}_joined`) === 'true' || storedName) {
        sessionStorage.setItem(`cineroom_${roomId}_joined`, 'true')
        setJoined(true)
        startMedia(false, true).catch(() => {})
      }
    }
  }, [roomId, setMyName, setIsHost, setMyId, startMedia])

  const handleJoin = useCallback(
    async (name: string, cameraOn: boolean, micOn: boolean) => {
      setMyName(name)
      if (typeof window !== 'undefined') {
        localStorage.setItem('cineroom_user_name', name)
        sessionStorage.setItem(`cineroom_${roomId}_name`, name)
        sessionStorage.setItem(`cineroom_${roomId}_joined`, 'true')
      }
      await startMedia(cameraOn, micOn)
      setJoined(true)
    },
    [roomId, setMyName, startMedia]
  )

  return (
    <>
      {/* Join Modal */}
      {!joined && <JoinModal onJoin={handleJoin} roomId={roomId} />}

      {/* Floating Reaction Overlay */}
      <ReactionOverlay />

      <div className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-screen bg-[#000000] text-white flex flex-col font-sans selection:bg-[#0071e3] selection:text-white overflow-hidden p-1.5 sm:p-3 relative">
        {/* Ambient lighting accents */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[25%] w-[600px] h-[500px] bg-[#0071e3]/[0.08] rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[450px] bg-white/[0.03] rounded-full blur-[130px]" />
        </div>

        {/* Mobile View Selector Bar (<md screens only) */}
        <div className="flex md:hidden pb-1.5 px-0.5 justify-between items-center z-20 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3]" />
            <span className="text-xs font-semibold tracking-tight text-white">Casterr</span>
            <span className="text-[10px] text-zinc-400 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
              #{roomId}
            </span>
          </div>

          <div className="flex items-center p-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl">
            <button
              onClick={() => setMobileTab('split')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                mobileTab === 'split' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Watch & Chat
            </button>
            <button
              onClick={() => setMobileTab('cinema')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                mobileTab === 'cinema' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cinema
            </button>
            <button
              onClick={() => setMobileTab('chat')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                mobileTab === 'chat' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Chat
            </button>
          </div>
        </div>

        {/* Full-Bleed 100dvh Cinema Room Container */}
        <main className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 sm:gap-3 overflow-hidden h-full max-w-[1920px] mx-auto w-full relative">
          {/* Cinema Stage Column */}
          <div
            className={`flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2.5 h-full overflow-hidden relative ${
              mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Edge-to-Edge Video Screen */}
            <div
              className={`relative flex items-center justify-center transition-all ${
                mobileTab === 'split'
                  ? 'w-full flex-shrink-0'
                  : 'flex-1 min-h-0'
              }`}
            >
              <VideoPlayer roomId={roomId} />
            </div>

            {/* Screening Group (Webcam tiles) */}
            <div className="flex-shrink-0">
              <ViewerTiles roomId={roomId} variant="filmstrip" />
            </div>

            {/* In mobile 'split' mode: Chat panel embedded directly below video & cams */}
            {mobileTab === 'split' && (
              <div className="flex-1 min-h-0 flex md:hidden flex-col">
                <ChatPanel roomId={roomId} />
              </div>
            )}
          </div>

          {/* Right Sidebar: Room Chat Panel (Shown on desktop always, or when mobileTab === 'chat') */}
          <div
            className={`w-full md:w-1/4 min-w-[280px] max-w-[420px] h-full flex-shrink-0 flex flex-col ${
              mobileTab === 'chat' ? 'flex md:flex' : 'hidden md:flex'
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
