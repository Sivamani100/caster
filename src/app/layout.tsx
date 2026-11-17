import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Casterr – Realtime Watch Party',
  description: 'Synchronized live video streaming with host controls, real-time webcam feeds, and instant chat.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`}>
      <body className="bg-black text-white font-sans antialiased selection:bg-[#0071e3] selection:text-white">
        {children}
      </body>
    </html>
  )
}
