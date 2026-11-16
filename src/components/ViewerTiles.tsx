'use client'

import { useState } from 'react'
import { Camera, CameraOff, Mic, MicOff, Users } from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'
import ViewerVideo from './ViewerVideo'

interface ViewerTilesProps {
  roomId: string
  variant?: 'filmstrip' | 'sidebar'
}

export default function ViewerTiles({ roomId, variant = 'filmstrip' }: ViewerTilesProps) {
  const {
    presenceUsers,
    localStream,
    streams,
    hasVideo,
    hasAudio,
    myId,
    myName,
    isHost,
  } = useCineRoomStore()

  const { toggleMic, toggleCamera } = useSupabaseRoom()
  const [cameraLoading, setCameraLoading] = useState(false)

  const handleCameraClick = async () => {
    setCameraLoading(true)
    await toggleCamera()
    setCameraLoading(false)
  }

  // Combine local user + presence users from Supabase Cloud
  const myUser = { id: myId, name: myName || 'You', hasVideo, hasAudio, isHost }
  const remoteUsers = presenceUsers.filter((u) => u.id !== myId)
  const allTiles = [
    { user: myUser, stream: localStream ?? undefined, isLocal: true },
    ...remoteUsers.map((u) => ({ user: u, stream: streams[u.id], isLocal: false })),
  ]

  const totalWatchers = Math.max(1, presenceUsers.length || 1)

  return (
    <div className="liquid-glass rounded-2xl p-2.5 sm:p-3 border border-white/[0.08] flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-white font-medium text-xs tracking-tight">
            Screening Group ({totalWatchers})
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
        </div>

        {/* Quick AV Toggles (iOS Liquid Glass style) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMic}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              hasAudio
                ? 'btn-glass text-white'
                : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
            }`}
          >
            {hasAudio ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-zinc-500" />}
            <span>{hasAudio ? 'Mute' : 'Muted'}</span>
          </button>

          <button
            onClick={handleCameraClick}
            disabled={cameraLoading}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              hasVideo
                ? 'bg-white/20 text-white border border-white/20'
                : 'btn-action'
            }`}
          >
            {cameraLoading ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : hasVideo ? (
              <CameraOff className="w-3 h-3" />
            ) : (
              <Camera className="w-3 h-3" />
            )}
            <span>{hasVideo ? 'Stop Cam' : 'Go Live'}</span>
          </button>
        </div>
      </div>

      {/* Compact Filmstrip row */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 pt-0.5 scrollbar-thin">
        {allTiles.map(({ user, stream, isLocal }) => (
          <div key={user.id} className="w-28 sm:w-32 h-18 sm:h-20 flex-shrink-0">
            <ViewerVideo
              user={user}
              stream={stream}
              isLocal={isLocal}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
