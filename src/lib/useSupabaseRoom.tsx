'use client'

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCineRoomStore, MovieInfo, ChatMessage, UserPresence } from '@/lib/store'
import { RealtimeChannel } from '@supabase/supabase-js'

interface SupabaseRoomContextType {
  sendPlaybackControl: (playing: boolean, time: number) => Promise<void>
  sendMovieChange: (movie: MovieInfo) => Promise<void>
  sendChatMessage: (text: string) => Promise<void>
  sendReaction: (emoji: string) => void
  startMedia: (cameraOn: boolean, micOn: boolean) => Promise<MediaStream | null>
  toggleMic: () => void
  toggleCamera: () => Promise<void>
}

const SupabaseRoomContext = createContext<SupabaseRoomContextType | null>(null)

export function SupabaseRoomProvider({ roomId, children }: { roomId: string; children: React.ReactNode }) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isSubscribedRef = useRef(false)
  const joinedAtRef = useRef(Date.now())
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)

  const {
    myId,
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

  // Helper to create or get an RTCPeerConnection
  const getOrCreatePeer = useCallback((targetPeerId: string, isInitiator: boolean) => {
    if (peersRef.current.has(targetPeerId)) {
      return peersRef.current.get(targetPeerId)!
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    })

    // Attach local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current!)
        } catch {}
      })
    }

    // When remote track arrives
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setStream(targetPeerId, event.streams[0])
      }
    }

    // When local candidate is ready
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: {
            type: 'candidate',
            from: myIdRef.current,
            to: targetPeerId,
            candidate: event.candidate,
          },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removeStream(targetPeerId)
        peersRef.current.delete(targetPeerId)
      }
    }

    peersRef.current.set(targetPeerId, pc)

    if (isInitiator) {
      // Trigger negotiation
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: {
                type: 'offer',
                from: myIdRef.current,
                to: targetPeerId,
                offer,
              },
            })
          }
        } catch (err) {
          console.warn('WebRTC negotiation error:', err)
        }
      }
    }

    return pc
  }, [setStream, removeStream])

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
        await supabase.from('rooms').upsert({
          id: roomId,
          host_name: isHostRef.current ? (myNameRef.current || 'Host') : 'Screening Host',
          host_id: isHostRef.current ? myIdRef.current : 'host-initial',
          movie_title: defaultMovie.title,
          movie_url: defaultMovie.url,
          movie_genre: defaultMovie.genre,
          movie_duration: defaultMovie.duration || 596,
          is_playing: true,
          playback_time: 0,
          last_updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
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

      // 3. Single Channel Subscription
      const channelTopic = `room:${roomId}`
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelTopic}` || c.topic === channelTopic)
      if (existing) {
        await supabase.removeChannel(existing)
      }

      const channel = supabase.channel(channelTopic, {
        config: {
          broadcast: { self: false },
          presence: { key: myIdRef.current || `user-${Date.now()}` },
        },
      })
      channelRef.current = channel

      // Presence
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
      })

      // Broadcast Playback Sync
      channel.on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
        if (!payload) return
        setIsPlaying(payload.isPlaying)
        setPlaybackTime(payload.currentTime)
        if (payload.hostName) {
          setHostInfo(payload.hostId || '', payload.hostName)
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

      // WebRTC Cloud Signaling
      channel.on('broadcast', { event: 'webrtc_signal' }, async ({ payload }) => {
        if (!payload || payload.from === myIdRef.current) return

        if (payload.type === 'peer_ready') {
          // Announce mutual handshake
          if (myIdRef.current > payload.from) {
            getOrCreatePeer(payload.from, true)
          } else {
            channel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { type: 'peer_ack', from: myIdRef.current, to: payload.from },
            })
          }
        } else if (payload.type === 'peer_ack') {
          if (payload.to === myIdRef.current) {
            getOrCreatePeer(payload.from, false)
          }
        } else if (payload.type === 'offer') {
          if (payload.to === myIdRef.current) {
            try {
              const pc = getOrCreatePeer(payload.from, false)
              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              channel.send({
                type: 'broadcast',
                event: 'webrtc_signal',
                payload: {
                  type: 'answer',
                  from: myIdRef.current,
                  to: payload.from,
                  answer,
                },
              })
            } catch (err) {
              console.warn('WebRTC handle offer error:', err)
            }
          }
        } else if (payload.type === 'answer') {
          if (payload.to === myIdRef.current) {
            const pc = peersRef.current.get(payload.from)
            if (pc) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
              } catch (err) {
                console.warn('WebRTC handle answer error:', err)
              }
            }
          }
        } else if (payload.type === 'candidate') {
          if (payload.to === myIdRef.current) {
            const pc = peersRef.current.get(payload.from)
            if (pc && payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
              } catch {}
            }
          }
        }
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

      // Subscribe
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          await channel.track({
            id: myIdRef.current || `viewer-${Date.now()}`,
            name: myNameRef.current || 'Viewer',
            hasVideo: hasVideoRef.current,
            hasAudio: hasAudioRef.current,
            isHost: isHostRef.current,
            joinedAt: joinedAtRef.current,
          })

          // Broadcast peer ready to connect with anyone already in the room
          channel.send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: { type: 'peer_ready', from: myIdRef.current },
          })
        }
      })
    }

    init()

    return () => {
      isMounted = false
      isSubscribedRef.current = false
      peersRef.current.forEach((pc) => pc.close())
      peersRef.current.clear()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [roomId, setMovie, setHostInfo, setPlaybackTime, setIsPlaying, setMessages, setPresenceUsers, addMessage, addReaction, getOrCreatePeer])

  // Track presence changes
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

  // Start Media (Camera & Mic)
  const startMedia = useCallback(async (cameraOn: boolean, micOn: boolean) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: cameraOn ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)

      // Apply initial mute state
      stream.getAudioTracks().forEach((t) => {
        t.enabled = micOn
      })

      setHasAudio(micOn)
      setHasVideo(cameraOn)

      // Attach tracks to existing peers
      peersRef.current.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream)
          } catch {}
        })
      })

      // Broadcast peer ready
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: { type: 'peer_ready', from: myIdRef.current },
        })
      }

      return stream
    } catch (err) {
      console.warn('Could not acquire audio/video:', err)
      return null
    }
  }, [setLocalStream, setHasAudio, setHasVideo])

  // Toggle Microphone
  const toggleMic = useCallback(() => {
    const next = !hasAudioRef.current
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = next
      })
      setHasAudio(next)
    } else {
      // If no local stream exists yet, start audio
      startMedia(false, true)
    }
  }, [setHasAudio, startMedia])

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    const next = !hasVideoRef.current
    if (next) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        })
        const vTrack = vStream.getVideoTracks()[0]
        if (vTrack) {
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(vTrack)
          } else {
            localStreamRef.current = vStream
            setLocalStream(vStream)
          }

          // Add to all active peer connections
          peersRef.current.forEach((pc) => {
            try {
              pc.addTrack(vTrack, localStreamRef.current!)
            } catch {}
          })
        }
        setHasVideo(true)
      } catch (err) {
        console.warn('Camera permission denied:', err)
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop()
          localStreamRef.current?.removeTrack(t)
        })
      }
      setHasVideo(false)
    }
  }, [setHasVideo, setLocalStream])

  const sendPlaybackControl = useCallback(
    async (playing: boolean, time: number) => {
      setIsPlaying(playing)
      setPlaybackTime(time)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'playback_sync',
          payload: {
            isPlaying: playing,
            currentTime: time,
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
        sendMovieChange,
        sendChatMessage,
        sendReaction,
        startMedia,
        toggleMic,
        toggleCamera,
      }}
    >
      {children}
    </SupabaseRoomContext.Provider>
  )
}

export function useSupabaseRoom() {
  const context = useContext(SupabaseRoomContext)
  if (!context) {
    return {
      sendPlaybackControl: async () => {},
      sendMovieChange: async () => {},
      sendChatMessage: async () => {},
      sendReaction: () => {},
      startMedia: async () => null,
      toggleMic: () => {},
      toggleCamera: async () => {},
    }
  }
  return context
}
