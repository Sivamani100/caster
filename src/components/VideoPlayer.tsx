'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Loader2 } from 'lucide-react'

// A demo HLS stream that actually works (Big Buck Bunny)
const DEMO_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

interface VideoPlayerProps {
  streamUrl?: string
  title?: string
}

export default function VideoPlayer({ streamUrl = DEMO_STREAM_URL, title = 'Live Stream' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const controlsTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const setupHls = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        })
        hlsRef.current = hls
        hls.loadSource(streamUrl)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false)
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        })

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError('Stream unavailable. Using fallback.')
            // Try native video fallback
            video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            video.load()
            setIsLoading(false)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = streamUrl
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false)
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        })
      } else {
        // Fallback to MP4
        video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        video.load()
        video.addEventListener('canplay', () => setIsLoading(false))
      }
    }

    setupHls()

    return () => {
      hlsRef.current?.destroy()
    }
  }, [streamUrl])

  const hideControlsAfterDelay = () => {
    clearTimeout(controlsTimerRef.current)
    setShowControls(true)
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (videoRef.current) videoRef.current.volume = v
    setVolume(v)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: '16/9' }}
      onMouseMove={hideControlsAfterDelay}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={isMuted}
        playsInline
        onClick={togglePlay}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-12 h-12 text-[#e94560] animate-spin" />
        </div>
      )}

      {/* LIVE badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#e94560] px-3 py-1 rounded-full text-xs font-bold text-white">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE
      </div>

      {/* Title */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-gray-300">
        {title}
      </div>

      {/* Play/Pause overlay */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-[#e94560] transition-colors"
          >
            {isPlaying
              ? <Pause className="w-5 h-5" fill="currentColor" />
              : <Play className="w-5 h-5" fill="currentColor" />
            }
          </button>

          {/* Volume */}
          <button
            onClick={toggleMute}
            className="text-white hover:text-[#e94560] transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolume}
            className="w-20 accent-[#e94560]"
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Error msg */}
          {error && <span className="text-yellow-400 text-xs">{error}</span>}

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-[#e94560] transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
