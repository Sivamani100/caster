import Link from 'next/link'
import { Film, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen w-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#0071e3]/15 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 liquid-glass p-8 rounded-3xl max-w-md w-full text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-[#0071e3] shadow-lg">
          <Film className="w-8 h-8" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-white">404 — Screen Empty</h1>
        <p className="text-sm text-zinc-400">
          The cinema room or page you are looking for does not exist or has ended.
        </p>

        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-sm font-medium transition-all shadow-lg active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Return to Lobby</span>
        </Link>
      </div>
    </div>
  )
}
