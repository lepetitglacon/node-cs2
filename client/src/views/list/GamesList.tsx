import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobbyRoom } from '@colyseus/react'
import { Plus, Users, Loader2, AlertCircle } from 'lucide-react'
import { client } from '@/services/colyseus.service.ts'

type GameMode = 'matchmaking_10v10' | 'sd_5v5'

const MODE_LABEL: Record<GameMode, string> = {
  matchmaking_10v10: '10v10 Casual',
  sd_5v5: '5v5 Compétitif',
}

const MAP_GRADIENT: Record<string, string> = {
  test1: 'from-purple-200 via-purple-100 to-indigo-200',
}

const DEFAULT_GRADIENT = 'from-slate-200 via-slate-100 to-slate-300'

const mapPreview = (mapId: string) => `/assets/map/${mapId}.jpg`

interface RoomCardProps {
  mapId?: string
  mode?: GameMode
  clients: number
  maxClients: number
  onJoin: () => void
}

const RoomCard = ({ mapId, mode, clients, maxClients, onJoin }: RoomCardProps) => {
  const [imgFailed, setImgFailed] = useState(false)
  const gradient = MAP_GRADIENT[mapId ?? ''] ?? DEFAULT_GRADIENT
  const isFull = clients >= maxClients
  const fillRatio = clients / maxClients

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={isFull}
      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-[0_8px_24px_-8px_rgba(170,59,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-sm"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {!imgFailed && mapId && (
          <img
            src={mapPreview(mapId)}
            alt={mapId}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        )}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} ${
            imgFailed || !mapId ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent" />

        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
          <Users size={12} />
          <span className={isFull ? 'text-red-500' : ''}>
            {clients}/{maxClients}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            {mapId ?? 'unknown'}
          </h3>
          {mode && (
            <p className="text-xs font-medium uppercase tracking-widest text-purple-600">
              {MODE_LABEL[mode] ?? mode}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              isFull ? 'bg-red-400' : fillRatio > 0.7 ? 'bg-orange-400' : 'bg-purple-400'
            }`}
            style={{ width: `${fillRatio * 100}%` }}
          />
        </div>
        <span className="ml-3 text-xs font-semibold uppercase tracking-wider text-purple-600 group-hover:text-purple-700">
          {isFull ? 'Complet' : 'Rejoindre →'}
        </span>
      </div>
    </button>
  )
}

const SkeletonCard = ({ delay }: { delay: number }) => (
  <div
    className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-60"
    style={{
      animation: 'gamelist-pulse 1.6s ease-in-out infinite',
      animationDelay: `${delay}ms`,
    }}
  >
    <div className="aspect-[16/10] w-full bg-slate-100" />
    <div className="space-y-2 px-4 py-3">
      <div className="h-3 w-2/3 rounded bg-slate-100" />
      <div className="h-1.5 w-full rounded-full bg-slate-100" />
    </div>
  </div>
)

export const GamesList = () => {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const { rooms, room: lobbyRoom, error, isConnecting } = useLobbyRoom(() =>
    client.joinOrCreate('lobby')
  )

  useEffect(() => {
    if (lobbyRoom) lobbyRoom.send('filter')
  }, [lobbyRoom])

  const createRoom = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const room = await client.create('my_room')
      navigate(`/game/${room.roomId}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        @keyframes gamelist-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-600">
              Lobby
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Parties en cours
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {rooms.length} {rooms.length > 1 ? 'parties disponibles' : 'partie disponible'}
            </p>
          </div>
          <button
            type="button"
            onClick={createRoom}
            disabled={isCreating}
            className="inline-flex items-center gap-3 rounded-md border border-purple-700 bg-purple-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_2px_0_0_rgb(126_34_206)] transition-all hover:bg-purple-700 active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Plus size={18} strokeWidth={2.5} />
            )}
            <span>Créer une partie</span>
          </button>
        </header>

        {isConnecting && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
            <Loader2 className="animate-spin" size={20} />
            <span>Connexion au lobby…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle size={20} />
            <span>{error.message}</span>
          </div>
        )}

        {!isConnecting && !error && rooms.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => {
              const meta = (room.metadata ?? {}) as { mapId?: string; mode?: GameMode }
              return (
                <RoomCard
                  key={room.roomId}
                  mapId={meta.mapId}
                  mode={meta.mode}
                  clients={room.clients}
                  maxClients={room.maxClients}
                  onJoin={() => navigate(`/game/${room.roomId}`)}
                />
              )
            })}
          </div>
        )}

        {!isConnecting && !error && rooms.length === 0 && (
          <div className="relative">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard delay={0} />
              <SkeletonCard delay={200} />
              <SkeletonCard delay={400} />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-full bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm backdrop-blur">
                Aucune partie en cours — crée la première !
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
