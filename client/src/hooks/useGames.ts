import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/contexts/ApiContext'

interface Game {
  _id: string
  state: 'lobby' | 'ingame' | 'ended'
  name: string
  maxPlayers: number
  players: string[]
  createdAt: string
  updatedAt: string
}

export const useGames = () => {
  const { api } = useApi()

  return useQuery({
    queryKey: ['games'],
    queryFn: async (): Promise<Game[]> => {
      const { data } = await api.get('/game')
      return data
    },
  })
}
