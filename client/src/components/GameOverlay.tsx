import React from 'react'
import { useGame } from '@/views/game/GameContext.tsx'

interface GameOverlayProps {
  children?: React.ReactNode
}

export const GameOverlay = ({ children }: GameOverlayProps) => {
  const { currentPlayer } = useGame()
  const isActive = currentPlayer.state === 'dead'
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-opacity duration-300 ${
        isActive
          ? 'pointer-events-auto bg-black/50'
          : 'pointer-events-none bg-transparent'
      } `}
    >
      {children}
    </div>
  )
}
