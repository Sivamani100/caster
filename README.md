# 🎬 CineRoom — Live Movie Watching Platform

Watch movies together in real-time with friends. Features live streaming, group chat, and Zoom-style viewer tiles.

## Features

- 🎥 **HLS Live Streaming** — Watch synchronized live streams
- 💬 **Real-time Chat** — Private room chat with emoji reactions
- 👥 **Viewer Tiles** — See who's watching (Zoom-style webcam grid)
- 🎭 **Live Reactions** — Floating emoji reactions
- 🔒 **Room-based** — Each room is private and isolated

## Setup & Run

### 1. Install dependencies
```bash
npm install
cd server && npm install && cd ..
```

### 2. Start the Socket.io server (in one terminal)
```bash
cd server
node index.js
# Runs on http://localhost:3001
```

### 3. Start the Next.js app (in another terminal)
```bash
npm run dev
# Runs on http://localhost:3000
```

### 4. Open in browser
Go to: http://localhost:3000

Click "Join the Screening Room" or directly visit:
http://localhost:3000/room/main

Share the room URL with friends to watch together!

## Architecture

- **Next.js 14** (App Router) — Frontend
- **Socket.io** — Real-time chat, presence, signaling
- **WebRTC / simple-peer** — P2P webcam streams
- **HLS.js** — Live video streaming
- **Zustand** — Client state management
- **Tailwind CSS** — Styling
