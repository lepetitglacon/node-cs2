import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobbyRoom } from '@colyseus/react'
import { client } from '@/services/colyseus.service.ts'

export const GamesList = () => {
  const navigate = useNavigate()

  const { rooms, room: lobbyRoom, error, isConnecting } = useLobbyRoom(() =>
    client.joinOrCreate('lobby')
  )

  // Le message "rooms" du serveur arrive avant que useLobbyRoom enregistre son handler
  // dans useEffect. On redemande la liste via "filter" une fois les handlers en place.
  useEffect(() => {
    if (lobbyRoom) lobbyRoom.send('filter')
  }, [lobbyRoom])

  const createRoom = async () => {
    const room = await client.create('my_room')
    navigate(`/game/${room.roomId}`)
  }

  if (isConnecting) return <p>Connecting...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <>
      <button onClick={createRoom}>Créer une partie</button>
      <ul>
        {rooms.length === 0 && <p>Aucune partie disponible.</p>}
        {rooms.map((room) => (
          <li key={room.roomId}>
            {room.name} — {room.clients}/{room.maxClients} joueurs
            <button onClick={() => navigate(`/game/${room.roomId}`)}>
              Rejoindre
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
