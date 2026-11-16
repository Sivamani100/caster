'use client'

import { useEffect, useRef } from 'react'
import { Mic, MicOff, VideoOff } from 'lucide-react'
import { User } from '@/lib/store'

interface ViewerVideoProps {
  user: User
  stream?: MediaStream
  isLocal?: boolean
}

export default function ViewerVideo({ user, stream, isLocal = false }: ViewerVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const hasStream = !!stream

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-[#1a1a2e] border border-[#1e1e30] group"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Video feed */}
      {hasStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar placeholder when no camera */
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold border-2"
            style={{
              backgroundColor: user.color + '33',
              color: user.color,
              borderColor: user.color,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-gray-400 text-xs">{isLocal ? 'You' : user.name}</span>
          <VideoOff className="w-4 h-4 text-gray-600" />
        </div>
      )}

      {/* Name tag overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-medium truncate"
            style={{ color: user.color }}
          >
            {isLocal ? '🎤 You' : user.name}
          </span>
          <div className="flex items-center gap-1">
            {hasStream
              ? <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              : <MicOff className="w-3 h-3 text-gray-500" />
            }
          </div>
        </div>
      </div>

      {/* Speaking indicator ring */}
      {hasStream && (
        <div
          className="absolute inset-0 rounded-xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ borderColor: user.color }}
        />
      )}

      {/* LOCAL badge */}
      {isLocal && (
        <div className="absolute top-2 right-2 bg-[#e94560] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
          YOU
        </div>
      )}
    </div>
  )
}
