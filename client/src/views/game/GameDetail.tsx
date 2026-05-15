import { useParams } from 'react-router-dom'
import { client } from '@/services/colyseus.service.ts'
import { RoomProvider } from './roomContext.ts'
import { Game } from './Game.tsx'

export const GameDetail = () => {
  const { id } = useParams<{ id: string }>()

  return (
    <RoomProvider connect={() => client.joinById(id)}>
      <Game />
    </RoomProvider>
  )
}
