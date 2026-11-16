'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Settings,
  X,
  FlipHorizontal,
  Maximize2,
  Sliders,
  Check,
  Video,
  Eye,
  EyeOff,
  Mic,
  MicOff,
} from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'

interface FacecamOverlayProps {
  showControls?: boolean
  isFullscreen?: boolean
}

type ShapeOption = 'rounded' | 'squircle' | 'circle'

export default function FacecamOverlay({ showControls = false, isFullscreen = false }: FacecamOverlayProps) {
  const { localStream, hasVideo, hasAudio } = useCineRoomStore()
  const { toggleMic } = useSupabaseRoom()
  const videoRef = useRef<HTMLVideoElement>(null)

  // Facecam Settings State
  const [size, setSize] = useState<number>(190) // Width in px
  const [opacity, setOpacity] = useState<number>(0.5) // 0.15 to 1.0 (50% default)
  const [shape, setShape] = useState<ShapeOption>('rounded')
  const [isMirrored, setIsMirrored] = useState<boolean>(true)
  const [showBadge, setShowBadge] = useState<boolean>(true)
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

  // Save changes to localStorage
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

  // Attach local media stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream, hasVideo])

  if (!hasVideo || !localStream) {
    return null
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

  const effectiveOpacity = isHovered || showSettings ? Math.max(opacity, 0.85) : opacity

  return (
    <div
      className={`absolute right-4 sm:right-6 z-40 pointer-events-auto select-none flex flex-col items-end transition-all duration-300 ease-out ${
        showControls ? 'bottom-16 sm:bottom-18' : 'bottom-3 sm:bottom-4'
      }`}
    >
      {/* SETTINGS POPOVER CARD */}
      {showSettings && (
        <div className="mb-2.5 w-64 sm:w-72 liquid-glass rounded-2xl p-4 shadow-2xl border border-white/20 backdrop-blur-2xl animate-fade-in text-white space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="text-xs font-semibold tracking-tight">Webcam Overlay Settings</span>
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
              <span className="text-zinc-300 font-medium">Box Size</span>
              <span className="text-[#0071e3] font-mono font-bold">{size}px</span>
            </div>
            <input
              type="range"
              min="120"
              max="340"
              step="10"
              value={size}
              onChange={(e) => updateSize(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
            />
            {/* Quick Size Presets */}
            <div className="flex gap-1.5 pt-0.5">
              {[
                { label: 'Small', val: 140 },
                { label: 'Medium', val: 190 },
                { label: 'Large', val: 260 },
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
            <span className="text-[11px] text-zinc-300 font-medium block">Box Shape</span>
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

          {/* Toggle Switches */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <FlipHorizontal className="w-3 h-3 text-zinc-400" />
              Mirror Video
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

      {/* WEBCAM FACECAM BOX */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: `${size}px`,
          height: shape === 'circle' ? `${size}px` : `${Math.round(size * 0.65)}px`,
          borderRadius: getBorderRadius(),
          opacity: effectiveOpacity,
        }}
        className="relative overflow-hidden border border-white/25 shadow-2xl bg-black/60 backdrop-blur-md transition-all duration-200 group"
      >
        {/* Live Local Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
          }}
          className="w-full h-full object-cover"
        />

        {/* Hover Controls Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-200 flex flex-col justify-between p-2 pointer-events-none ${
            isHovered || showSettings ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top Row: Mic Mute / Unmute & Settings Buttons */}
          <div className="flex items-center justify-between pointer-events-auto w-full">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleMic()
              }}
              className={`p-1.5 rounded-full border shadow-lg transition-all active:scale-95 flex items-center gap-1 ${
                hasAudio
                  ? 'bg-black/70 hover:bg-black/90 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/30 hover:bg-rose-500/50 border-rose-500/60 text-rose-300'
              }`}
              title={hasAudio ? 'Microphone is ON • Click to Mute' : 'Microphone is MUTED • Click to Unmute'}
            >
              {hasAudio ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-full bg-black/70 hover:bg-[#0071e3] text-white border border-white/20 shadow-lg transition-all active:scale-95"
              title="Adjust Webcam Size & Opacity"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Row: User Label & Live Mic Status Badge */}
          {showBadge && (
            <div className="flex items-center justify-between pointer-events-auto w-full gap-1">
              <span className="text-[10px] font-semibold text-white bg-black/70 border border-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                Live
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMic()
                }}
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all shadow-sm flex-shrink-0 ${
                  hasAudio
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/30 border-rose-500/50 text-rose-300'
                }`}
                title="Click to toggle mic"
              >
                {hasAudio ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                <span>{hasAudio ? 'Mic On' : 'Muted'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Subtle persistent status indicators (when not hovering) */}
        {!isHovered && !showSettings && (
          <>
            {showBadge && (
              <div className="absolute bottom-1.5 left-2 bg-black/60 border border-white/15 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white/90 flex items-center gap-1 shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live</span>
              </div>
            )}
            <div
              className={`absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-semibold flex items-center gap-1 shadow border ${
                hasAudio
                  ? 'bg-black/60 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
              }`}
            >
              {hasAudio ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
