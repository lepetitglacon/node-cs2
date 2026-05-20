import { useGame } from '@/views/game/GameContext.tsx'

const QUEST_MESSAGES: Record<string, string> = {
  fetch_weapon: "Va chercher l'arme dans la boîte au-dessus",
  go_to_stand: 'Va sur le stand de tir',
  shoot_targets: 'Butte les tous !',
}

export const QuestMessage = () => {
  const { currentPlayer } = useGame()
  const message = QUEST_MESSAGES[currentPlayer?.questStep]
  if (!message) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: 24,
        fontWeight: 'bold',
        textShadow: '0 2px 6px rgba(0,0,0,0.9)',
        background: 'rgba(0,0,0,0.45)',
        padding: '8px 20px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  )
}
