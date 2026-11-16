import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white">
      <div className="text-center space-y-8 px-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e94560] to-[#8b5cf6] flex items-center justify-center text-2xl">
            🎬
          </div>
          <h1 className="text-5xl font-black tracking-tight">
            Cine<span className="text-[#e94560]">Room</span>
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-md mx-auto">
          Watch movies together, in real-time. Chat, react, and see your friends — just like being in the same room.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {['🎥 Live Streaming', '💬 Live Chat', '👥 See Who\'s Watching', '🎭 Synchronized Playback'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full bg-white/10 text-gray-300">{f}</span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/room/main"
            className="px-8 py-4 bg-gradient-to-r from-[#e94560] to-[#8b5cf6] rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-105 active:scale-95"
          >
            Join the Screening Room →
          </Link>
        </div>
        <p className="text-gray-600 text-sm">No account needed. Just click and watch.</p>
      </div>
    </main>
  )
}
