'use client'

import { useCineRoomStore } from '@/lib/store'

export default function ReactionOverlay() {
  const { reactions } = useCineRoomStore()

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {reactions.map((r, i) => (
        <div
          key={r.id || `${i}-${Date.now()}`}
          className="absolute bottom-20 transition-all duration-700 animate-bounce"
          style={{
            left: `${20 + ((i * 14) % 60)}%`,
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl filter drop-shadow-lg scale-110">
              {r.emoji}
            </span>
            <span className="text-[9px] font-medium text-white px-1.5 py-0.2 rounded-full glass-capsule">
              {r.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
