'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Settings,
  X,
  FlipHorizontal,
  Sliders,
  Mic,
  MicOff,
  Video,
} from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'

interface FacecamOverlayProps {
  showControls?: boolean
  isFullscreen?: boolean
}

type ShapeOption = 'rounded' | 'squircle' | 'circle'

interface CamFeed {
  id: string
  name: string
  stream: MediaStream
  isLocal: boolean
  hasAudio: boolean
  isHost?: boolean
}

/**
 * Individual Cam Tile:
 * Renders an active local or remote WebRTC video stream
 * with name tag, live mic status, and dynamic styling.
 */
function FacecamTile({
  cam,
  size,
  shape,
  isMirrored,
  borderRadius,
  onToggleMic,
}: {
  cam: CamFeed
  size: number
  shape: ShapeOption
  isMirrored: boolean
  borderRadius: string
  onToggleMic?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !cam.stream) return

    video.srcObject = cam.stream
    const play = () => {
      video.play().catch(() => {})
    }
    play()

    cam.stream.onaddtrack = play
    cam.stream.onremovetrack = play

    const tracks = cam.stream.getVideoTracks()
    tracks.forEach((t) => {
      t.onunmute = play
    })

    return () => {
      if (cam.stream) {
        cam.stream.onaddtrack = null
        cam.stream.onremovetrack = null
      }
    }
  }, [cam.stream, cam.name])

  const height = shape === 'circle' ? size : Math.round(size * 0.72)

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${height}px`,
        borderRadius,
      }}
      className="relative overflow-hidden bg-black/75 border border-white/25 shadow-2xl transition-all duration-200 group flex-shrink-0"
    >
      {/* Live Video Feed - Always muted={true} so browser autoplay allows instant 30fps frames without blocking */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        style={{
          transform: cam.isLocal && isMirrored ? 'scaleX(-1)' : 'none',
        }}
        className="w-full h-full object-cover"
      />

      {/* Floating HUD: Name & Mic indicator */}
      <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1 truncate max-w-[70%]">
          <span className="text-[10px] font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] truncate">
            {cam.isLocal ? 'You' : cam.name}
          </span>
          {cam.isHost && (
            <span className="text-[8px] bg-[#0071e3]/40 border border-[#0071e3]/60 text-white px-1 py-0.2 rounded font-mono uppercase">
              Host
            </span>
          )}
        </div>

        {/* Mic Status */}
        <div className="pointer-events-auto">
          {cam.isLocal && onToggleMic ? (
            <button
              onClick={onToggleMic}
              className={`p-1 rounded-full border shadow-sm transition-all active:scale-90 ${
                cam.hasAudio
                  ? 'bg-black/70 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/40 border-rose-500/60 text-rose-300'
              }`}
              title={cam.hasAudio ? 'Mic active • Click to Mute' : 'Muted • Click to Unmute'}
            >
              {cam.hasAudio ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
            </button>
          ) : (
            <div
              className={`p-1 rounded-full border shadow-sm ${
                cam.hasAudio
                  ? 'bg-black/70 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
              }`}
            >
              {cam.hasAudio ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
            </div>
          )}
        </div>
      </div>

      {/* Local User Tag */}
      {cam.isLocal && (
        <span className="absolute top-1.5 left-2 text-[8px] font-bold text-white uppercase bg-black/70 border border-white/20 px-1.5 py-0.5 rounded-full z-10 tracking-wider">
          You
        </span>
      )}
    </div>
  )
}

export default function FacecamOverlay({ showControls = false, isFullscreen = false }: FacecamOverlayProps) {
  const { localStream, hasVideo, hasAudio, streams, presenceUsers, myId, isHost } = useCineRoomStore()
  const { toggleMic } = useSupabaseRoom()

  // Facecam Settings State
  const [size, setSize] = useState<number>(180) // Width in px
  const [opacity, setOpacity] = useState<number>(0.85) // High visibility by default
  const [shape, setShape] = useState<ShapeOption>('rounded')
  const [isMirrored, setIsMirrored] = useState<boolean>(true)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSize = localStorage.getItem('cineroom_facecam_size')
      const savedOpacity = localStorage.getItem('cineroom_facecam_opacity')
      const savedShape = localStorage.getItem('cineroom_facecam_shape') as ShapeOption
      const savedMirror = localStorage.getItem('cineroom_facecam_mirror')

      if (savedSize) setSize(Number(savedSize))
      if (savedOpacity) setOpacity(Number(savedOpacity))
      if (savedShape) setShape(savedShape)
      if (savedMirror !== null) setIsMirrored(savedMirror === 'true')
    }
  }, [])

  const updateSize = (newSize: number) => {
    setSize(newSize)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cineroom_facecam_size', newSize.toString())
    }
  }

  const updateOpacity = (newOpacity: number) => {
    setOpacity(newOpacity)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cineroom_facecam_opacity', newOpacity.toString())
    }
  }

  const updateShape = (newShape: ShapeOption) => {
    setShape(newShape)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cineroom_facecam_shape', newShape)
    }
  }

  const toggleMirror = () => {
    const next = !isMirrored
    setIsMirrored(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cineroom_facecam_mirror', next.toString())
    }
  }

  // Calculate dynamic border-radius based on shape
  const getBorderRadius = () => {
    switch (shape) {
      case 'circle':
        return '9999px'
      case 'squircle':
        return '24px'
      case 'rounded':
      default:
        return '16px'
    }
  }

  // Collect all active camera feeds: mine + others
  const localCam: CamFeed | null =
    hasVideo && localStream
      ? {
          id: myId,
          name: 'You',
          stream: localStream,
          isLocal: true,
          hasAudio,
          isHost,
        }
      : null

  const remoteIds = Array.from(
    new Set([...presenceUsers.map((u) => u.id), ...Object.keys(streams)])
  ).filter((id) => id !== myId)

  const remoteCams: CamFeed[] = remoteIds
    .map((id) => {
      const presence = presenceUsers.find((u) => u.id === id)
      const stream = streams[id]
      const hasLiveVideoTrack =
        stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
      return {
        id,
        name: presence?.name || 'Viewer',
        stream,
        isLocal: false,
        hasAudio:
          presence?.hasAudio ??
          (stream ? stream.getAudioTracks().some((t) => t.enabled) : false),
        isHost: presence?.isHost,
        hasLiveVideoTrack,
      }
    })
    .filter(
      (c) =>
        c.stream !== undefined &&
        (c.hasLiveVideoTrack || presenceUsers.find((u) => u.id === c.id)?.hasVideo)
    )

  const activeCams: CamFeed[] = localCam ? [localCam, ...remoteCams] : remoteCams

  // If no one in the room has turned on a camera, hide the overlay completely
  if (activeCams.length === 0) {
    return null
  }

  const effectiveOpacity = isHovered || showSettings ? Math.max(opacity, 0.95) : opacity

  return (
    <div
      className={`absolute right-3 sm:right-5 z-40 pointer-events-auto select-none flex flex-col items-end transition-all duration-300 ease-out ${
        showControls ? 'bottom-16 sm:bottom-18' : 'bottom-3 sm:bottom-4'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* SETTINGS POPOVER CARD */}
      {showSettings && (
        <div className="mb-2.5 w-64 sm:w-72 liquid-glass rounded-2xl p-4 shadow-2xl border border-white/20 backdrop-blur-2xl animate-fade-in text-white space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="text-xs font-semibold tracking-tight">FaceCam Stage Settings</span>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Opacity Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Transparency / Opacity</span>
              <span className="text-[#0071e3] font-mono font-bold">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.15"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => updateOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
            />
            {/* Quick Presets */}
            <div className="flex gap-1.5 pt-0.5">
              {[0.3, 0.5, 0.75, 1.0].map((val) => (
                <button
                  key={val}
                  onClick={() => updateOpacity(val)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                    Math.abs(opacity - val) < 0.05
                      ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm'
                      : 'bg-white/[0.05] border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {Math.round(val * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* Size Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Camera Tile Size</span>
              <span className="text-[#0071e3] font-mono font-bold">{size}px</span>
            </div>
            <input
              type="range"
              min="120"
              max="320"
              step="10"
              value={size}
              onChange={(e) => updateSize(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
            />
            {/* Quick Size Presets */}
            <div className="flex gap-1.5 pt-0.5">
              {[
                { label: 'Compact', val: 140 },
                { label: 'Medium', val: 180 },
                { label: 'Expanded', val: 240 },
              ].map(({ label, val }) => (
                <button
                  key={val}
                  onClick={() => updateSize(val)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                    Math.abs(size - val) < 20
                      ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm'
                      : 'bg-white/[0.05] border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Shape Selection */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-300 font-medium block">Shape</span>
            <div className="flex gap-1.5">
              {[
                { id: 'rounded' as ShapeOption, label: 'Rounded' },
                { id: 'squircle' as ShapeOption, label: 'Squircle' },
                { id: 'circle' as ShapeOption, label: 'Circle' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => updateShape(id)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                    shape === id
                      ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm'
                      : 'bg-white/[0.05] border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mirror Toggle */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <FlipHorizontal className="w-3 h-3 text-zinc-400" />
              Mirror My Video
            </span>
            <button
              onClick={toggleMirror}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                isMirrored ? 'bg-[#0071e3]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                  isMirrored ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* MULTI-CAM DOCK: Mine + Others rendered in real-time on top of the cinema screen */}
      <div className="flex flex-col items-end gap-1.5">
        {/* Settings button trigger on hover */}
        <div
          className={`transition-opacity duration-200 flex items-center gap-1.5 ${
            isHovered || showSettings ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 rounded-full bg-black/80 hover:bg-[#0071e3] text-white border border-white/20 shadow-lg text-[10px] font-medium flex items-center gap-1 transition-all active:scale-95"
            title="Adjust FaceCam Size & Opacity"
          >
            <Settings className="w-3 h-3" />
            <span>FaceCam Settings</span>
          </button>
        </div>

        {/* Cam Tiles Container */}
        <div
          style={{ opacity: effectiveOpacity }}
          className="flex items-center gap-2 max-w-[90vw] overflow-x-auto p-1 rounded-2xl transition-opacity duration-200"
        >
          {activeCams.map((cam) => (
            <FacecamTile
              key={cam.id}
              cam={cam}
              size={size}
              shape={shape}
              isMirrored={isMirrored}
              borderRadius={getBorderRadius()}
              onToggleMic={cam.isLocal ? toggleMic : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
