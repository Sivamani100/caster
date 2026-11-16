'use client'

import { useEffect, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface ViewerVideoProps {
  user: {
    id: string
    name: string
    hasVideo?: boolean
    hasAudio?: boolean
    isHost?: boolean
  }
  stream?: MediaStream
  isLocal?: boolean
}

export default function ViewerVideo({ user, stream, isLocal = false }: ViewerVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Attach video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, user.hasVideo])

  // Attach and play audio stream for remote participants
  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream
      audioRef.current.play().catch(() => {
        // Will play on user click
      })
    }
  }, [stream, isLocal])

  const hasStream = !!stream && user.hasVideo
  const isMuted = user.hasAudio === false

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-[#101014] border border-white/[0.08] shadow-md flex items-center justify-center select-none w-full h-full"
      style={{ aspectRatio: '16/10' }}
    >
      {/* Remote Audio Track (Plays even if video is off) */}
      {!isLocal && stream && (
        <audio ref={audioRef} autoPlay playsInline />
      )}

      {/* Video Stream */}
      {hasStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Minimalist Liquid Glass Avatar */
        <div className="w-full h-full flex flex-col items-center justify-center p-2 relative bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] text-white flex items-center justify-center text-xs font-semibold shadow-inner">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      )}

      {/* Floating HUD info */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/95 to-transparent flex items-center justify-between z-10">
        <div className="flex items-center gap-1 truncate max-w-[75%]">
          <span className="text-white text-[10px] font-medium truncate">
            {isLocal ? 'You' : user.name}
          </span>
          {user.isHost && (
            <span className="text-[8px] bg-[#0071e3]/20 text-[#0071e3] border border-[#0071e3]/30 px-1 py-0.2 rounded font-mono uppercase">
              Host
            </span>
          )}
        </div>

        {/* Mic Status */}
        <div className="p-0.5 rounded bg-black/60 text-zinc-400">
          {isMuted ? <MicOff className="w-2.5 h-2.5 text-zinc-500" /> : <Mic className="w-2.5 h-2.5 text-white" />}
        </div>
      </div>

      {/* YOU Tag */}
      {isLocal && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[8px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
          You
        </div>
      )}
    </div>
  )
}
