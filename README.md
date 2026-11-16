# caster

> **CineRoom (Caster)** — Ultra-low latency collaborative cinema and synchronized watch party platform built with Next.js 14, Antigravity 2.0 Liquid Glassmorphism, WebRTC mesh video/audio, and Supabase real-time sync.

---

## ✨ Features

- 🎬 **Synchronized HLS & Video Streaming** — Millisecond-level synchronized video playback with drift correction, live scrubber, and custom playback controls.
- 💎 **Antigravity 2.0 Liquid Glass UI** — Ultra-refined, distraction-free cinema aesthetic featuring multi-layered backdrop blur, micro-borders, and floating interactive docks.
- 💬 **Adaptive On-Screen Chat Pill & Big Emojis** — Intelligent floating chat badge anchored to the bottom stage, automatically dodging player controls, truncating long messages with `...`, and popping up large expressive emoji reactions (`🍿`, `🔥`, `❤️`).
- 🗂️ **Integrated 1/4 Screen Cinema Drawer** — Expanding full-height chat sidebar dynamically reflowing the video stage to 75% without obscuring subtitles or video framing.
- 📹 **Customizable Facecam Overlay** — Real-time WebRTC facecam with adjustable opacity (15% - 100%), variable size scaling (120px - 340px), shape morphing (squircle, rounded, circle), mirror flip, and live mic status indicators.
- 🎙️ **Peer-to-Peer Voice & WebRTC Mesh** — Low-latency audio/video mesh powered by W3C Perfect Negotiation, STUN + Metered TURN relay fallback, and persistent headless remote audio.
- 🩺 **WebRTC Real-Time Diagnostics Badge** — Built-in visual network health indicator with ICE connection states, active peer monitor, and one-click audio resume / ICE restart.
- ⚡ **Supabase Real-Time Engine** — Robust state synchronization for room metadata, playback time, play/pause state, and message persistence.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS + Antigravity 2.0 Glassmorphic Tokens (`backdrop-filter`, luminous borders)
- **Icons**: Lucide React
- **State Management**: Zustand
- **Media Engine**: HLS.js
- **Real-Time Sync**: Supabase Realtime
- **Voice / Video**: Native WebRTC (W3C Perfect Negotiation + Metered TURN Fallback)

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 18+ installed
- A Supabase project (for real-time persistence)

### 2. Installation

Clone the repository and install root and server dependencies:

```bash
git clone https://github.com/Sivamani100/caster.git
cd caster

# Install frontend dependencies
npm install

# Install signaling server dependencies
cd server
npm install
cd ..
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Running the Application

You can launch both the Next.js app and the Socket.io signaling server simultaneously:

#### Quick Start (Windows)
Double-click `run-all.bat` or run:
```cmd
run-all.bat
```

#### Manual Start
In Terminal 1 (Signaling Server):
```bash
cd server
node index.js
# Signaling server runs on http://localhost:3001
```

In Terminal 2 (Next.js Application):
```bash
npm run dev
# Application runs on http://localhost:3000
```

Open your browser and navigate to `http://localhost:3000` to start or join a screening room!

---

## 📐 Architecture Overview

```
caster/
├── src/
│   ├── app/
│   │   ├── globals.css              # Antigravity 2.0 Liquid Glass styling tokens
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Modern CineRoom Landing & Room Creator
│   │   └── room/[roomId]/page.tsx   # Cinema Stage & responsive 1/4 Chat drawer
│   ├── components/
│   │   ├── VideoPlayer.tsx          # Synced HLS video player & bottom AV controls
│   │   ├── ScreenChatOverlay.tsx    # Adaptive bottom-docked 200px pill notification
│   │   ├── FacecamOverlay.tsx       # Floating web-cam stage with opacity & size controls
│   │   ├── ChatPanel.tsx            # Full chat drawer with room input field
│   │   ├── ViewerTiles.tsx          # Grid / list of connected room participants
│   │   └── JoinModal.tsx            # Initial user profile entry modal
│   ├── hooks/
│   │   └── useWebRTC.ts             # WebRTC mesh peer connection management
│   └── lib/
│       ├── store.ts                 # Zustand client state store
│       ├── supabase.ts              # Supabase client initialization
│       └── useSupabaseRoom.tsx      # Real-time room sync hook
├── server/
│   └── index.js                     # Socket.io signaling & presence relay
├── public/                          # Static assets and icons
└── package.json
```

---

## 📄 License

MIT © [Sivamani100](https://github.com/Sivamani100)
