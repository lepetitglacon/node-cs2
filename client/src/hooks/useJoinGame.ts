import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface JoinGameResponse {
  success: boolean
  message: string
}

const joinGameApi = async (gameId: string): Promise<JoinGameResponse> => {
  const { data } = await axios.post(`${API_URL}/game/${gameId}/join`)
  return data
}

export const useJoinGame = () => {
  return useMutation({
    mutationFn: joinGameApi,
  })
}
