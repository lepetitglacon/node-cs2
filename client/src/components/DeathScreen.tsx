import { useEffect } from 'react'
import { useGame } from '@/views/game/GameContext.tsx'

export const DeathScreen = () => {
  const { room, currentPlayer } = useGame()

  const onRespawn = async () => {
    room.send('respawn')
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === ' ') {
        onRespawn()
      }
    }
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [onRespawn])

  return (
    <>
      {currentPlayer.moveState}
      {currentPlayer.state === 'dead' && (
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-8xl font-bold text-red-500">YOU ARE DEAD</h1>
          <button
            onClick={onRespawn}
            className="px-12 py-4 text-3xl font-bold text-white bg-green-500 hover:bg-green-600 transition-colors rounded"
          >
            RESPAWN
          </button>
        </div>
      )}
    </>
  )
}
