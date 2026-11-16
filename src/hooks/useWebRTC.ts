'use client'

import { useEffect, useRef, useCallback } from 'react'
import SimplePeer from 'simple-peer'
import { getSocket } from '@/lib/socket'
import { useCineRoomStore } from '@/lib/store'

type PeerMap = Map<string, SimplePeer.Instance>

export function useWebRTC(roomId: string) {
  const socket = getSocket()
  const peers = useRef<PeerMap>(new Map())
  const { localStream, setStream, removeStream, myId } = useCineRoomStore()

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
        console.warn(`Peer error (${targetId}):`, err)
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
    // When a new user joins, we initiate a peer connection to them
    socket.on('user-joined', ({ id: targetId }) => {
      if (peers.current.has(targetId)) return
      createPeer(targetId, true, localStream ?? undefined)
    })

    // Receive an offer from a new user
    socket.on('webrtc-offer', ({ fromId, offer }) => {
      let peer = peers.current.get(fromId)
      if (!peer) {
        peer = createPeer(fromId, false, localStream ?? undefined)
      }
      peer.signal(offer)
    })

    // Receive answer
    socket.on('webrtc-answer', ({ fromId, answer }) => {
      peers.current.get(fromId)?.signal(answer)
    })

    // ICE candidate
    socket.on('webrtc-ice-candidate', ({ fromId, candidate }) => {
      peers.current.get(fromId)?.signal(candidate)
    })

    // User left
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peers.current.forEach((peer) => peer.destroy())
      peers.current.clear()
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      useCineRoomStore.getState().setLocalStream(stream)
      useCineRoomStore.getState().setHasVideo(true)

      // Update existing peers with the new stream
      peers.current.forEach((peer) => {
        stream.getTracks().forEach((track) => {
          try {
            // @ts-ignore
            peer.addTrack(track, stream)
          } catch {}
        })
      })

      socket.emit('video-toggle', { roomId, hasVideo: true })
      return stream
    } catch (err) {
      console.error('Camera access denied:', err)
      return null
    }
  }, [socket, roomId])

  const stopCamera = useCallback(() => {
    const { localStream: ls } = useCineRoomStore.getState()
    if (ls) {
      ls.getTracks().forEach((t) => t.stop())
      useCineRoomStore.getState().setLocalStream(null)
      useCineRoomStore.getState().setHasVideo(false)
      socket.emit('video-toggle', { roomId, hasVideo: false })
    }
  }, [socket, roomId])

  return { startCamera, stopCamera }
}
