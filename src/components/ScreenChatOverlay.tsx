'use client'

import { useState, useEffect } from 'react'
import { useCineRoomStore, ChatMessage } from '@/lib/store'

interface FloatingMessage extends ChatMessage {
  dismissAt: number
}

interface ScreenChatOverlayProps {
  showControls?: boolean
  onMessageClick?: () => void
}

const NAME_COLORS = [
  '#38bdf8', // Vibrant Sky Blue
  '#34d399', // Emerald Green
  '#fbbf24', // Amber Gold
  '#a78bfa', // Lavender Purple
  '#f472b6', // Coral Pink
  '#fb923c', // Warm Orange
  '#2dd4bf', // Teal Cyan
]

function getNameColor(name: string, isMe: boolean): string {
  if (isMe) return '#3898ec'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % NAME_COLORS.length
  return NAME_COLORS[index]
}

export default function ScreenChatOverlay({ showControls = false, onMessageClick }: ScreenChatOverlayProps) {
  const { messages, myId } = useCineRoomStore()
  const [activePill, setActivePill] = useState<FloatingMessage | null>(null)

  // Listen to incoming messages and show a single floating pill on screen
  useEffect(() => {
    if (messages.length === 0) return
    const latest = messages[messages.length - 1]
    if (!latest || latest.is_system) return

    const newPill: FloatingMessage = {
      ...latest,
      dismissAt: Date.now() + 7000, // Show for 7 seconds
    }

    setActivePill(newPill)
  }, [messages])

  // Periodic cleanup of expired floating pill
  useEffect(() => {
    const timer = setInterval(() => {
      if (activePill && activePill.dismissAt <= Date.now()) {
        setActivePill(null)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [activePill])

  const handleClick = (msg: ChatMessage) => {
    if (onMessageClick) {
      onMessageClick()
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('focus-chat-input'))
      window.dispatchEvent(new CustomEvent('open-fullscreen-chat'))
    }
  }

  if (!activePill) {
    return null
  }

  const isMe = activePill.user_id === myId
  const nameColor = getNameColor(activePill.name || 'User', isMe)

  return (
    <div
      className={`absolute left-3 sm:left-4 z-30 pointer-events-none select-none transition-all duration-300 ease-out ${
        showControls ? 'bottom-14 sm:bottom-16' : 'bottom-3 sm:bottom-4'
      }`}
    >
      {/* Fully rounded, single-line, max-200px box with ellipsis ... */}
      <div
        key={activePill.id}
        onClick={() => handleClick(activePill)}
        className="animate-float-in pointer-events-auto cursor-pointer flex items-center gap-1.5 max-w-[200px] px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white shadow-2xl transition-all duration-200 hover:bg-black/80 hover:scale-[1.03] hover:border-white/35 overflow-hidden"
        title={`${activePill.name}: ${activePill.message} (Click to reply)`}
      >
        {/* Compact Avatar Circle */}
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white shadow-sm"
          style={{ backgroundColor: nameColor }}
        >
          {activePill.name ? activePill.name.charAt(0).toUpperCase() : 'U'}
        </div>

        {/* Single-line text: Name in different color + Message truncated with ... */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          <span
            className="text-[11px] font-semibold flex-shrink-0 tracking-tight"
            style={{ color: nameColor }}
          >
            {isMe ? 'You' : activePill.name}:
          </span>
          <span className="text-[11px] text-zinc-100 font-normal truncate overflow-hidden text-ellipsis whitespace-nowrap">
            {activePill.message}
          </span>
        </div>
      </div>
    </div>
  )
}
