'use client'

import { useCineRoomStore } from '@/lib/store'

export default function ReactionOverlay() {
  const { reactions } = useCineRoomStore()

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 animate-bounce"
          style={{
            left: `${10 + Math.random() * 80}%`,
            animationDuration: '0.6s',
            animationIterationCount: '3',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl filter drop-shadow-lg">{r.emoji}</span>
            <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">{r.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
