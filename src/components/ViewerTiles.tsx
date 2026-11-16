'use client'

import { useState } from 'react'
import { Camera, CameraOff, Users } from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useWebRTC } from '@/hooks/useWebRTC'
import ViewerVideo from './ViewerVideo'

interface ViewerTilesProps {
  roomId: string
}

export default function ViewerTiles({ roomId }: ViewerTilesProps) {
  const { users, streams, localStream, hasVideo, myId, myName, myColor } = useCineRoomStore()
  const { startCamera, stopCamera } = useWebRTC(roomId)
  const [cameraLoading, setCameraLoading] = useState(false)

  const handleCameraToggle = async () => {
    if (hasVideo) {
      stopCamera()
    } else {
      setCameraLoading(true)
      await startCamera()
      setCameraLoading(false)
    }
  }

  // Build the list of all tiles: local user + remote users
  const myUser = { id: myId, name: myName, color: myColor, hasVideo }
  const allTiles = [
    { user: myUser, stream: localStream ?? undefined, isLocal: true },
    ...users.map((u) => ({ user: u, stream: streams[u.id], isLocal: false })),
  ]

  const totalWatchers = users.length + 1 // +1 for self

  return (
    <div className="bg-[#13131f] rounded-xl border border-[#1e1e30] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#8b5cf6]" />
          <span className="text-white font-semibold text-sm">Watching Now</span>
          <span className="bg-[#8b5cf6]/20 text-[#8b5cf6] text-xs px-2 py-0.5 rounded-full font-bold">
            {totalWatchers}
          </span>
        </div>
        {/* Camera toggle */}
        <button
          onClick={handleCameraToggle}
          disabled={cameraLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
            hasVideo
              ? 'bg-[#e94560]/20 text-[#e94560] hover:bg-[#e94560]/30'
              : 'bg-[#1e1e30] text-gray-400 hover:text-white hover:bg-[#2a2a40]'
          }`}
        >
          {cameraLoading
            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : hasVideo
              ? <CameraOff className="w-3.5 h-3.5" />
              : <Camera className="w-3.5 h-3.5" />
          }
          {hasVideo ? 'Turn Off' : 'Go Live'}
        </button>
      </div>

      {/* Tiles grid */}
      <div className="p-3 overflow-y-auto max-h-[320px]">
        <div
          className={`grid gap-2 ${
            allTiles.length === 1
              ? 'grid-cols-1'
              : allTiles.length <= 4
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}
        >
          {allTiles.map(({ user, stream, isLocal }) => (
            <ViewerVideo
              key={user.id}
              user={user}
              stream={stream}
              isLocal={isLocal}
            />
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 text-center text-xs text-gray-600 border-t border-[#1e1e30]">
        {hasVideo ? '🟢 Your camera is on — others can see you' : 'Click "Go Live" to show yourself'}
      </div>
    </div>
  )
}
