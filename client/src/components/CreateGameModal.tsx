import { useState } from 'react'
import { X } from 'lucide-react'
import { useCreateGame } from '@/hooks/useCreateGame'

interface CreateGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateGameModal = ({ isOpen, onClose }: CreateGameModalProps) => {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('2')
  const { mutate: createGame, isPending } = useCreateGame()

  const handleSubmit = () => {
    if (!name.trim()) return

    createGame(
      { name: name.trim(), maxPlayers: parseInt(maxPlayers) },
      {
        onSuccess: () => {
          setName('')
          setMaxPlayers('2')
          onClose()
        },
      }
    )
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Créer une nouvelle partie</h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1 hover:bg-gray-100 rounded transition disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Nom de la partie
            </label>
            <input
              type="text"
              placeholder="Ex: Partie épique"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Nombre de joueurs maximum
            </label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              min="2"
              max="16"
              disabled={isPending}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50"
          >
            {isPending ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
