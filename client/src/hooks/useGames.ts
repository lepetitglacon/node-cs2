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

const fetchGames = async (): Promise<Game[]> => {
  const { data } = await axios.get(`${API_URL}/game`)
  return data
}

export const useGames = () => {
  return useQuery({
    queryKey: ['games'],
    queryFn: fetchGames,
  })
}
