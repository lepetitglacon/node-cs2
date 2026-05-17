import React, { createContext, useContext } from 'react'
import type { Room } from '@colyseus/sdk'
import { useRoom, useRoomState } from './roomContext.ts'
import { useInput, type InputState } from '@/hooks/useInput.ts'

interface GameContextType {
  room: Room | undefined
  state: any
  currentPlayer: any
  otherPlayers: any
  isReady: boolean
  inputRef: React.MutableRefObject<InputState>
  inputState: InputState
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { room } = useRoom()
  const state = useRoomState()
  const { ref: inputRef, state: inputState } = useInput()

  const currentPlayer = state?.players?.[room?.sessionId ?? '']
  const isReady = !!room && !!state && !!currentPlayer

  const otherPlayers = Object.entries(state?.players ?? {})
    .filter(([id]) => {
      return id !== currentPlayer?.id
    })
    .reduce(
      (acc, [id, p]) => {
        acc[id] = p
        return acc
      },
      {} as Record<string, any>
    )

  const value: GameContextType = {
    room,
    state,
    currentPlayer,
    otherPlayers,
    isReady,
    inputRef,
    inputState,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within GameProvider')
  }
  return context
}
