'use client'

import { useEffect, useRef, useCallback } from 'react'
import SimplePeer from 'simple-peer'
import { getSocket } from '@/lib/socket'
import { useCineRoomStore } from '@/lib/store'

type PeerMap = Map<string, SimplePeer.Instance>

export function useWebRTC(roomId: string) {
  const socket = getSocket()
  const peers = useRef<PeerMap>(new Map())
  const { localStream, setStream, removeStream } = useCineRoomStore()

  const createPeer = useCallback(
    (targetId: string, initiator: boolean, stream: MediaStream | undefined) => {
      const peer = new SimplePeer({
        initiator,
        trickle: true,
        stream: stream ?? undefined,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      })

      peer.on('signal', (data) => {
        if (data.type === 'offer') {
          socket.emit('webrtc-offer', { targetId, offer: data })
        } else if (data.type === 'answer') {
          socket.emit('webrtc-answer', { targetId, answer: data })
        } else {
          socket.emit('webrtc-ice-candidate', { targetId, candidate: data })
        }
      })

      peer.on('stream', (remoteStream) => {
        setStream(targetId, remoteStream)
      })

      peer.on('error', (err) => {
        console.warn(`Peer warning (${targetId}):`, err.message)
        peers.current.delete(targetId)
        removeStream(targetId)
      })

      peer.on('close', () => {
        peers.current.delete(targetId)
        removeStream(targetId)
      })

      peers.current.set(targetId, peer)
      return peer
    },
    [socket, setStream, removeStream]
  )

  useEffect(() => {
    socket.on('user-joined', ({ id: targetId }) => {
      if (peers.current.has(targetId)) return
      createPeer(targetId, true, localStream ?? undefined)
    })

    socket.on('webrtc-offer', ({ fromId, offer }) => {
      let peer = peers.current.get(fromId)
      if (!peer) {
        peer = createPeer(fromId, false, localStream ?? undefined)
      }
      peer.signal(offer)
    })

    socket.on('webrtc-answer', ({ fromId, answer }) => {
      peers.current.get(fromId)?.signal(answer)
    })

    socket.on('webrtc-ice-candidate', ({ fromId, candidate }) => {
      peers.current.get(fromId)?.signal(candidate)
    })

    socket.on('user-left', ({ userId }) => {
      peers.current.get(userId)?.destroy()
      peers.current.delete(userId)
      removeStream(userId)
    })

    return () => {
      socket.off('user-joined')
      socket.off('webrtc-offer')
      socket.off('webrtc-answer')
      socket.off('webrtc-ice-candidate')
      socket.off('user-left')
    }
  }, [socket, localStream, createPeer, removeStream])

  useEffect(() => {
    return () => {
      peers.current.forEach((peer) => peer.destroy())
      peers.current.clear()
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      })
      useCineRoomStore.getState().setLocalStream(stream)
      useCineRoomStore.getState().setHasVideo(true)
      useCineRoomStore.getState().setHasAudio(true)

      peers.current.forEach((peer) => {
        stream.getTracks().forEach((track) => {
          try {
            // @ts-ignore
            peer.addTrack(track, stream)
          } catch {}
        })
      })

      socket.emit('video-toggle', { roomId, hasVideo: true })
      socket.emit('audio-toggle', { roomId, hasAudio: true })
      return stream
    } catch (err) {
      console.error('Camera/Mic permission failed:', err)
      return null
    }
  }, [socket, roomId])

  const stopCamera = useCallback(() => {
    const { localStream: ls } = useCineRoomStore.getState()
    if (ls) {
      ls.getVideoTracks().forEach((t) => t.stop())
      // Keep audio if desired, or stop everything
      const audioTracks = ls.getAudioTracks()
      if (audioTracks.length === 0 || !useCineRoomStore.getState().hasAudio) {
        ls.getTracks().forEach((t) => t.stop())
        useCineRoomStore.getState().setLocalStream(null)
      }
      useCineRoomStore.getState().setHasVideo(false)
      socket.emit('video-toggle', { roomId, hasVideo: false })
    }
  }, [socket, roomId])

  const toggleMic = useCallback(() => {
    const { localStream: ls, hasAudio } = useCineRoomStore.getState()
    const newAudioState = !hasAudio
    if (ls) {
      ls.getAudioTracks().forEach((t) => {
        t.enabled = newAudioState
      })
    }
    useCineRoomStore.getState().setHasAudio(newAudioState)
    socket.emit('audio-toggle', { roomId, hasAudio: newAudioState })
  }, [socket, roomId])

  return { startCamera, stopCamera, toggleMic }
}
