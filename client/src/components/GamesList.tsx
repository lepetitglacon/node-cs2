import { useNavigate } from 'react-router-dom'
import { useLobbyRoom } from '@colyseus/react'
import { Client } from '@colyseus/sdk'

export const client = new Client('ws://localhost:2567')

export const GamesList = () => {
  const navigate = useNavigate()

  const { rooms, error, isConnecting } = useLobbyRoom(() =>
    client.joinOrCreate('lobby')
  )

  if (isConnecting) return <p>Connecting...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {rooms.length === 0 && <>No rooms found.</>}
      {rooms.map((room) => (
        <li key={room.roomId}>
          {room.roomId} - {room.name} — {room.clients}/{room.maxClients} players
          <button
            onClick={async () => {
              await client.joinById(room.roomId)
              navigate(`/game/${room.roomId}`)
            }}
          >
            Join
          </button>
        </li>
      ))}
    </ul>
  )
}
