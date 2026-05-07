import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/contexts/ApiContext'

interface JoinGameResponse {
  success: boolean
  message: string
}

export const useJoinGame = () => {
  const { api } = useApi()

  return useMutation({
    mutationFn: async (gameId: string): Promise<JoinGameResponse> => {
      const { data } = await api.post(`/game/${gameId}/join`)
      return data
    },
  })
}
