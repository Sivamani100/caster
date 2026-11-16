'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Smile } from 'lucide-react'
import { useCineRoomStore } from '@/lib/store'
import { getSocket } from '@/lib/socket'

const REACTIONS = ['❤️', '😂', '😮', '👏', '🔥', '🎉', '😍', '💯']

interface ChatPanelProps {
  roomId: string
}

export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { messages, addMessage, myId, myName, myColor, addReaction } = useCineRoomStore()
  const socket = getSocket()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Listen for chat events
  useEffect(() => {
    socket.on('chat-message', (msg) => {
      addMessage(msg)
    })
    socket.on('reaction', (reaction) => {
      addReaction(reaction)
    })
    return () => {
      socket.off('chat-message')
      socket.off('reaction')
    }
  }, [socket, addMessage, addReaction])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !socket.connected) return
    socket.emit('chat-message', { roomId, message: text })
    setInput('')
    inputRef.current?.focus()
  }

  const sendReaction = (emoji: string) => {
    socket.emit('reaction', { roomId, emoji })
    setShowEmoji(false)
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-[#13131f] rounded-xl border border-[#1e1e30] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-white font-semibold text-sm">Live Chat</span>
        </div>
        <span className="text-gray-500 text-xs">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm space-y-2">
            <span className="text-3xl">💬</span>
            <p>Be the first to say something!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === myId
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1"
                style={{ backgroundColor: msg.color + '33', color: msg.color, border: `2px solid ${msg.color}` }}
              >
                {msg.name.charAt(0).toUpperCase()}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isMe && (
                  <span className="text-xs font-medium" style={{ color: msg.color }}>
                    {msg.name}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words ${
                    isMe
                      ? 'bg-gradient-to-br from-[#e94560] to-[#8b5cf6] text-white rounded-tr-sm'
                      : 'bg-[#1e1e30] text-gray-200 rounded-tl-sm'
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-xs text-gray-600">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reaction bar (floating) */}
      {showEmoji && (
        <div className="flex gap-2 px-4 py-2 border-t border-[#1e1e30] bg-[#0d0d1a] flex-wrap">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-[#1e1e30] bg-[#0d0d1a]">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className={`text-gray-400 hover:text-[#e94560] transition-colors flex-shrink-0 ${showEmoji ? 'text-[#e94560]' : ''}`}
        >
          <Smile className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Say something..."
          className="flex-1 bg-[#1e1e30] border border-[#2a2a40] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#e94560] transition-colors placeholder:text-gray-600"
          maxLength={500}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-gradient-to-r from-[#e94560] to-[#8b5cf6] p-2 rounded-lg text-white disabled:opacity-40 hover:opacity-90 transition-all active:scale-95 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
