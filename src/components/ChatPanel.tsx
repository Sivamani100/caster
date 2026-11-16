'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { useSupabaseRoom } from '@/lib/useSupabaseRoom'

const REACTIONS = ['🍿', '❤️', '🔥', '😂', '👏', '💯']

const EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d|\ufe0f|\s)+$/u

function isPureEmoji(str: string): boolean {
  if (!str) return false
  const trimmed = str.trim()
  if (!trimmed) return false
  return EMOJI_REGEX.test(trimmed) && trimmed.length <= 16
}

interface ChatPanelProps {
  roomId: string
  onClose?: () => void
  isFullscreen?: boolean
}

export default function ChatPanel({ roomId, onClose, isFullscreen = false }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, myId, presenceUsers } = useCineRoomStore()
  const { sendChatMessage, sendReaction } = useSupabaseRoom()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when user clicks on an on-screen message pill
  useEffect(() => {
    const handleFocusInput = () => {
      inputRef.current?.focus()
    }
    window.addEventListener('focus-chat-input', handleFocusInput)
    return () => window.removeEventListener('focus-chat-input', handleFocusInput)
  }, [])

  const handleReactionClick = async (emoji: string) => {
    sendReaction(emoji)
    await sendChatMessage(emoji)
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    await sendChatMessage(text)
    inputRef.current?.focus()
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex flex-col h-full liquid-glass rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12]">
      {/* Clean Glassmorphic Header */}
      <div className="h-14 px-5 border-b border-white/[0.08] bg-white/[0.03] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0071e3] shadow-[0_0_10px_#0071e3]" />
          <span className="text-white font-semibold text-sm tracking-tight">Chat Room</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300 font-mono bg-white/[0.08] px-3 py-1 rounded-full border border-white/[0.1] shadow-sm">
            {Math.max(1, presenceUsers.length || 1)} online
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Normal Clean Scrollbar View with Larger, Roomy, Legible Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 text-sm gap-2">
            <span className="text-2xl">🍿</span>
            <span className="text-white font-medium text-sm">Movie Room Chat</span>
            <span className="text-xs text-zinc-500 max-w-[200px]">Send reactions and chat in real-time with everyone watching.</span>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.is_system) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="text-xs text-zinc-300 bg-white/[0.07] px-3 py-1 rounded-full border border-white/[0.08] shadow-sm">
                  {msg.message}
                </span>
              </div>
            )
          }

          const isMe = msg.user_id === myId

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              {!isMe && (
                <span className="text-xs text-zinc-400 font-medium mb-1 px-1">
                  {msg.name}
                </span>
              )}
              {isPureEmoji(msg.message) ? (
                <div className="py-1 px-1 text-3xl sm:text-4xl select-none hover:scale-125 transition-transform animate-float-in drop-shadow-md">
                  {msg.message}
                </div>
              ) : (
                <div
                  className={`px-4.5 py-3 rounded-2xl text-[14.5px] sm:text-[15px] max-w-[85%] break-words leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-[#0071e3] text-white rounded-br-sm border border-blue-400/30'
                      : 'bg-white/[0.08] text-zinc-100 rounded-bl-sm border border-white/[0.12] backdrop-blur-md'
                  }`}
                >
                  {msg.message}
                </div>
              )}
              {msg.created_at && (
                <span className="text-[10px] text-zinc-500 mt-1 px-1 font-mono">
                  {formatTime(msg.created_at)}
                </span>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Subtle Reactions Bar */}
      <div className="flex items-center justify-center gap-2.5 px-3 py-2.5 border-t border-white/[0.06] bg-black/40 flex-shrink-0">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className="text-lg hover:scale-130 active:scale-95 transition-transform p-1.5 rounded-xl hover:bg-white/[0.08]"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Increased, Roomy Text & Input Field (Antigravity 2.0 / Apple iOS Style) */}
      <form onSubmit={handleSend} className="p-4 sm:p-4.5 border-t border-white/[0.08] bg-black/60 backdrop-blur-xl flex items-center gap-3 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message to the room..."
          className="flex-1 h-14 px-5 py-3.5 text-[15px] rounded-2xl liquid-glass-input text-white placeholder:text-zinc-400 outline-none font-normal tracking-wide shadow-inner"
          maxLength={400}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="h-14 w-14 rounded-2xl btn-action flex items-center justify-center disabled:opacity-30 transition-all flex-shrink-0 shadow-xl hover:scale-105 active:scale-95"
          title="Send message"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </form>
    </div>
  )
}
