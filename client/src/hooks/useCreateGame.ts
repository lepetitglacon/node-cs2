import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/contexts/ApiContext'

interface CreateGameDto {
  name: string
  maxPlayers: number
}

interface Game {
  _id: string
  state: 'lobby' | 'ingame' | 'ended'
  name: string
  maxPlayers: number
  players: string[]
  createdAt: string
  updatedAt: string
}

export const useCreateGame = () => {
  const { api } = useApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateGameDto): Promise<Game> => {
      const { data: response } = await api.post('/game', data)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    },
  })
}
