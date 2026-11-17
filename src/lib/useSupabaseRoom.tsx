'use client'

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCineRoomStore, MovieInfo, ChatMessage, UserPresence } from '@/lib/store'
import { RealtimeChannel } from '@supabase/supabase-js'

interface WebRTCDiagnosticInfo {
  targetId: string
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  signalingState: RTCSignalingState
  hasAudioTrack: boolean
  hasVideoTrack: boolean
  isPolite: boolean
}

interface SupabaseRoomContextType {
  sendPlaybackControl: (playing: boolean, time: number, rate?: number) => Promise<void>
  sendPlaybackHeartbeat: (time: number, isPlaying: boolean, rate?: number) => void
  requestPlaybackSync: () => void
  calibrateClockOffset: () => Promise<void>
  sendMovieChange: (movie: MovieInfo) => Promise<void>
  sendChatMessage: (text: string) => Promise<void>
  sendReaction: (emoji: string) => void
  startMedia: (cameraOn: boolean, micOn: boolean) => Promise<MediaStream | null>
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  restartWebRTC: () => void
  getDiagnostics: () => WebRTCDiagnosticInfo[]
}

const SupabaseRoomContext = createContext<SupabaseRoomContextType | null>(null)

// Comprehensive STUN and free TURN fallback configuration
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Metered.ca Open Relay free public WebRTC TURN servers
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

// Add custom TURN credentials if provided via environment
if (process.env.NEXT_PUBLIC_TURN_URL) {
  DEFAULT_ICE_SERVERS.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
  })
}

interface PeerEntry {
  pc: RTCPeerConnection
  makingOffer: boolean
  ignoreOffer: boolean
  isSettingRemoteAnswerPending: boolean
  candidateQueue: RTCIceCandidateInit[]
  isPolite: boolean
}

/**
 * Headless Remote Audio Renderer:
 * Ensures all connected peers' audio streams play uninterruptedly,
 * using an unthrottled fixed offscreen container with persistent
 * gesture listeners to safely unlock browser autoplay policies.
 */
function RemoteAudioRenderer() {
  const { streams, myId } = useCineRoomStore()
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Continuously unlock browser audio autoplay upon user interaction
  useEffect(() => {
    const unlockAutoplay = () => {
      audioRefs.current.forEach((el) => {
        if (el && el.paused) {
          el.play().catch(() => {})
        }
      })
    }

    window.addEventListener('pointerdown', unlockAutoplay)
    window.addEventListener('click', unlockAutoplay)
    window.addEventListener('touchstart', unlockAutoplay)
    window.addEventListener('keydown', unlockAutoplay)

    return () => {
      window.removeEventListener('pointerdown', unlockAutoplay)
      window.removeEventListener('click', unlockAutoplay)
      window.removeEventListener('touchstart', unlockAutoplay)
      window.removeEventListener('keydown', unlockAutoplay)
    }
  }, [])

  const remoteEntries = Object.entries(streams).filter(([id]) => id !== myId)

  return (
    <div
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0.001,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {remoteEntries.map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          playsInline
          ref={(el) => {
            if (el) {
              audioRefs.current.set(peerId, el)
              if (el.srcObject !== stream) {
                el.srcObject = stream
              }
              el.volume = 1.0
              el.play().catch((err) => {
                console.warn(`[WebRTC Audio] Peer ${peerId} audio waiting for gesture:`, err.message)
              })
            } else {
              audioRefs.current.delete(peerId)
            }
          }}
        />
      ))}
    </div>
  )
}

export function SupabaseRoomProvider({ roomId, children }: { roomId: string; children: React.ReactNode }) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isSubscribedRef = useRef(false)
  const joinedAtRef = useRef(Date.now())
  const peersRef = useRef<Map<string, PeerEntry>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())

  const {
    myId,
    setMyId,
    myName,
    isHost,
    setHostInfo,
    setMovie,
    setIsPlaying,
    setPlaybackTime,
    setPresenceUsers,
    addMessage,
    setMessages,
    addReaction,
    hasVideo,
    hasAudio,
    setHasVideo,
    setHasAudio,
    setLocalStream,
    setStream,
    removeStream,
    setWebRTCStatus,
    setActivePeersCount,
    setSyncDriftMs,
    setNtpOffsetMs,
    setNtpRttMs,
    setIceCandidateType,
    setRoomConnected,
  } = useCineRoomStore()

  const myIdRef = useRef(myId)
  myIdRef.current = myId
  const myNameRef = useRef(myName)
  myNameRef.current = myName
  const isHostRef = useRef(isHost)
  isHostRef.current = isHost
  const hasAudioRef = useRef(hasAudio)
  hasAudioRef.current = hasAudio
  const hasVideoRef = useRef(hasVideo)
  hasVideoRef.current = hasVideo

  // Update aggregated store status across all peers
  const updateAggregatedStatus = useCallback(() => {
    const peers = Array.from(peersRef.current.values())
    setActivePeersCount(peers.length)

    if (peers.length === 0) {
      setWebRTCStatus('disconnected')
      return
    }

    const hasConnected = peers.some(
      (p) => p.pc.iceConnectionState === 'connected' || p.pc.iceConnectionState === 'completed'
    )
    const hasChecking = peers.some(
      (p) => p.pc.iceConnectionState === 'checking' || p.pc.connectionState === 'connecting'
    )
    const hasFailed = peers.some(
      (p) => p.pc.iceConnectionState === 'failed' || p.pc.connectionState === 'failed'
    )

    if (hasConnected) {
      setWebRTCStatus('connected')
    } else if (hasChecking) {
      setWebRTCStatus('connecting')
    } else if (hasFailed) {
      setWebRTCStatus('failed')
    } else {
      setWebRTCStatus('disconnected')
    }
  }, [setActivePeersCount, setWebRTCStatus])

  /**
   * Optimize RTP Senders for Studio Voice & 720p/1080p Video
   */
  const optimizeSenders = useCallback((pc: RTCPeerConnection) => {
    pc.getSenders().forEach((s) => {
      if (s.track?.kind === 'video' && s.setParameters) {
        try {
          const p = s.getParameters()
          if (!p.encodings || p.encodings.length === 0) p.encodings = [{}]
          p.encodings[0].maxBitrate = 1500000 // 1.5 Mbps for 720p HD
          s.setParameters(p).catch(() => {})
        } catch {}
      } else if (s.track?.kind === 'audio' && s.setParameters) {
        try {
          const p = s.getParameters()
          if (!p.encodings || p.encodings.length === 0) p.encodings = [{}]
          p.encodings[0].maxBitrate = 96000 // 96 kbps Opus studio voice
          s.setParameters(p).catch(() => {})
        } catch {}
      }
    })
  }, [])

  /**
   * Explicit renegotiation trigger: generates local description and broadcasts offer
   */
  const renegotiatePeer = useCallback(async (entry: PeerEntry, targetPeerId: string) => {
    try {
      entry.makingOffer = true
      await entry.pc.setLocalDescription()
      if (channelRef.current && entry.pc.localDescription) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: {
            type: 'description',
            from: myIdRef.current,
            to: targetPeerId,
            description: {
              type: entry.pc.localDescription.type,
              sdp: entry.pc.localDescription.sdp,
            },
          },
        })
      }
    } catch (err) {
      console.warn(`[WebRTC] Renegotiate peer ${targetPeerId} error:`, err)
    } finally {
      entry.makingOffer = false
    }
  }, [])

  /**
   * Polite Peer WebRTC Connection Factory:
   * Employs W3C Perfect Negotiation to prevent offer glares,
   * maintains persistent multi-track MediaStreams per peer,
   * buffers ICE candidates until remote description is set,
   * and auto-recovers from ICE disconnects.
   */
  const getOrCreatePeer = useCallback((targetPeerId: string): PeerEntry => {
    if (peersRef.current.has(targetPeerId)) {
      return peersRef.current.get(targetPeerId)!
    }

    // Deterministic role: smaller ID is impolite initiator, larger ID is polite
    const isPolite = myIdRef.current.localeCompare(targetPeerId) > 0

    const pc = new RTCPeerConnection({
      iceServers: DEFAULT_ICE_SERVERS,
    })

    const peerEntry: PeerEntry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      candidateQueue: [],
      isPolite,
    }

    peersRef.current.set(targetPeerId, peerEntry)

    // Add audio and video transceivers immediately so SDP offers/answers include media sections
    pc.addTransceiver('audio', { direction: 'sendrecv' })
    pc.addTransceiver('video', { direction: 'sendrecv' })

    // Attach local media tracks if active to the pre-created transceivers
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const transceiver = pc
          .getTransceivers()
          .find((t) => t.receiver.track.kind === track.kind)
        if (transceiver && transceiver.sender) {
          transceiver.direction = 'sendrecv'
          transceiver.sender.replaceTrack(track).catch(() => {})
        }
      })
      optimizeSenders(pc)
    }

    // Perfect Negotiation onnegotiationneeded handler
    pc.onnegotiationneeded = async () => {
      try {
        peerEntry.makingOffer = true
        await pc.setLocalDescription()
        if (channelRef.current && pc.localDescription) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: {
              type: 'description',
              from: myIdRef.current,
              to: targetPeerId,
              description: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            },
          })
        }
      } catch (err) {
        console.error(`[WebRTC] Perfect negotiation error with ${targetPeerId}:`, err)
      } finally {
        peerEntry.makingOffer = false
      }
    }

    // Local ICE candidate generation with candidate type detection
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candStr = event.candidate.candidate || ''
        if (candStr.includes('typ relay')) {
          setIceCandidateType('relay')
        } else if (candStr.includes('typ srflx')) {
          setIceCandidateType('srflx')
        } else if (candStr.includes('typ host')) {
          setIceCandidateType('host')
        }

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: {
              type: 'candidate',
              from: myIdRef.current,
              to: targetPeerId,
              candidate: event.candidate.toJSON(),
            },
          })
        }
      }
    }

    // Remote Track Arrival - Unified multi-track MediaStream management
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received ${event.track.kind} track from ${targetPeerId}`)
      let peerStream = remoteStreamsRef.current.get(targetPeerId)
      if (!peerStream) {
        peerStream = new MediaStream()
        remoteStreamsRef.current.set(targetPeerId, peerStream)
      }

      // Replace existing track of same kind if already present
      const existingTrack = peerStream.getTracks().find((t) => t.kind === event.track.kind)
      if (existingTrack && existingTrack.id !== event.track.id) {
        peerStream.removeTrack(existingTrack)
      }
      if (!peerStream.getTracks().some((t) => t.id === event.track.id)) {
        peerStream.addTrack(event.track)
      }

      const syncStream = () => {
        const fresh = new MediaStream(peerStream!.getTracks())
        setStream(targetPeerId, fresh)
      }

      event.track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted (${event.track.kind}) from ${targetPeerId}`)
        syncStream()
      }

      event.track.onmute = () => {
        console.log(`[WebRTC] Track muted (${event.track.kind}) from ${targetPeerId}`)
        syncStream()
      }

      event.track.onended = () => {
        console.log(`[WebRTC] Track ended (${event.track.kind}) from ${targetPeerId}`)
        peerStream?.removeTrack(event.track)
        syncStream()
      }

      syncStream()
    }

    // Connection state & ICE recovery
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state (${targetPeerId}):`, pc.iceConnectionState)
      updateAggregatedStatus()
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        try {
          pc.restartIce()
        } catch (err) {
          console.warn(`[WebRTC] ICE restart failed for ${targetPeerId}:`, err)
        }
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state (${targetPeerId}):`, pc.connectionState)
      updateAggregatedStatus()
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce()
        } catch {}
      } else if (pc.connectionState === 'closed') {
        remoteStreamsRef.current.delete(targetPeerId)
        removeStream(targetPeerId)
        peersRef.current.delete(targetPeerId)
        updateAggregatedStatus()
      }
    }

    updateAggregatedStatus()
    return peerEntry
  }, [setStream, removeStream, updateAggregatedStatus, optimizeSenders])

  // Flush queued ICE candidates for a peer
  const flushCandidates = useCallback(async (entry: PeerEntry) => {
    if (!entry.candidateQueue.length) return
    const queued = [...entry.candidateQueue]
    entry.candidateQueue = []

    for (const cand of queued) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch (err) {
        if (!entry.ignoreOffer) {
          console.warn('[WebRTC] Candidate flush error:', err)
        }
      }
    }
  }, [])

  // Handle incoming WebRTC signal with Perfect Negotiation
  const handleWebRTCSignal = useCallback(
    async (payload: any) => {
      if (!payload || payload.from === myIdRef.current || payload.to !== myIdRef.current) {
        return
      }

      const senderId = payload.from
      const entry = getOrCreatePeer(senderId)
      const pc = entry.pc

      if (payload.type === 'description') {
        const description: RTCSessionDescriptionInit = payload.description
        const readyForOffer =
          !entry.makingOffer &&
          (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending)
        const offerCollision = description.type === 'offer' && !readyForOffer

        entry.ignoreOffer = !entry.isPolite && offerCollision
        if (entry.ignoreOffer) {
          console.warn(`[WebRTC] Impolite peer ${myIdRef.current} ignoring offer collision from ${senderId}`)
          return
        }

        entry.isSettingRemoteAnswerPending = description.type === 'answer'
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(description))
          entry.isSettingRemoteAnswerPending = false

          // Flush any ICE candidates that arrived prior to setRemoteDescription
          await flushCandidates(entry)

          if (description.type === 'offer') {
            await pc.setLocalDescription()
            if (channelRef.current && pc.localDescription) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'webrtc_signal',
                payload: {
                  type: 'description',
                  from: myIdRef.current,
                  to: senderId,
                  description: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp,
                  },
                },
              })
            }
          }
        } catch (err) {
          console.error(`[WebRTC] Error handling description from ${senderId}:`, err)
        }
      } else if (payload.type === 'candidate') {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            // Buffer candidate until remote description is set
            entry.candidateQueue.push(payload.candidate)
          }
        } catch (err) {
          if (!entry.ignoreOffer) {
            console.warn(`[WebRTC] Error adding ICE candidate from ${senderId}:`, err)
          }
        }
      }
    },
    [getOrCreatePeer, flushCandidates]
  )

  /**
   * NTP-Style 5-Ping Fast Handshake
   * Calibrates client clock offset and one-way latency relative to the Host's clock
   */
  const calibrateClockOffset = useCallback(async () => {
    if (isHostRef.current || !channelRef.current) return

    const samples: { offset: number; rtt: number }[] = []

    const handlePong = (e: Event) => {
      const p = (e as CustomEvent).detail
      const t2 = Date.now()
      const rtt = t2 - p.t0
      const latency = rtt / 2
      const offset = (p.host_t1 + latency) - t2
      samples.push({ offset, rtt })
    }

    window.addEventListener('cineroom:ntp_pong', handlePong)

    // Send 5 rapid pings 60ms apart
    for (let i = 0; i < 5; i++) {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ntp_ping',
          payload: {
            from: myIdRef.current,
            t0: Date.now(),
            seq: i,
          },
        })
      }
      await new Promise((r) => setTimeout(r, 60))
    }

    // Wait a brief window for final pongs to return
    await new Promise((r) => setTimeout(r, 120))
    window.removeEventListener('cineroom:ntp_pong', handlePong)

    if (samples.length > 0) {
      // Pick the sample with the lowest RTT (cleanest network trip)
      samples.sort((a, b) => a.rtt - b.rtt)
      const best = samples[0]
      setNtpOffsetMs(Math.round(best.offset))
      setNtpRttMs(Math.round(best.rtt))
      console.log(
        `[NTP Calibration] Calibrated with Host. Offset: ${Math.round(best.offset)}ms, RTT: ${Math.round(best.rtt)}ms`
      )
    }
  }, [setNtpOffsetMs, setNtpRttMs])

  // Initialize Room & Realtime Channel
  useEffect(() => {
    if (!roomId) return
    let isMounted = true

    async function init() {
      // 1. Fetch Room record
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()

      if (room && isMounted) {
        const movie: MovieInfo = {
          title: room.movie_title,
          url: room.movie_url,
          genre: room.movie_genre,
          duration: room.movie_duration || 596,
        }
        setMovie(movie)
        setHostInfo(room.host_id || '', room.host_name || 'Host')

        if (room.is_playing) {
          const elapsed = Math.max(0, (Date.now() - new Date(room.last_updated_at).getTime()) / 1000)
          const dur = room.movie_duration || 596
          const accurateTime = dur > 0 ? (room.playback_time + elapsed) % dur : (room.playback_time + elapsed)
          setPlaybackTime(accurateTime)
          setIsPlaying(true)
        } else {
          setPlaybackTime(room.playback_time || 0)
          setIsPlaying(false)
        }
      } else if (!room) {
        const defaultMovie = useCineRoomStore.getState().currentMovie
        await supabase.from('rooms').upsert(
          {
            id: roomId,
            host_name: isHostRef.current ? myNameRef.current || 'Host' : 'Screening Host',
            host_id: isHostRef.current ? myIdRef.current : 'host-initial',
            movie_title: defaultMovie.title,
            movie_url: defaultMovie.url,
            movie_genre: defaultMovie.genre,
            movie_duration: defaultMovie.duration || 596,
            is_playing: true,
            playback_time: 0,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      }

      // 2. Fetch Chat History
      const { data: chatData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (chatData && isMounted) {
        setMessages(chatData as ChatMessage[])
      }

      // 3. Single Supabase Channel with broadcast self: false
      let effectiveId = myIdRef.current
      if (!effectiveId && typeof window !== 'undefined') {
        effectiveId = sessionStorage.getItem(`cineroom_${roomId}_uid`) || ''
        if (!effectiveId) {
          effectiveId = `user-${Math.floor(Math.random() * 89999 + 10000)}`
          sessionStorage.setItem(`cineroom_${roomId}_uid`, effectiveId)
        }
        setMyId(effectiveId)
        myIdRef.current = effectiveId
      }

      const channelTopic = `room:${roomId}`
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelTopic}` || c.topic === channelTopic)
      if (existing) {
        await supabase.removeChannel(existing)
      }

      const channel = supabase.channel(channelTopic, {
        config: {
          broadcast: { self: false },
          presence: { key: effectiveId || `user-${Date.now()}` },
        },
      })
      channelRef.current = channel

      // Presence Sync: Automatically initiate WebRTC mesh with all joined peers
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: UserPresence[] = []
        for (const key in state) {
          const presences = state[key] as any[]
          if (presences && presences[0]) {
            users.push(presences[0] as UserPresence)
          }
        }
        setPresenceUsers(users)

        // Ensure peer connection exists for every remote user
        users.forEach((u) => {
          if (u.id && u.id !== myIdRef.current) {
            getOrCreatePeer(u.id)
          }
        })
      })

      // Handle presence leave to clean up disconnected peer
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((p) => {
            if (p.id) {
              const entry = peersRef.current.get(p.id)
              if (entry) {
                entry.pc.close()
                peersRef.current.delete(p.id)
                removeStream(p.id)
              }
            }
          })
          updateAggregatedStatus()
        }
      })

      // NTP Ping (Host handles ping from viewer)
      channel.on('broadcast', { event: 'ntp_ping' }, ({ payload }) => {
        if (!payload || !isHostRef.current) return
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ntp_pong',
            payload: {
              to: payload.from,
              t0: payload.t0,
              host_t1: Date.now(),
              seq: payload.seq,
            },
          })
        }
      })

      // NTP Pong (Viewer receives pong from host)
      channel.on('broadcast', { event: 'ntp_pong' }, ({ payload }) => {
        if (!payload || payload.to !== myIdRef.current) return
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cineroom:ntp_pong', { detail: payload })
          )
        }
      })

      // Broadcast Playback Sync (Direct Play / Pause / Seek)
      channel.on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
        if (!payload) return
        const vTime = payload.videoTimestamp ?? payload.currentTime
        setIsPlaying(payload.isPlaying)
        setPlaybackTime(vTime)
        if (payload.hostName) {
          setHostInfo(payload.hostId || '', payload.hostName)
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cineroom:sync_packet', {
              detail: {
                ...payload,
                videoTimestamp: vTime,
                isHardSync: true,
              },
            })
          )
        }
      })

      // Broadcast Playback Heartbeat (Continuous sub-second lockstep sync)
      channel.on('broadcast', { event: 'playback_heartbeat' }, ({ payload }) => {
        if (!payload) return
        if (!isHostRef.current && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cineroom:sync_packet', {
              detail: {
                ...payload,
                videoTimestamp: payload.videoTimestamp ?? payload.currentTime,
                isHardSync: false,
              },
            })
          )
        }
      })

      // Sync Request from newly connected viewer
      channel.on('broadcast', { event: 'request_sync' }, () => {
        if (isHostRef.current && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cineroom:respond_sync_request'))
        }
      })

      // Broadcast Movie Sync
      channel.on('broadcast', { event: 'movie_sync' }, ({ payload }) => {
        if (!payload || !payload.movie) return
        setMovie(payload.movie)
        setIsPlaying(true)
        setPlaybackTime(0)
      })

      // Broadcast Reactions
      channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload) {
          addReaction(payload)
        }
      })

      // Broadcast Instant Chat
      channel.on('broadcast', { event: 'chat_broadcast' }, ({ payload }) => {
        if (payload) {
          addMessage(payload as ChatMessage)
        }
      })

      // WebRTC Cloud Signaling Handler
      channel.on('broadcast', { event: 'webrtc_signal' }, ({ payload }) => {
        handleWebRTCSignal(payload)
      })

      // Database Chat Updates
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            addMessage(payload.new as ChatMessage)
          }
        }
      )

      // Subscribe to channel and track presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          setRoomConnected(true)
          await channel.track({
            id: myIdRef.current || `viewer-${Date.now()}`,
            name: myNameRef.current || 'Viewer',
            hasVideo: hasVideoRef.current,
            hasAudio: hasAudioRef.current,
            isHost: isHostRef.current,
            joinedAt: joinedAtRef.current,
          })
          if (!isHostRef.current) {
            setTimeout(() => {
              calibrateClockOffset()
            }, 300)
          }
        }
      })
    }

    init()

    return () => {
      isMounted = false
      isSubscribedRef.current = false
      setRoomConnected(false)
      peersRef.current.forEach((entry) => entry.pc.close())
      peersRef.current.clear()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setWebRTCStatus('disconnected')
      setActivePeersCount(0)
    }
  }, [
    roomId,
    setMovie,
    setHostInfo,
    setPlaybackTime,
    setIsPlaying,
    setMessages,
    setPresenceUsers,
    addMessage,
    addReaction,
    getOrCreatePeer,
    handleWebRTCSignal,
    removeStream,
    updateAggregatedStatus,
    setWebRTCStatus,
    setActivePeersCount,
  ])

  // Track presence changes when AV state toggles
  useEffect(() => {
    if (channelRef.current && isSubscribedRef.current) {
      channelRef.current.track({
        id: myIdRef.current || `viewer-${Date.now()}`,
        name: myNameRef.current || 'Viewer',
        hasVideo: hasVideo,
        hasAudio: hasAudio,
        isHost: isHostRef.current,
        joinedAt: joinedAtRef.current,
      })
    }
  }, [hasVideo, hasAudio])

  /**
   * Acquire MediaStream with graceful fallback:
   * If camera is unavailable or denied, automatically fall back to audio-only.
   */
  const startMedia = useCallback(
    async (cameraOn: boolean, micOn: boolean) => {
      let stream: MediaStream | null = null
      let actualVideo = cameraOn

      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: cameraOn
            ? {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: 'user',
              }
            : false,
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err: any) {
        console.warn('[WebRTC] Media acquisition warning:', err.name, err.message)
        // If camera failed or was denied, fallback to audio-only
        if (cameraOn) {
          try {
            console.log('[WebRTC] Falling back to audio-only stream...')
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            })
            actualVideo = false
          } catch (audioErr: any) {
            console.error('[WebRTC] Microphone also unavailable:', audioErr.message)
          }
        }
      }

      if (!stream) {
        return null
      }

      localStreamRef.current = stream
      setLocalStream(stream)

      // Apply initial mute state
      stream.getAudioTracks().forEach((t) => {
        t.enabled = micOn
      })

      setHasAudio(micOn)
      setHasVideo(actualVideo)

      // Attach or replace tracks on all active peer connections and renegotiate
      peersRef.current.forEach(async (entry, peerId) => {
        const pc = entry.pc
        stream!.getTracks().forEach((track) => {
          const transceiver = pc
            .getTransceivers()
            .find((t) => t.receiver.track.kind === track.kind)

          if (transceiver && transceiver.sender) {
            transceiver.direction = 'sendrecv'
            transceiver.sender.replaceTrack(track).catch(() => {})
          }
        })
        optimizeSenders(pc)
        await renegotiatePeer(entry, peerId)
      })

      return stream
    },
    [setLocalStream, setHasAudio, setHasVideo, optimizeSenders, renegotiatePeer]
  )

  /**
   * Toggle Microphone:
   * Enables/disables local audio track, or requests audio if stream not yet created.
   */
  const toggleMic = useCallback(async () => {
    const next = !hasAudioRef.current

    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = next
      })
      setHasAudio(next)
      hasAudioRef.current = next

      // Ensure audio sender is active
      peersRef.current.forEach(async (entry) => {
        const aTrack = localStreamRef.current?.getAudioTracks()[0]
        if (aTrack) {
          const aTransceiver = entry.pc
            .getTransceivers()
            .find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio')
          if (aTransceiver && aTransceiver.sender) {
            aTransceiver.direction = 'sendrecv'
            await aTransceiver.sender.replaceTrack(aTrack).catch(() => {})
          }
        }
      })
    } else {
      // If no audio track exists, acquire it
      await startMedia(hasVideoRef.current, true)
    }

    // Update presence
    if (channelRef.current && isSubscribedRef.current) {
      channelRef.current.track({
        id: myIdRef.current || `viewer-${Date.now()}`,
        name: myNameRef.current || 'Viewer',
        hasVideo: hasVideoRef.current,
        hasAudio: next,
        isHost: isHostRef.current,
        joinedAt: joinedAtRef.current,
      })
    }
  }, [setHasAudio, startMedia])

  /**
   * Toggle Camera ("Go Live"):
   * Dynamically acquires or stops video track, replaces it in existing peer connections,
   * sets transceiver direction to sendrecv, and triggers renegotiation.
   */
  const toggleCamera = useCallback(async () => {
    const next = !hasVideoRef.current

    if (next) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          },
        })
        const vTrack = vStream.getVideoTracks()[0]

        if (vTrack) {
          if (!localStreamRef.current) {
            localStreamRef.current = vStream
            setLocalStream(vStream)
          } else {
            // Remove any old dead video tracks
            localStreamRef.current.getVideoTracks().forEach((t) => {
              t.stop()
              localStreamRef.current?.removeTrack(t)
            })
            localStreamRef.current.addTrack(vTrack)
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
          }

          // Attach to all peer connections, set direction = sendrecv and renegotiate
          peersRef.current.forEach(async (entry, peerId) => {
            const pc = entry.pc
            const videoTransceiver = pc
              .getTransceivers()
              .find((t) => t.receiver.track.kind === 'video')

            if (videoTransceiver && videoTransceiver.sender) {
              videoTransceiver.direction = 'sendrecv'
              await videoTransceiver.sender.replaceTrack(vTrack).catch(() => {})
            }
            optimizeSenders(pc)
            await renegotiatePeer(entry, peerId)
          })

          setHasVideo(true)
          hasVideoRef.current = true
        }
      } catch (err: any) {
        console.warn('[WebRTC] Camera permission denied or device not found:', err.message)
      }
    } else {
      // Turn off camera
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop()
          localStreamRef.current?.removeTrack(t)
        })
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      }

      // Clear video sender on peers and renegotiate
      peersRef.current.forEach(async (entry, peerId) => {
        const videoTransceiver = entry.pc
          .getTransceivers()
          .find((t) => t.receiver.track.kind === 'video')

        if (videoTransceiver && videoTransceiver.sender) {
          await videoTransceiver.sender.replaceTrack(null).catch(() => {})
        }
        await renegotiatePeer(entry, peerId)
      })

      setHasVideo(false)
      hasVideoRef.current = false
    }

    // Update presence
    if (channelRef.current && isSubscribedRef.current) {
      channelRef.current.track({
        id: myIdRef.current || `viewer-${Date.now()}`,
        name: myNameRef.current || 'Viewer',
        hasVideo: next,
        hasAudio: hasAudioRef.current,
        isHost: isHostRef.current,
        joinedAt: joinedAtRef.current,
      })
    }
  }, [setHasVideo, setLocalStream, optimizeSenders, renegotiatePeer])

  // Restart WebRTC connections across all peers
  const restartWebRTC = useCallback(() => {
    console.log('[WebRTC] Initiating mesh ICE restart...')
    peersRef.current.forEach((entry) => {
      try {
        entry.pc.restartIce()
      } catch (err) {
        console.warn('[WebRTC] restartIce error:', err)
      }
    })
  }, [])

  // WebRTC Diagnostics Snapshot
  const getDiagnostics = useCallback((): WebRTCDiagnosticInfo[] => {
    const list: WebRTCDiagnosticInfo[] = []
    peersRef.current.forEach((entry, targetId) => {
      const pc = entry.pc
      const senders = pc.getSenders()
      list.push({
        targetId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
        hasAudioTrack: senders.some((s) => s.track?.kind === 'audio' && s.track.enabled),
        hasVideoTrack: senders.some((s) => s.track?.kind === 'video' && s.track.enabled),
        isPolite: entry.isPolite,
      })
    })
    return list
  }, [])

  const sendPlaybackControl = useCallback(
    async (playing: boolean, time: number, rate: number = 1.0) => {
      setIsPlaying(playing)
      setPlaybackTime(time)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'playback_sync',
          payload: {
            isPlaying: playing,
            currentTime: time,
            videoTimestamp: time,
            hostWallClock: Date.now(),
            playbackRate: rate,
            hostId: myIdRef.current,
            hostName: myNameRef.current,
            timestamp: Date.now(),
          },
        })
      }

      await supabase
        .from('rooms')
        .update({
          is_playing: playing,
          playback_time: time,
          last_updated_at: new Date().toISOString(),
          host_id: myIdRef.current,
          host_name: myNameRef.current,
        })
        .eq('id', roomId)
    },
    [roomId, setIsPlaying, setPlaybackTime]
  )

  /**
   * Broadcast periodic heartbeat (every 1.5s) while playing so all peers
   * stay continuously locked to the exact same frame without clock drift.
   */
  const sendPlaybackHeartbeat = useCallback(
    (time: number, isPlaying: boolean, rate: number = 1.0) => {
      if (channelRef.current && isHostRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'playback_heartbeat',
          payload: {
            currentTime: time,
            videoTimestamp: time,
            isPlaying,
            hostWallClock: Date.now(),
            playbackRate: rate,
            hostId: myIdRef.current,
            hostName: myNameRef.current,
            timestamp: Date.now(),
          },
        })
      }
    },
    []
  )

  /**
   * Request host to immediately broadcast current playback time
   */
  const requestPlaybackSync = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'request_sync',
        payload: {
          from: myIdRef.current,
        },
      })
    }
  }, [])

  const sendMovieChange = useCallback(
    async (movie: MovieInfo) => {
      setMovie(movie)
      setIsPlaying(true)
      setPlaybackTime(0)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'movie_sync',
          payload: {
            movie,
            timestamp: Date.now(),
          },
        })
      }

      await supabase
        .from('rooms')
        .update({
          movie_title: movie.title,
          movie_url: movie.url,
          movie_genre: movie.genre || '',
          movie_duration: movie.duration || 596,
          is_playing: true,
          playback_time: 0,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', roomId)

      await supabase.from('chat_messages').insert({
        room_id: roomId,
        user_id: 'system',
        name: 'System',
        color: '#0071e3',
        message: `🎬 Host ${myNameRef.current || 'Host'} switched stream to "${movie.title}"`,
        is_system: true,
      })
    },
    [roomId, setMovie, setIsPlaying, setPlaybackTime]
  )

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      const msgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}`
      const newMsg: ChatMessage = {
        id: msgId,
        room_id: roomId,
        user_id: myIdRef.current || 'user',
        name: myNameRef.current || 'Viewer',
        color: isHostRef.current ? '#0071e3' : '#ffffff',
        message: text.trim(),
        is_system: false,
        created_at: new Date().toISOString(),
      }

      // Optimistic instant local render
      addMessage(newMsg)

      // Broadcast sub-20ms to all peers in the room
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'chat_broadcast',
          payload: newMsg,
        })
      }

      // Persist to Cloud Postgres
      await supabase.from('chat_messages').insert({
        id: msgId,
        room_id: roomId,
        user_id: newMsg.user_id,
        name: newMsg.name,
        color: newMsg.color,
        message: newMsg.message,
        is_system: false,
      })
    },
    [roomId, addMessage]
  )

  const sendReaction = useCallback(
    (emoji: string) => {
      const payload = { emoji, name: myNameRef.current || 'Viewer' }
      addReaction(payload)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'reaction',
          payload,
        })
      }
    },
    [addReaction]
  )

  return (
    <SupabaseRoomContext.Provider
      value={{
        sendPlaybackControl,
        sendPlaybackHeartbeat,
        requestPlaybackSync,
        calibrateClockOffset,
        sendMovieChange,
        sendChatMessage,
        sendReaction,
        startMedia,
        toggleMic,
        toggleCamera,
        restartWebRTC,
        getDiagnostics,
      }}
    >
      <RemoteAudioRenderer />
      {children}
    </SupabaseRoomContext.Provider>
  )
}

export function useSupabaseRoom() {
  const context = useContext(SupabaseRoomContext)
  if (!context) {
    return {
      sendPlaybackControl: async () => {},
      sendPlaybackHeartbeat: () => {},
      requestPlaybackSync: () => {},
      calibrateClockOffset: async () => {},
      sendMovieChange: async () => {},
      sendChatMessage: async () => {},
      sendReaction: () => {},
      startMedia: async () => null,
      toggleMic: async () => {},
      toggleCamera: async () => {},
      restartWebRTC: () => {},
      getDiagnostics: () => [],
    }
  }
  return context
}
