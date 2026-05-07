import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface GameSocketEvents {
  joinedGame: (data: {
    gameId: string
    playerId: string
    playersCount: number
    players: string[]
  }) => void
  playerJoined: (data: {
    gameId: string
    playerId: string
    playersCount: number
    players: string[]
  }) => void
  playerLeft: (data: {
    gameId: string
    playerId: string
    playersCount: number
    players: string[]
  }) => void
  gameMessage: (data: {
    gameId: string
    playerId: string
    message: string
    timestamp: Date
  }) => void
  error: (message: string) => void
}

export const useGameSocket = (gameId: string, playerId: string) => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<string[]>([])

  useEffect(() => {
    if (!gameId || !playerId) return

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

    // Create socket connection
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    // Connect event
    socket.on('connect', () => {
      console.log('Connected to WebSocket')
      setIsConnected(true)

      // Join the game
      socket.emit('joinGame', {
        gameId,
        playerId,
      })
    })

    // Joined game event
    socket.on('joinedGame', (data) => {
      console.log('Joined game:', data)
      setPlayers(data.players)
    })

    // Player joined event
    socket.on('playerJoined', (data) => {
      console.log('Player joined:', data)
      setPlayers(data.players)
    })

    // Player left event
    socket.on('playerLeft', (data) => {
      console.log('Player left:', data)
      setPlayers(data.players)
    })

    // Error event
    socket.on('error', (message: string) => {
      console.error('Socket error:', message)
    })

    // Disconnect event
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket')
      setIsConnected(false)
    })

    return () => {
      if (socket) {
        socket.emit('leaveGame', { gameId, playerId })
        socket.disconnect()
      }
    }
  }, [gameId, playerId])

  const emit = (event: keyof GameSocketEvents, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data)
    }
  }

  const on = (event: keyof GameSocketEvents, callback: any) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }

  const off = (event: keyof GameSocketEvents, callback: any) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    players,
    emit,
    on,
    off,
  }
}
