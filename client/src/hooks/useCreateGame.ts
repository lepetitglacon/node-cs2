import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

const createGame = async (data: CreateGameDto): Promise<Game> => {
  const { data: response } = await axios.post(`${API_URL}/game`, data)
  return response
}

export const useCreateGame = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    },
  })
}
