'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, CameraOff, Mic, MicOff, KeyRound, Dices, ArrowRight } from 'lucide-react'

interface JoinModalProps {
  onJoin: (name: string, cameraOn: boolean, micOn: boolean) => void
  roomId: string
}

const CINEMA_NAMES = [
  'CinemaBuff', 'FilmGeek', 'PopcornKing', 'NightWatcher',
  'SciFiLover', 'CinemaGuru', 'MoviePilot', 'StarGazer', 'ActionHero'
]

export default function JoinModal({ onJoin, roomId }: JoinModalProps) {
  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`cineroom_${roomId}_name`) || ''
    }
    return ''
  })
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleRandomName = () => {
    const randomPick = CINEMA_NAMES[Math.floor(Math.random() * CINEMA_NAMES.length)]
    setName(`${randomPick}${Math.floor(Math.random() * 90 + 10)}`)
  }

  const togglePreviewCamera = async () => {
    if (cameraOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setCameraOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraOn(true)
      } catch (err) {
        console.warn('Preview camera access failed:', err)
        setCameraOn(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const handleJoin = () => {
    const finalName = name.trim() || `Viewer${Math.floor(Math.random() * 8999 + 1000)}`
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    onJoin(finalName, cameraOn, micOn)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4">
      <div className="relative liquid-glass rounded-2xl p-5 sm:p-6 w-full max-w-sm space-y-4 text-left border border-white/[0.12] bg-[#0c0c0e]/95 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-400 font-mono mb-1">
            <KeyRound className="w-3 h-3 text-[#0071e3]" />
            <span>ROOM #{roomId}</span>
          </div>

          <h2 className="text-xl font-semibold text-white tracking-tight">
            Ready to Watch?
          </h2>
          <p className="text-[11px] text-zinc-400">
            Check your audio & video before entering
          </p>
        </div>

        {/* Camera / Avatar Preview (iOS Style) */}
        <div className="relative rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.08] aspect-video flex items-center justify-center group shadow-inner">
          {cameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5" suppressHydrationWarning>
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white flex items-center justify-center text-lg font-bold" suppressHydrationWarning>
                {name.trim() ? name.charAt(0).toUpperCase() : '🍿'}
              </div>
              <span className="text-[10px] text-zinc-500">Camera off</span>
            </div>
          )}

          {/* Quick toggle bar */}
          <div className="absolute bottom-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/[0.1]">
            <button
              onClick={togglePreviewCamera}
              className={`p-1 rounded-full transition-all ${
                cameraOn ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraOn ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3 text-zinc-400" />}
            </button>
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-1 rounded-full transition-all ${
                micOn ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
              title={micOn ? 'Mute mic' : 'Unmute mic'}
            >
              {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3 text-zinc-400" />}
            </button>
          </div>
        </div>

        {/* Display name input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-300">Your Display Name</label>
            <button
              onClick={handleRandomName}
              className="text-[10px] text-[#0071e3] hover:underline flex items-center gap-1 font-medium"
            >
              <Dices className="w-3 h-3" />
              <span>Random</span>
            </button>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. Alex"
            maxLength={24}
            className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs outline-none transition-all placeholder:text-zinc-600"
            autoFocus
          />
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          className="w-full py-2.5 btn-action font-medium text-xs rounded-xl flex items-center justify-center gap-2 mt-1"
        >
          <span>Enter Screening</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
