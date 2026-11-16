'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Film,
  Users,
  ArrowRight,
  Crown,
  KeyRound,
  ExternalLink,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { CURATED_MOVIES, MovieInfo } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create')

  // Create room state
  const [generatedCode, setGeneratedCode] = useState('4821')
  const [hostName, setHostName] = useState('')
  const [selectedMovie, setSelectedMovie] = useState<MovieInfo>(CURATED_MOVIES[0])
  const [isCustomStream, setIsCustomStream] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  // Join room state
  const [digit1, setDigit1] = useState('')
  const [digit2, setDigit2] = useState('')
  const [digit3, setDigit3] = useState('')
  const [digit4, setDigit4] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    setGeneratedCode(Math.floor(1000 + Math.random() * 9000).toString())
  }, [])

  const regenerateCode = () => {
    setGeneratedCode(Math.floor(1000 + Math.random() * 9000).toString())
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = hostName.trim() || 'Host'
    const movieToStream = isCustomStream
      ? {
          title: customTitle.trim() || 'Custom Stream',
          url: customUrl.trim() || CURATED_MOVIES[0].url,
          genre: 'Custom Broadcast',
          duration: 600,
        }
      : selectedMovie

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`cineroom_${generatedCode}_name`, name)
      sessionStorage.setItem(`cineroom_${generatedCode}_isHost`, 'true')
      sessionStorage.setItem(`cineroom_${generatedCode}_movie`, JSON.stringify(movieToStream))
    }

    // Pre-insert into Supabase
    try {
      await supabase.from('rooms').upsert({
        id: generatedCode,
        host_name: name,
        host_id: `host-${Date.now()}`,
        movie_title: movieToStream.title,
        movie_url: movieToStream.url,
        movie_genre: movieToStream.genre || '',
        movie_duration: movieToStream.duration || 596,
        is_playing: true,
        playback_time: 0,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    } catch {}

    router.push(`/room/${generatedCode}`)
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    const code = `${digit1}${digit2}${digit3}${digit4}`
    if (code.length !== 4) {
      setJoinError('Please enter a complete 4-digit room code')
      return
    }

    const name = joinName.trim() || `Viewer${Math.floor(Math.random() * 8999 + 1000)}`
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`cineroom_${code}_name`, name)
      sessionStorage.setItem(`cineroom_${code}_isHost`, 'false')
    }

    router.push(`/room/${code}`)
  }

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1)
    if (!/^[0-9]?$/.test(char)) return

    if (index === 1) {
      setDigit1(char)
      if (char) document.getElementById('digit-2')?.focus()
    } else if (index === 2) {
      setDigit2(char)
      if (char) document.getElementById('digit-3')?.focus()
    } else if (index === 3) {
      setDigit3(char)
      if (char) document.getElementById('digit-4')?.focus()
    } else if (index === 4) {
      setDigit4(char)
    }
    setJoinError('')
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 1) {
      document.getElementById(`digit-${index - 1}`)?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[#0071e3] selection:text-white">
      {/* Subtle Top Ambient Lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[240px] bg-gradient-to-b from-white/[0.04] to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-14 px-4 sm:px-8 flex items-center justify-between z-20 border-b border-white/[0.07] liquid-glass-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white text-black font-black flex items-center justify-center text-xs shadow-sm">
            C
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            CineRoom <span className="text-[10px] font-mono text-zinc-500 font-normal">Cloud 2.0</span>
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
          <span>Supabase Realtime Cloud</span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 z-10 text-center max-w-xl mx-auto w-full">
        {/* Antigravity 2.0 Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-300 mb-5">
          <ShieldCheck className="w-3 h-3 text-[#0071e3]" />
          <span>Enterprise Realtime Sync • Antigravity 2.0 Style</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-white mb-2">
          Watch movies together, <span className="text-zinc-400 font-normal">in perfect sync.</span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto mb-6 leading-relaxed">
          Cloud synchronized broadcast with 4-digit room passcodes, host authority, and Zoom-style viewer video cards.
        </p>

        {/* iOS Segmented Pill Toggle */}
        <div className="w-full max-w-xs p-1 rounded-xl liquid-glass-subtle border border-white/[0.08] flex gap-1 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'create'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Crown className="w-3 h-3" />
            <span>Create Room</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'join'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3 h-3" />
            <span>Join with Code</span>
          </button>
        </div>

        {/* CREATE ROOM CARD */}
        {activeTab === 'create' && (
          <form
            onSubmit={handleCreateRoom}
            className="w-full liquid-glass p-5 sm:p-7 rounded-2xl space-y-4 text-left border border-white/[0.09]"
          >
            {/* Generated 4-Digit Room Code */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">
                  Generated Room Code
                </span>
                <span
                  suppressHydrationWarning
                  className="text-2xl sm:text-3xl font-mono font-semibold text-white tracking-widest"
                >
                  {generatedCode}
                </span>
              </div>

              <button
                type="button"
                onClick={regenerateCode}
                className="btn-glass px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 text-zinc-300 font-medium"
                title="Generate another code"
              >
                <RefreshCw className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {/* Host Display Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-[#0071e3]" />
                Host Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Your name (e.g. Alex)"
                maxLength={24}
                className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Select Stream */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-zinc-400" />
                  Select Stream
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomStream(!isCustomStream)}
                  className="text-[11px] text-[#0071e3] hover:underline font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {isCustomStream ? 'Presets' : 'Custom URL'}
                </button>
              </div>

              {isCustomStream ? (
                <div className="space-y-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.06]">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Stream Title"
                    className="w-full liquid-glass-input rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Paste .m3u8 (HLS) or .mp4 link"
                    className="w-full liquid-glass-input rounded-lg px-3 py-1.5 text-xs outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {CURATED_MOVIES.map((movie) => (
                    <button
                      type="button"
                      key={movie.title}
                      onClick={() => setSelectedMovie(movie)}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        selectedMovie.title === movie.title
                          ? 'border-[#0071e3] bg-[#0071e3]/10 text-white'
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <div className="text-xs font-medium truncate text-white">{movie.title}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{movie.genre}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Launch CTA */}
            <button
              type="submit"
              className="w-full py-2.5 btn-action font-medium text-xs rounded-xl flex items-center justify-center gap-2 mt-1"
            >
              <span>Start Cloud Screening</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* JOIN ROOM CARD (Apple Passcode Style) */}
        {activeTab === 'join' && (
          <form
            onSubmit={handleJoinRoom}
            className="w-full liquid-glass p-5 sm:p-7 rounded-2xl space-y-5 text-left border border-white/[0.09]"
          >
            {/* 4 Digit Passcode Entry */}
            <div className="space-y-2 text-center">
              <span className="text-[11px] font-medium text-zinc-400 block">
                Enter 4-Digit Room Passcode
              </span>

              <div className="flex justify-center gap-2 sm:gap-3">
                {[
                  { id: 'digit-1', val: digit1, set: 1 },
                  { id: 'digit-2', val: digit2, set: 2 },
                  { id: 'digit-3', val: digit3, set: 3 },
                  { id: 'digit-4', val: digit4, set: 4 },
                ].map(({ id, val, set }) => (
                  <input
                    key={id}
                    id={id}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleDigitChange(set, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(set, e)}
                    className="w-12 h-14 sm:w-14 sm:h-16 bg-white/[0.04] border border-white/[0.12] focus:border-[#0071e3] rounded-xl text-center text-xl sm:text-2xl font-mono font-semibold text-white outline-none transition-all shadow-inner"
                    autoFocus={set === 1}
                  />
                ))}
              </div>

              {joinError && (
                <p className="text-red-400 text-[11px] font-medium">{joinError}</p>
              )}
            </div>

            {/* Viewer Display Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-zinc-400" />
                Your Display Name
              </label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={24}
                className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Join CTA */}
            <button
              type="submit"
              className="w-full py-2.5 btn-action font-medium text-xs rounded-xl flex items-center justify-center gap-2 mt-1"
            >
              <span>Join Screening</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="py-4 px-6 border-t border-white/[0.06] text-center text-[11px] text-zinc-500 z-10">
        <p>CineRoom Cloud 2.0 • Antigravity Liquid Glass Interface</p>
      </footer>
    </div>
  )
}
