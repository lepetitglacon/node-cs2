import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '@/hooks/useGame'
import { useSocket } from '@/contexts/SocketContext'
import { ChevronLeft, Check, Share2, Loader } from 'lucide-react'

export const GameDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: game, isLoading, isError, error } = useGame(id || '')
  const { socket, playerId } = useSocket()
  const [players, setPlayers] = useState<string[]>([])

  // Join WebSocket room when component mounts
  useEffect(() => {
    if (!socket || !id) return

    socket.emit('joinGame', { gameId: id, playerId })

    const handleJoinedGame = (data: { players: string[] }) => {
      setPlayers(data.players)
    }

    const handlePlayerJoined = (data: { players: string[] }) => {
      setPlayers(data.players)
    }

    const handlePlayerLeft = (data: { players: string[] }) => {
      setPlayers(data.players)
    }

    socket.on('joinedGame', handleJoinedGame)
    socket.on('playerJoined', handlePlayerJoined)
    socket.on('playerLeft', handlePlayerLeft)

    return () => {
      socket.emit('leaveGame', { gameId: id, playerId })
      socket.off('joinedGame', handleJoinedGame)
      socket.off('playerJoined', handlePlayerJoined)
      socket.off('playerLeft', handlePlayerLeft)
    }
  }, [socket, id, playerId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-purple-500" size={40} />
          <p className="text-gray-600">Chargement de la partie...</p>
        </div>
      </div>
    )
  }

  if (isError || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500">
            {error?.message || 'Partie non trouvée'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition"
          >
            <ChevronLeft size={20} />
            Retour à la liste
          </button>
        </div>
      </div>
    )
  }

  const displayPlayers = players.length > 0 ? players : game.players

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6"
          >
            <ChevronLeft size={20} />
            Retour à la liste
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Title section */}
          <div className="border-b border-gray-200 p-8">
            <div className="flex justify-between items-start gap-6">
              <h1 className="text-4xl font-bold text-gray-900 flex-1 break-words">
                {game.name}
              </h1>
              <span
                className={`px-4 py-2 rounded text-sm font-bold uppercase whitespace-nowrap ${
                  game.state === 'lobby'
                    ? 'bg-blue-100 text-blue-700'
                    : game.state === 'ingame'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-purple-100 text-purple-700'
                }`}
              >
                {game.state}
              </span>
            </div>
          </div>

          {/* Info sections */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Info */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Informations
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-1">État</p>
                    <p className="text-gray-900 capitalize">{game.state}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-1">
                      Joueurs
                    </p>
                    <p className="text-gray-900">
                      {displayPlayers.length}/{game.maxPlayers}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-1">
                      Créée
                    </p>
                    <p className="text-gray-900">
                      {new Date(game.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-1">
                      Modifiée
                    </p>
                    <p className="text-gray-900">
                      {new Date(game.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Participants */}
              {displayPlayers.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Participants
                  </h2>
                  <ul className="space-y-3">
                    {displayPlayers.map((player) => (
                      <li
                        key={player}
                        className={`flex items-center gap-3 p-3 rounded border ${
                          player === playerId
                            ? 'bg-purple-50 border-purple-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Check
                          size={20}
                          className={
                            player === playerId ? 'text-purple-600' : 'text-green-600'
                          }
                        />
                        <span className="text-gray-900">
                          {player}
                          {player === playerId ? ' (vous)' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Actions</h2>
              {players.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Vous êtes connecté à la partie
                  </p>
                </div>
              )}
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 min-w-48 px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
                >
                  Quitter
                </button>
                <button className="flex-1 min-w-48 px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition flex items-center justify-center gap-2">
                  <Share2 size={20} />
                  Partager
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
