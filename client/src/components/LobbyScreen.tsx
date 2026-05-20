import { Loader2, Play } from 'lucide-react'

interface Props {
  progress: number
  ready: boolean
  onPlay: () => void
  mapName?: string
}

export const LobbyScreen = ({ progress, ready, onPlay, mapName }: Props) => {
  const pct = Math.round(progress * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
          {mapName ? `Map · ${mapName}` : 'Préparation'}
        </p>
        <h2 className="mt-3 text-3xl font-bold text-white">
          {ready ? 'Prêt à jouer' : 'Chargement…'}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {ready
            ? 'Clique pour entrer en partie et activer le son.'
            : 'Téléchargement des assets, ça ne sera pas long.'}
        </p>

        <div className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-300 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-mono text-slate-500">{pct}%</p>
        </div>

        <button
          type="button"
          onClick={onPlay}
          disabled={!ready}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-md border border-purple-700 bg-purple-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_2px_0_0_rgb(126_34_206)] transition-all hover:bg-purple-700 active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:active:translate-y-0"
        >
          {ready ? (
            <>
              <Play size={18} strokeWidth={2.5} />
              <span>Jouer</span>
            </>
          ) : (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Chargement</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
