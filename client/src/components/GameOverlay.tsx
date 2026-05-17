import React from 'react'
import { useGame } from '@/views/game/GameContext.tsx'

interface GameOverlayProps {
  children?: React.ReactNode
}

const KEY_LABELS: { key: keyof ReturnType<typeof useGame>['inputState']; label: string }[] = [
  { key: 'forward', label: 'Z' },
  { key: 'left',    label: 'Q' },
  { key: 'back',    label: 'S' },
  { key: 'right',   label: 'D' },
  { key: 'shoot',   label: 'FIRE' },
]

export const GameOverlay = ({ children }: GameOverlayProps) => {
  const { currentPlayer, inputState } = useGame()
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
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          display: 'flex',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {KEY_LABELS.map(({ key, label }) => (
          <span
            key={key}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 'bold',
              padding: '2px 7px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.3)',
              background: inputState[key] ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.45)',
              color: inputState[key] ? '#111' : 'rgba(255,255,255,0.5)',
              transition: 'background 0.05s, color 0.05s',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
