import { useEffect, useState } from 'react'
import { Scene, Engine, useScene } from 'react-babylonjs'
import { Vector3 } from '@babylonjs/core'
import { useDebugMode } from '@/hooks/useDebugMode.ts'
import { useGame } from './GameContext.tsx'
import { PlayerCamera } from './PlayerCamera.tsx'
import { WeaponManager } from './WeaponManager.tsx'
import { ImpactEffects } from './ImpactEffects.tsx'
import { OtherPlayer } from './OtherPlayer.tsx'
import { MapLoader } from './MapLoader.tsx'
import { DebugMapMesh } from './DebugMapMesh.tsx'
import { EnvironmentSetup } from './EnvironmentSetup.tsx'
import { GameOverlay } from '@/components/GameOverlay.tsx'
import { DeathScreen } from '@/components/DeathScreen.tsx'
import { LoadingScreen } from '@/components/LoadingScreen.tsx'
import { LobbyScreen } from '@/components/LobbyScreen.tsx'
import { preloadAssets } from '@/game/assets/preloader.ts'

interface PreloaderProps {
  mapId: string
  onProgress: (p: number) => void
  onReady: () => void
}

const AssetPreloader = ({ mapId, onProgress, onReady }: PreloaderProps) => {
  const scene = useScene()
  useEffect(() => {
    if (!scene) return
    let cancelled = false
    preloadAssets(scene, mapId, (p) => {
      if (!cancelled) onProgress(p.loaded / p.total)
    })
      .then(() => {
        if (!cancelled) onReady()
      })
      .catch((err) => console.error('[preloader] failed', err))
    return () => {
      cancelled = true
    }
  }, [scene, mapId])
  return null
}

export const Game = () => {
  const { room, currentPlayer, otherPlayers, isReady, state, inputRef } =
    useGame()
  const isDebug = useDebugMode()

  const [progress, setProgress] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  const [userPlayed, setUserPlayed] = useState(false)

  if (!isReady) return <LoadingScreen />

  const mapId = state?.mapId ?? 'test1'
  const playing = assetsReady && userPlayed

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {playing && (
        <GameOverlay>
          <DeathScreen />
        </GameOverlay>
      )}
      {playing && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            zIndex: 10,
            color: 'white',
            fontFamily: 'monospace',
            fontSize: 22,
            fontWeight: 'bold',
            pointerEvents: 'none',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{ color: currentPlayer?.isReloading ? '#f90' : 'white' }}
          >
            {currentPlayer?.isReloading
              ? 'RELOAD...'
              : (currentPlayer?.bullets ?? 30)}
          </span>
          <span style={{ color: '#aaa', fontSize: 16 }}>
            / {currentPlayer?.totalAmmo ?? 90}
          </span>
        </div>
      )}
      {isDebug && playing && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: 12,
            background: 'rgba(0,0,0,0.5)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          DEBUG
        </div>
      )}
      <Engine
        antialias
        adaptToDeviceRatio
        canvasId="babylon-js"
        engineOptions={{ audioEngine: true }}
        renderOptions={{ whenVisibleOnly: true }}
      >
        <Scene>
          <hemisphericLight
            name="light1"
            intensity={0.5}
            direction={new Vector3(0, 1, 0)}
          />
          <AssetPreloader
            mapId={mapId}
            onProgress={setProgress}
            onReady={() => setAssetsReady(true)}
          />
          {assetsReady && <EnvironmentSetup envKey="grasslands_sunset" />}
          {playing && (
            <>
              <MapLoader mapId={mapId} />
              <DebugMapMesh room={room!} isDebug={isDebug} />
              <PlayerCamera
                room={room!}
                player={currentPlayer!}
                isDebug={isDebug}
                inputRef={inputRef}
              />
              <WeaponManager room={room!} />
              <ImpactEffects room={room!} />
              {otherPlayers &&
                Object.entries(otherPlayers).map(([pid]) =>
                  pid !== room!.sessionId ? (
                    <OtherPlayer
                      key={pid}
                      pid={pid}
                      name={`player-${pid}`}
                      isDebug={isDebug}
                    />
                  ) : null
                )}
            </>
          )}
        </Scene>
      </Engine>
      {!playing && (
        <LobbyScreen
          progress={progress}
          ready={assetsReady}
          mapName={mapId}
          onPlay={() => setUserPlayed(true)}
        />
      )}
    </div>
  )
}
