import { useNavigate, useParams } from 'react-router-dom'
import { client } from '@/services/colyseus.service.ts'
import { RoomProvider } from './roomContext.ts'
import { Game } from './Game.tsx'

export const GameDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  return (
    <RoomProvider
      connect={async () => {
        try {
          return await client.joinById(id)
        } catch (e) {
          navigate('/')
        }
      }}
    >
      <Game />
    </RoomProvider>
  )
}
