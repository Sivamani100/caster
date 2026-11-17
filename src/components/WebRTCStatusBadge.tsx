'use client'

import { useState } from 'react'
import {
  Activity,
  Radio,
  RefreshCw,
  Volume2,
  ChevronDown,
  Video,
  Mic,
  Clock,
  Zap,
  Layers,
} from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'

export default function WebRTCStatusBadge() {
  const {
    webrtcStatus,
    activePeersCount,
    hasAudio,
    hasVideo,
    syncDriftMs,
    ntpOffsetMs,
    ntpRttMs,
    iceCandidateType,
    roomConnected,
    isHost,
  } = useCineRoomStore()

  const { restartWebRTC, getDiagnostics, calibrateClockOffset } = useSupabaseRoom()
  const [isOpen, setIsOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [calibrating, setCalibrating] = useState(false)

  const handleRestart = () => {
    setRestarting(true)
    restartWebRTC()
    setTimeout(() => setRestarting(false), 1500)
  }

  const handleCalibrate = async () => {
    setCalibrating(true)
    await calibrateClockOffset()
    setTimeout(() => setCalibrating(false), 800)
  }

  const handleTestAudio = () => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio').forEach((el) => {
        el.play().catch(() => {})
      })
    }
  }

  const diagnostics = isOpen ? getDiagnostics() : []

  // Drift color: green if <40ms (frame-locked), amber if <150ms, rose if >150ms
  const absDrift = Math.abs(syncDriftMs)
  const getDriftColor = () => {
    if (absDrift < 40) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    if (absDrift < 150) return 'text-amber-300 bg-amber-500/10 border-amber-500/30'
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  }

  return (
    <div className="relative pointer-events-auto">
      {/* Real-Time Telemetry Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-capsule px-3 py-1.5 rounded-full flex items-center gap-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 transition-all shadow-xl active:scale-95"
        title="Real-Time Sync Drift & WebRTC Telemetry"
      >
        {/* Room Presence Dot & Peer Count */}
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              roomConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-white hidden sm:inline">
            {roomConnected ? `Room (${activePeersCount + 1})` : 'Connecting...'}
          </span>
          <span className="text-white sm:hidden text-[10px] font-mono">
            {activePeersCount + 1}
          </span>
        </div>

        <span className="text-zinc-600">|</span>

        {/* Sync Drift Badge */}
        <span
          className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold border ${getDriftColor()}`}
        >
          {isHost ? 'Host' : `±${absDrift}ms`}
        </span>

        <span className="text-zinc-600 hidden sm:inline">|</span>

        {/* WebRTC ICE State */}
        <span className="hidden sm:inline text-zinc-400 font-mono text-[10px]">
          ICE: {webrtcStatus === 'connected' ? `connected (${iceCandidateType || 'p2p'})` : webrtcStatus}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-zinc-400 transition-transform hidden sm:inline ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Telemetry Diagnostics Dropdown Card */}
      {isOpen && (
        <div className="absolute top-9 right-0 w-72 sm:w-80 liquid-glass rounded-2xl p-4 shadow-2xl border border-white/20 backdrop-blur-3xl animate-fade-in text-white text-xs z-50 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="font-semibold text-xs tracking-tight">Real-Time Sync Telemetry</span>
            </div>
            <span
              className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                absDrift < 40 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {absDrift < 40 ? 'Frame-Locked' : 'Catching Up'}
            </span>
          </div>

          {/* Sync & NTP Metrics Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="text-[9px] text-zinc-400 uppercase">Sync Drift</div>
              <div className={`text-xs font-bold mt-0.5 ${getDriftColor().split(' ')[0]}`}>
                {isHost ? '0 ms' : `±${absDrift} ms`}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="text-[9px] text-zinc-400 uppercase">NTP Offset</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {isHost ? '0 ms' : `${ntpOffsetMs >= 0 ? '+' : ''}${ntpOffsetMs} ms`}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="text-[9px] text-zinc-400 uppercase">Latency RTT</div>
              <div className="text-xs font-bold text-sky-400 mt-0.5">
                {isHost ? '<1 ms' : `${ntpRttMs} ms`}
              </div>
            </div>
          </div>

          {/* WebRTC Mesh Status */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Mic className="w-3 h-3" /> Voice Audio
              </span>
              <span className={hasAudio ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                {hasAudio ? 'Active' : 'Muted'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Video className="w-3 h-3" /> FaceCam
              </span>
              <span className={hasVideo ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                {hasVideo ? 'Streaming' : 'Off'}
              </span>
            </div>
          </div>

          {/* Peer WebRTC Mesh List */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold">
              <span>Connected Peers ({diagnostics.length})</span>
              <span className="font-mono text-zinc-500">ICE: {iceCandidateType}</span>
            </div>
            {diagnostics.length === 0 ? (
              <div className="p-2.5 rounded-xl bg-black/40 text-[11px] text-zinc-500 text-center">
                Waiting for remote peers to join...
              </div>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-1 scrollbar-thin">
                {diagnostics.map((d) => (
                  <div
                    key={d.targetId}
                    className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] flex items-center justify-between font-mono"
                  >
                    <span className="text-zinc-300 truncate max-w-[120px]">{d.targetId}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        d.iceConnectionState === 'connected' || d.iceConnectionState === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {d.iceConnectionState}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-white/10 pt-2.5 flex items-center gap-2">
            {!isHost && (
              <button
                onClick={handleCalibrate}
                disabled={calibrating}
                className="flex-1 py-1 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
              >
                <Clock className={`w-3 h-3 ${calibrating ? 'animate-spin' : ''}`} />
                <span>Calibrate NTP</span>
              </button>
            )}
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex-1 py-1 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${restarting ? 'animate-spin' : ''}`} />
              <span>Restart ICE</span>
            </button>
            <button
              onClick={handleTestAudio}
              className="py-1 px-2 rounded-lg bg-[#0071e3]/20 border border-[#0071e3]/30 hover:bg-[#0071e3]/30 text-[10px] text-blue-300 font-medium flex items-center gap-1 transition-all"
              title="Unlock audio playback"
            >
              <Volume2 className="w-3 h-3" />
              <span>Audio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
