import { Scene, Engine } from 'react-babylonjs'
import { Vector3 } from '@babylonjs/core'
import { useDebugMode } from '@/hooks/useDebugMode.ts'
import { useGame } from './GameContext.tsx'
import { PlayerCamera } from './PlayerCamera.tsx'
import { WeaponManager } from './WeaponManager.tsx'
import { OtherPlayer } from './OtherPlayer.tsx'
import { MapLoader } from './MapLoader.tsx'
import { DebugMapMesh } from './DebugMapMesh.tsx'
import { GameOverlay } from '@/components/GameOverlay.tsx'
import { DeathScreen } from '@/components/DeathScreen.tsx'
import { LoadingScreen } from '@/components/LoadingScreen.tsx'

export const Game = () => {
  const { room, currentPlayer, otherPlayers, isReady, state, inputRef } = useGame()
  const isDebug = useDebugMode()

  if (!isReady) return <LoadingScreen />

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GameOverlay>
        <DeathScreen />
      </GameOverlay>
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
        <span style={{ color: currentPlayer?.isReloading ? '#f90' : 'white' }}>
          {currentPlayer?.isReloading
            ? 'RELOAD...'
            : (currentPlayer?.bullets ?? 30)}
        </span>
        <span style={{ color: '#aaa', fontSize: 16 }}>
          / {currentPlayer?.totalAmmo ?? 90}
        </span>
      </div>
      {isDebug && (
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
        renderOptions={{ whenVisibleOnly: true }}
      >
        <Scene>
          <hemisphericLight
            name="light1"
            intensity={0.7}
            direction={new Vector3(0, 1, 0)}
          />
          <MapLoader mapId={state?.mapId ?? 'test1'} />
          <DebugMapMesh room={room!} isDebug={isDebug} />

          <PlayerCamera
            room={room!}
            player={currentPlayer!}
            isDebug={isDebug}
            inputRef={inputRef}
          />
          <WeaponManager room={room!} />

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
        </Scene>
      </Engine>
    </div>
  )
}
