import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSocket } from './SocketContext'

interface GameContextType {
  players: string[]
  joinGame: (gameId: string) => void
  leaveGame: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket, playerId } = useSocket()
  const [players, setPlayers] = useState<string[]>([])

  useEffect(() => {
    if (!socket) return

    socket.on('joinedGame', (data) => {
      console.log('Joined game:', data)
      setPlayers(data.players)
    })

    socket.on('playerJoined', (data) => {
      console.log('Player joined:', data)
      setPlayers(data.players)
    })

    socket.on('playerLeft', (data) => {
      console.log('Player left:', data)
      setPlayers(data.players)
    })

    return () => {
      socket.off('joinedGame')
      socket.off('playerJoined')
      socket.off('playerLeft')
    }
  }, [socket])

  const joinGame = (gameId: string) => {
    if (!socket) return

    socket.emit('joinGame', {
      gameId,
      playerId,
    })
  }

  const leaveGame = () => {
    if (!socket) return
    setPlayers([])
  }

  return (
    <GameContext.Provider value={{ players, joinGame, leaveGame }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within GameProvider')
  }
  return context
}
