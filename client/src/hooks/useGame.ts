import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface Game {
  _id: string
  state: 'lobby' | 'ingame' | 'ended'
  name: string
  maxPlayers: number
  players: string[]
  createdAt: string
  updatedAt: string
}

const fetchGame = async (id: string): Promise<Game> => {
  const { data } = await axios.get(`${API_URL}/game/${id}`)
  return data
}

export const useGame = (id: string) => {
  return useQuery({
    queryKey: ['game', id],
    queryFn: () => fetchGame(id),
    enabled: !!id,
  })
}
