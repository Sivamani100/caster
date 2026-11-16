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

const EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d|\ufe0f|\s)+$/u

function isPureEmoji(str: string): boolean {
  if (!str) return false
  const trimmed = str.trim()
  if (!trimmed) return false
  return EMOJI_REGEX.test(trimmed) && trimmed.length <= 16
}

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

  // Listen to incoming messages and show a floating pill on screen
  useEffect(() => {
    if (messages.length === 0) return
    const latest = messages[messages.length - 1]
    if (!latest || latest.is_system) return

    const newPill: FloatingMessage = {
      ...latest,
      dismissAt: Date.now() + 6000, // Show for 6 seconds
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
  const isEmojiMessage = isPureEmoji(activePill.message)

  return (
    <div
      className={`absolute left-3 sm:left-4 z-30 pointer-events-none select-none transition-all duration-300 ease-out ${
        showControls ? 'bottom-14 sm:bottom-16' : 'bottom-3 sm:bottom-4'
      }`}
    >
      {/* BIG EMOJI REACTION PILL */}
      {isEmojiMessage ? (
        <div
          key={activePill.id}
          onClick={() => handleClick(activePill)}
          className="animate-bounce pointer-events-auto cursor-pointer flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-3xl border border-white/30 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-300 hover:scale-110 active:scale-95 hover:border-white/50"
          title={`${activePill.name}: ${activePill.message}`}
        >
          {/* Avatar Circle & Name */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: nameColor }}
            >
              {activePill.name ? activePill.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span
              className="text-xs font-semibold tracking-tight"
              style={{ color: nameColor }}
            >
              {isMe ? 'You' : activePill.name}:
            </span>
          </div>

          {/* BIG EMOJI DISPLAY */}
          <span className="text-3xl sm:text-4xl filter drop-shadow-[0_2px_10px_rgba(255,255,255,0.35)] leading-none inline-block">
            {activePill.message}
          </span>
        </div>
      ) : (
        /* Regular Message Single-Line Pill (Truncated with ...) */
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
      )}
    </div>
  )
}
