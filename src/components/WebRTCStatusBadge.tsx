'use client'

import { useState } from 'react'
import { Activity, Radio, RefreshCw, Volume2, ShieldCheck, ChevronDown, Check, Wifi, Video, Mic } from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'

export default function WebRTCStatusBadge() {
  const { webrtcStatus, activePeersCount, hasAudio, hasVideo } = useCineRoomStore()
  const { restartWebRTC, getDiagnostics } = useSupabaseRoom()
  const [isOpen, setIsOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const handleRestart = () => {
    setRestarting(true)
    restartWebRTC()
    setTimeout(() => setRestarting(false), 1500)
  }

  const handleTestAudio = () => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio').forEach((el) => {
        el.play().catch(() => {})
      })
    }
  }

  const diagnostics = isOpen ? getDiagnostics() : []

  // Color mappings
  const getStatusColor = () => {
    switch (webrtcStatus) {
      case 'connected':
        return 'bg-emerald-500'
      case 'connecting':
        return 'bg-amber-500 animate-pulse'
      case 'failed':
        return 'bg-rose-500'
      case 'disconnected':
      default:
        return activePeersCount > 0 ? 'bg-amber-400' : 'bg-zinc-500'
    }
  }

  const getStatusLabel = () => {
    if (webrtcStatus === 'connected') return `${activePeersCount} Peer${activePeersCount > 1 ? 's' : ''} Live`
    if (webrtcStatus === 'connecting') return 'Connecting Mesh...'
    if (webrtcStatus === 'failed') return 'Mesh Retry'
    return activePeersCount > 0 ? 'Signaling...' : 'P2P Ready'
  }

  return (
    <div className="relative pointer-events-auto">
      {/* Clickable Pill Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-capsule px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 transition-all shadow-md"
        title="WebRTC Voice & Video Connection Health"
      >
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="font-medium tracking-tight">{getStatusLabel()}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Diagnostics Dropdown Card */}
      {isOpen && (
        <div className="absolute top-8 right-0 w-72 liquid-glass rounded-2xl p-3.5 shadow-2xl border border-white/20 backdrop-blur-3xl animate-fade-in text-white text-xs z-50 space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="font-semibold text-xs tracking-tight">WebRTC Realtime Diagnostics</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300">
              {webrtcStatus}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Mic className="w-3 h-3" /> Audio
              </span>
              <span className={hasAudio ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                {hasAudio ? 'Active' : 'Muted'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Video className="w-3 h-3" /> Video
              </span>
              <span className={hasVideo ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                {hasVideo ? 'Live' : 'Off'}
              </span>
            </div>
          </div>

          {/* Peer List */}
          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
              Connected Peers ({diagnostics.length})
            </div>
            {diagnostics.length === 0 ? (
              <div className="p-2 rounded-xl bg-black/40 text-[11px] text-zinc-500 text-center">
                Waiting for other participants to join room...
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 scrollbar-thin">
                {diagnostics.map((d) => (
                  <div
                    key={d.targetId}
                    className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] flex items-center justify-between font-mono"
                  >
                    <span className="text-zinc-300 truncate max-w-[100px]">{d.targetId}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded ${
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
          <div className="border-t border-white/10 pt-2 flex items-center gap-2">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex-1 py-1 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-medium flex items-center justify-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${restarting ? 'animate-spin' : ''}`} />
              <span>Restart ICE</span>
            </button>
            <button
              onClick={handleTestAudio}
              className="py-1 px-2 rounded-lg bg-[#0071e3]/20 border border-[#0071e3]/30 hover:bg-[#0071e3]/30 text-[11px] text-blue-300 font-medium flex items-center gap-1 transition-all"
              title="Unlock browser autoplay for remote voices"
            >
              <Volume2 className="w-3 h-3" />
              <span>Resume Audio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
