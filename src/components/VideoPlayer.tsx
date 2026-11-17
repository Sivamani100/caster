'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Hls from 'hls.js'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Lock,
  Check,
  Share2,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Camera,
  CameraOff,
} from 'lucide-react'
import { useCineRoomStore, CURATED_MOVIES, MovieInfo } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'
import ScreenChatOverlay from './ScreenChatOverlay'
import FacecamOverlay from './FacecamOverlay'
import ChatPanel from './ChatPanel'
import WebRTCStatusBadge from './WebRTCStatusBadge'

interface VideoPlayerProps {
  roomId: string
}

export default function VideoPlayer({ roomId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    currentMovie,
    isHost,
    hostName,
    isPlaying,
    playbackTime,
    localStream,
    hasVideo,
    hasAudio,
    presenceUsers,
    ntpOffsetMs,
    setSyncDriftMs,
  } = useCineRoomStore()

  const {
    sendPlaybackControl,
    sendPlaybackHeartbeat,
    requestPlaybackSync,
    calibrateClockOffset,
    sendMovieChange,
    toggleMic,
    toggleCamera,
  } = useSupabaseRoom()

  const latestHostSyncRef = useRef<{
    isPlaying: boolean
    videoTimestamp: number
    hostWallClock: number
    playbackRate?: number
  } | null>(null)

  const [cameraLoading, setCameraLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [volume, setVolume] = useState(0.85)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenChat, setShowFullscreenChat] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [showMoviePicker, setShowMoviePicker] = useState(false)
  const [hostWarning, setHostWarning] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(596)
  const [copiedLink, setCopiedLink] = useState(false)

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec || 0)
    const m = Math.floor(s / 60)
    const remS = s % 60
    return `${m.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`
  }

  const copyRoomLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  // Listen for sync packets from Host (both periodic heartbeats and immediate actions)
  useEffect(() => {
    const handleSyncPacket = (e: Event) => {
      const payload = (e as CustomEvent).detail
      latestHostSyncRef.current = {
        isPlaying: payload.isPlaying,
        videoTimestamp: payload.videoTimestamp ?? payload.currentTime ?? 0,
        hostWallClock: payload.hostWallClock ?? payload.timestamp ?? Date.now(),
        playbackRate: payload.playbackRate || 1.0,
      }

      if (payload.isHardSync && videoRef.current && !isHost) {
        const nowHostTime = Date.now() + (ntpOffsetMs || 0)
        const elapsedSinceEmit = Math.max(0, (nowHostTime - latestHostSyncRef.current.hostWallClock) / 1000)
        const exactExpected = payload.isPlaying
          ? latestHostSyncRef.current.videoTimestamp + (elapsedSinceEmit * (latestHostSyncRef.current.playbackRate || 1.0))
          : latestHostSyncRef.current.videoTimestamp
        videoRef.current.currentTime = exactExpected + (payload.isPlaying ? 0.15 : 0)
        videoRef.current.playbackRate = 1.0
        if (payload.isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {
            if (videoRef.current) {
              videoRef.current.muted = true
              setIsMuted(true)
              videoRef.current.play().catch(() => {})
            }
          })
        } else if (!payload.isPlaying && !videoRef.current.paused) {
          videoRef.current.pause()
        }
      }
    }

    window.addEventListener('cineroom:sync_packet', handleSyncPacket)
    return () => window.removeEventListener('cineroom:sync_packet', handleSyncPacket)
  }, [isHost, ntpOffsetMs])

  // Viewer: Continuous NTP Frame-Accurate Drift Check Loop (<30ms lock)
  useEffect(() => {
    if (isHost) return

    const interval = setInterval(() => {
      const video = videoRef.current
      const payload = latestHostSyncRef.current
      if (!video || !payload) return

      // Calculate exact expected time at this millisecond using NTP offset
      const nowHostTime = Date.now() + (ntpOffsetMs || 0)
      const elapsedSinceEmit = Math.max(0, (nowHostTime - payload.hostWallClock) / 1000)
      const exactExpectedTime = payload.isPlaying
        ? payload.videoTimestamp + (elapsedSinceEmit * (payload.playbackRate || 1.0))
        : payload.videoTimestamp

      const drift = video.currentTime - exactExpectedTime // positive = ahead, negative = behind
      const driftSec = Math.abs(drift)
      setSyncDriftMs(Math.round(drift * 1000))

      if (driftSec > 0.50) {
        // Hard seek: pre-compensate 150ms for decoder keyframe seek time
        video.currentTime = exactExpectedTime + (payload.isPlaying ? 0.15 : 0)
        video.playbackRate = 1.0
      } else if (driftSec >= 0.04) {
        // Micro-rate adjustment: NO BUFFER FLUSHES / JARRING JUMPS
        if (drift < 0) {
          // Behind: catch up smoothly
          video.playbackRate = 1.05
        } else {
          // Ahead: slow down smoothly
          video.playbackRate = 0.95
        }
      } else {
        // Perfect single-frame lock (<40ms)
        video.playbackRate = 1.0
      }

      // Sync play / pause state
      if (payload.isPlaying && video.paused) {
        video.play().catch(() => {
          video.muted = true
          setIsMuted(true)
          video.play().catch(() => {})
        })
      } else if (!payload.isPlaying && !video.paused) {
        video.pause()
      }
    }, 200)

    return () => clearInterval(interval)
  }, [isHost, ntpOffsetMs, setSyncDriftMs])

  // Host: Continuous 1.5-second heartbeat broadcast while playing
  useEffect(() => {
    if (!isHost) return
    const interval = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused) {
        sendPlaybackHeartbeat(video.currentTime, !video.paused, video.playbackRate)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [isHost, sendPlaybackHeartbeat])

  // Host: Immediately emit heartbeat on play, pause, seeked, or ratechange
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHost) return

    const handleEvent = () => {
      sendPlaybackHeartbeat(video.currentTime, !video.paused, video.playbackRate)
    }

    video.addEventListener('play', handleEvent)
    video.addEventListener('pause', handleEvent)
    video.addEventListener('seeked', handleEvent)
    video.addEventListener('ratechange', handleEvent)

    return () => {
      video.removeEventListener('play', handleEvent)
      video.removeEventListener('pause', handleEvent)
      video.removeEventListener('seeked', handleEvent)
      video.removeEventListener('ratechange', handleEvent)
    }
  }, [isHost, sendPlaybackHeartbeat])

  // Host: Immediately respond with current video state when a viewer joins
  useEffect(() => {
    const handleRespond = () => {
      const video = videoRef.current
      if (video && isHost) {
        sendPlaybackControl(!video.paused, video.currentTime, video.playbackRate)
      }
    }
    window.addEventListener('cineroom:respond_sync_request', handleRespond)
    return () => window.removeEventListener('cineroom:respond_sync_request', handleRespond)
  }, [isHost, sendPlaybackControl])

  // Viewer: Request sync immediately on mount and after short buffer
  useEffect(() => {
    if (!isHost) {
      requestPlaybackSync()
      const t = setTimeout(() => requestPlaybackSync(), 1000)
      return () => clearTimeout(t)
    }
  }, [isHost, requestPlaybackSync])

  // Track local time updates
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [])

  // Mount stream — ONLY re-mounts when the actual movie URL changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setIsLoading(true)
    const streamUrl = currentMovie.url

    const onReady = () => {
      setIsLoading(false)
      const targetTime = useCineRoomStore.getState().playbackTime
      if (targetTime > 0) {
        try {
          video.currentTime = targetTime
        } catch {}
      }
      if (useCineRoomStore.getState().isPlaying) {
        const p = video.play()
        if (p !== undefined) {
          p.catch(() => {
            video.muted = true
            setIsMuted(true)
            video.play().catch(() => {})
          })
        }
      }
    }

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 60 * 1000 * 1000,
      })
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, onReady)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          onReady()
        }
      })
    } else {
      video.src = streamUrl
      video.load()
      video.addEventListener('canplay', onReady, { once: true })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [currentMovie.url])

  const hideControlsAfterDelay = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    setShowControls(true)
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying && !showMoviePicker) setShowControls(false)
    }, 3200)
  }

  // Host toggle play/pause
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (!isHost) {
      setHostWarning(`Controlled by Host (${hostName})`)
      setTimeout(() => setHostWarning(null), 2500)
      return
    }

    const nextState = !isPlaying
    sendPlaybackControl(nextState, video.currentTime)
  }

  // Seek on timeline
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) {
      setHostWarning(`Controlled by Host (${hostName})`)
      setTimeout(() => setHostWarning(null), 2500)
      return
    }
    const target = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = target
    }
    sendPlaybackControl(isPlaying, target)
  }

  // YouTube-style 10s skip forward / backward
  const skipTime = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    if (!isHost) {
      setHostWarning(`Controlled by Host (${hostName})`)
      setTimeout(() => setHostWarning(null), 2500)
      return
    }

    const newTime = Math.max(0, Math.min(duration || 596, video.currentTime + seconds))
    video.currentTime = newTime
    setCurrentTime(newTime)
    sendPlaybackControl(isPlaying, newTime)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.volume = v
      if (v > 0 && isMuted) {
        videoRef.current.muted = false
        setIsMuted(false)
      }
    }
    setVolume(v)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
      setShowFullscreenChat(false)
    }
  }

  // Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement
      setIsFullscreen(isNowFullscreen)
      if (!isNowFullscreen) {
        setShowFullscreenChat(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Listen to open-fullscreen-chat event dispatched from on-screen message click
  useEffect(() => {
    const handleOpenFullscreenChat = () => {
      if (document.fullscreenElement) {
        setShowFullscreenChat(true)
      }
    }
    window.addEventListener('open-fullscreen-chat', handleOpenFullscreenChat)
    return () => window.removeEventListener('open-fullscreen-chat', handleOpenFullscreenChat)
  }, [])

  const handleCameraToggle = async () => {
    setCameraLoading(true)
    await toggleCamera()
    setCameraLoading(false)
  }

  // YouTube-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        skipTime(-10)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        skipTime(10)
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute()
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, isHost, hostName, duration])

  const handleSelectMovie = (movie: MovieInfo) => {
    if (!isHost) {
      setHostWarning('Only host can switch streams')
      setTimeout(() => setHostWarning(null), 2500)
      return
    }
    sendMovieChange(movie)
    setShowMoviePicker(false)
  }

  const handleCustomStream = () => {
    if (!customUrl.trim()) return
    if (!isHost) {
      setHostWarning('Only host can switch streams')
      setTimeout(() => setHostWarning(null), 2500)
      return
    }
    const movie: MovieInfo = {
      title: customTitle.trim() || 'Custom Stream',
      url: customUrl.trim(),
      genre: 'Custom Broadcast',
      duration: 600,
    }
    sendMovieChange(movie)
    setCustomUrl('')
    setCustomTitle('')
    setShowMoviePicker(false)
  }

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0
  const totalWatchers = Math.max(1, presenceUsers.length || 1)

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Video Container & Fullscreen Parent - Fills Canvas Completely */}
      <div
        ref={containerRef}
        className={`relative w-full h-full max-h-full bg-black rounded-2xl overflow-hidden border border-white/[0.12] shadow-2xl flex ${
          isFullscreen && showFullscreenChat ? 'flex-row' : 'items-center justify-center'
        }`}
        style={{
          height: isFullscreen ? '100vh' : undefined,
          aspectRatio: isFullscreen ? undefined : '16/9',
        }}
        onMouseMove={hideControlsAfterDelay}
        onMouseLeave={() => isPlaying && !showMoviePicker && setShowControls(false)}
      >
        {/* Video Canvas Stage (takes 3/4 if fullscreen chat is open, 100% otherwise) */}
        <div
          className={`relative h-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
            isFullscreen && showFullscreenChat ? 'w-3/4 flex-1' : 'w-full'
          }`}
        >
          {/* HTML5 Video Element - Fills canvas completely with object-cover (Zero bottom black bar) */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover cursor-pointer"
            muted={isMuted}
            playsInline
            loop
            onClick={togglePlay}
          />

          {/* FLOATING ON-SCREEN CHAT MESSAGES (LEFT SIDE - DYNAMIC ADAPTIVE BOTTOM STICKING) */}
          <ScreenChatOverlay
            showControls={showControls}
            onMessageClick={() => {
              if (isFullscreen) {
                setShowFullscreenChat(true)
              }
            }}
          />

          {/* WEBCAM FACECAM OVERLAY (BOTTOM-RIGHT SIDE - DYNAMIC ADAPTIVE BOTTOM STICKING) */}
          <FacecamOverlay
            showControls={showControls}
            isFullscreen={isFullscreen}
          />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-30 space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#0071e3] animate-spin" />
            <p className="text-white text-xs font-mono tracking-wider text-zinc-400">
              SYNCHRONIZING STREAM
            </p>
          </div>
        )}

        {/* Host Control Toast */}
        {hostWarning && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#0c0c0e]/95 text-white text-xs font-medium px-4 py-2 rounded-full shadow-2xl backdrop-blur-xl flex items-center gap-2 border border-white/12 animate-fade-in">
            <Lock className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{hostWarning}</span>
          </div>
        )}

        {/* Discrete Unmute Prompt */}
        {isMuted && !isLoading && (
          <button
            onClick={toggleMute}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 cursor-pointer liquid-glass-dock px-3.5 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-2 shadow-2xl hover:scale-105 transition-all"
          >
            <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
            <span>Click to Unmute</span>
          </button>
        )}

        {/* Top Floating Glassmorphism HUD Bar (Integrated Room & Stream Controls) */}
        <div
          className={`absolute top-0 left-0 right-0 p-3 sm:p-4 z-20 transition-all duration-300 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 via-black/30 to-transparent pb-10 ${
            showControls || showMoviePicker ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          {/* Left: Stream Title & Host Capsule (LIVE badge & Code Pill Removed per request) */}
          <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-auto">
            <div className="glass-capsule px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs shadow-xl">
              <span className="font-semibold text-white tracking-tight truncate max-w-[180px] sm:max-w-sm">
                {currentMovie.title}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300 text-[11px] font-medium">
                {isHost ? 'You are Host' : `Host: ${hostName}`}
              </span>
            </div>
          </div>

          {/* Right: WebRTC Mesh Badge, Switch Stream, Share & Exit Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
            {/* Live WebRTC Audio/Video Connection Diagnostics Badge */}
            <WebRTCStatusBadge />

            {/* Stream Switcher */}
            <button
              onClick={() => {
                if (!isHost) {
                  setHostWarning(`Controlled by Host (${hostName})`)
                  setTimeout(() => setHostWarning(null), 2500)
                  return
                }
                setShowMoviePicker(!showMoviePicker)
              }}
              className={`glass-capsule px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-xl ${
                isHost
                  ? 'text-white hover:bg-white/[0.1]'
                  : 'text-zinc-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
                <span>{isHost ? 'Switch Stream' : 'Host Controlled'}</span>
              </div>
            </button>

            {/* Share Link */}
            <button
              onClick={copyRoomLink}
              className="glass-capsule p-2 rounded-full text-zinc-300 hover:text-white transition-all shadow-xl"
              title="Copy room link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#0071e3]" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>

            {/* Leave Room */}
            <Link
              href="/"
              className="glass-capsule p-2 rounded-full text-zinc-400 hover:text-white transition-all shadow-xl"
              title="Leave Room"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Switch Stream Modal */}
        {showMoviePicker && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl p-4 sm:p-6 flex flex-col justify-center items-center overflow-y-auto">
            <div className="max-w-md w-full liquid-glass rounded-2xl p-5 space-y-4 border border-white/[0.12] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="text-sm font-semibold text-white tracking-tight">Broadcast Stream Selection</span>
                <button
                  onClick={() => setShowMoviePicker(false)}
                  className="btn-glass px-2.5 py-1 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {CURATED_MOVIES.map((m) => (
                  <button
                    key={m.title}
                    onClick={() => handleSelectMovie(m)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      currentMovie.title === m.title
                        ? 'border-[#0071e3] bg-[#0071e3]/10 text-white'
                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium">{m.title}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{m.genre}</div>
                    </div>
                    {currentMovie.title === m.title && (
                      <Check className="w-4 h-4 text-[#0071e3]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom stream */}
              <div className="border-t border-white/[0.08] pt-3 space-y-2">
                <span className="text-xs text-zinc-400 font-medium block">Or Broadcast Custom Link:</span>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste HLS .m3u8 or MP4 link"
                  className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs outline-none"
                />
                <button
                  onClick={handleCustomStream}
                  className="w-full py-2 btn-action text-xs font-semibold rounded-xl"
                >
                  Broadcast to Room
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Center Pause Disc Indicator */}
        {!isPlaying && !isLoading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer z-10 bg-black/50 backdrop-blur-[2px]"
            onClick={togglePlay}
          >
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all mb-2.5">
              <Play className="w-6 h-6 ml-1" fill="currentColor" />
            </div>
            <div className="liquid-glass-dock px-3.5 py-1.5 rounded-full text-white text-xs font-medium">
              {isHost ? 'Stream Paused • Click to Resume' : `Stream Paused by ${hostName}`}
            </div>
          </div>
        )}

        {/* YOUTUBE-STYLE FULL-WIDTH BOTTOM ADJUSTING & CONTROL BAR */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-none flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 pb-3 px-3 sm:px-5 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="w-full pointer-events-auto flex flex-col gap-1.5">
            {/* Full-Width YouTube Progress Bar & Adjusting Slider */}
            <div className="relative flex items-center w-full group py-1 cursor-pointer">
              <input
                type="range"
                min="0"
                max={duration || 596}
                step="0.5"
                value={currentTime}
                onChange={handleSeek}
                style={{
                  background: `linear-gradient(to right, #0071e3 0%, #0071e3 ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`
                }}
                className={`w-full h-1.5 group-hover:h-2 rounded-lg appearance-none cursor-pointer accent-[#0071e3] transition-all ${
                  !isHost ? 'cursor-not-allowed opacity-75' : ''
                }`}
              />
            </div>

            {/* YouTube Style Action Buttons Row */}
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left: Play/Pause, 10s Rewind, 10s Forward, Volume, Duration */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Play / Pause Toggle */}
                <button
                  onClick={togglePlay}
                  className={`p-1.5 rounded-lg transition-all ${
                    isHost ? 'text-white hover:text-white/80 active:scale-95' : 'text-zinc-500 cursor-not-allowed'
                  }`}
                  title={isHost ? (isPlaying ? 'Pause (Space)' : 'Play (Space)') : `Host controlled (${hostName})`}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" fill="currentColor" />
                  ) : (
                    <Play className="w-5 h-5" fill="currentColor" />
                  )}
                </button>

                {/* Volume Mute & Slider */}
                <div className="flex items-center gap-1 ml-1 sm:ml-2">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-300 hover:text-white p-1 rounded-lg transition-colors"
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolume}
                    className="w-14 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                {/* Movie Length / Duration */}
                <span className="text-xs text-zinc-300 font-mono tracking-tight ml-2">
                  {formatSeconds(currentTime)} / {formatSeconds(duration)}
                </span>
              </div>

              {/* Right: AV Toggles (Mic Mute & Go Live), Chat, Fullscreen */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Mic Mute / Unmute Toggle */}
                <button
                  onClick={toggleMic}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                    hasAudio
                      ? 'glass-capsule text-white border border-emerald-500/30 hover:bg-emerald-500/10'
                      : 'bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                  }`}
                  title={hasAudio ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {hasAudio ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mic On</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>Muted</span>
                    </>
                  )}
                </button>

                {/* Go Live / Camera Toggle */}
                <button
                  onClick={handleCameraToggle}
                  disabled={cameraLoading}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                    hasVideo
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'btn-action text-white hover:brightness-110'
                  }`}
                  title={hasVideo ? 'Stop Camera Overlay' : 'Go Live (Show Webcam on Screen)'}
                >
                  {cameraLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : hasVideo ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <CameraOff className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Live Cam</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-white" />
                      <span>Go Live</span>
                    </>
                  )}
                </button>

                {/* Chat Toggle Button */}
                <button
                  onClick={() => setShowFullscreenChat(!showFullscreenChat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                    showFullscreenChat
                      ? 'bg-[#0071e3] text-white'
                      : 'glass-capsule text-zinc-300 hover:text-white'
                  }`}
                  title="Toggle Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="text-zinc-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* FULLSCREEN 1/4 PART SCREEN CHAT PANEL */}
        {isFullscreen && showFullscreenChat && (
          <div className="w-1/4 min-w-[280px] max-w-[420px] h-full flex-shrink-0 z-40 p-2 sm:p-3 bg-black/75 backdrop-blur-3xl border-l border-white/[0.12] transition-all duration-300 flex flex-col">
            <ChatPanel
              roomId={roomId}
              isFullscreen={true}
              onClose={() => setShowFullscreenChat(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
