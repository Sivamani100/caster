'use client'

import { useState } from 'react'

interface JoinModalProps {
  onJoin: (name: string) => void
  roomId: string
}

export default function JoinModal({ onJoin, roomId }: JoinModalProps) {
  const [name, setName] = useState('')

  const handleJoin = () => {
    const finalName = name.trim() || `Viewer${Math.floor(Math.random() * 9999)}`
    onJoin(finalName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-[#1e1e30] rounded-2xl p-8 w-full max-w-sm mx-4 space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">🎬</span>
            <h1 className="text-2xl font-black text-white">
              Cine<span className="text-[#e94560]">Room</span>
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Joining <span className="text-[#8b5cf6] font-mono">#{roomId}</span>
          </p>
        </div>

        {/* Name input */}
        <div className="space-y-2">
          <label className="text-gray-300 text-sm font-medium">Your display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. CinemaLover42"
            maxLength={30}
            className="w-full bg-[#1e1e30] border border-[#2a2a40] text-white rounded-xl px-4 py-3 outline-none focus:border-[#e94560] transition-colors placeholder:text-gray-600"
            autoFocus
          />
          <p className="text-gray-600 text-xs">Leave blank for a random name</p>
        </div>

        {/* Features list */}
        <div className="space-y-2">
          {[
            { icon: '🎥', text: 'Watch the live stream together' },
            { icon: '💬', text: 'Chat in real-time' },
            { icon: '👥', text: 'See other viewers (optional camera)' },
            { icon: '🎭', text: 'Send live reactions' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-400">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          className="w-full py-3 bg-gradient-to-r from-[#e94560] to-[#8b5cf6] rounded-xl font-bold text-white text-base hover:opacity-90 transition-all hover:scale-105 active:scale-95"
        >
          Enter the Room 🍿
        </button>
      </div>
    </div>
  )
}
