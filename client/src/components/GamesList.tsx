import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Plus, Loader } from 'lucide-react'
import { useGames } from '@/hooks/useGames'
import { CreateGameModal } from './CreateGameModal'

export const GamesList = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { data: games, isLoading, isError, error } = useGames()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-purple-500" size={40} />
          <p className="text-gray-600">Chargement des jeux...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Erreur: {error?.message || 'Impossible de charger les jeux'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-900">Liste des jeux</h1>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
            >
              <Plus size={20} />
              Créer une partie
            </button>
          </div>
        </div>
      </div>

      <CreateGameModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {games && games.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-lg text-gray-500">Aucun jeu disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games?.map((game) => (
              <RouterLink
                key={game._id}
                to={`/game/${game._id}`}
                className="block group"
              >
                <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition p-6 h-full flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-3">
                    <h2 className="text-lg font-bold text-gray-900 flex-1 line-clamp-2">
                      {game.name}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap uppercase ${
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

                  {/* Info */}
                  <div className="space-y-2 text-sm text-gray-600 flex-1">
                    <p>
                      <strong>Joueurs:</strong> {game.players.length}/{game.maxPlayers}
                    </p>
                    <p>
                      <strong>Créé:</strong> {new Date(game.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Participants */}
                  {game.players.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      <p className="text-xs font-bold text-gray-600 mb-2">Participants:</p>
                      <ul className="space-y-1">
                        {game.players.map((player) => (
                          <li key={player} className="text-sm text-gray-700">
                            • {player}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Button */}
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded font-bold text-sm hover:bg-purple-700 transition mt-auto"
                  >
                    Rejoindre
                  </button>
                </div>
              </RouterLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
