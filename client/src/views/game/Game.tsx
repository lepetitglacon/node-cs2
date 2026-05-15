import { Scene, Engine } from 'react-babylonjs'
import { Vector3 } from '@babylonjs/core'
import { useRoom, useRoomState } from './roomContext.ts'
import { useDebugMode } from '@/hooks/useDebugMode.ts'
import { PlayerCamera } from './PlayerCamera.tsx'
import { OtherPlayer } from './OtherPlayer.tsx'

export const Game = () => {
  const { room } = useRoom()
  const state = useRoomState()
  const isDebug = useDebugMode()

  if (!room || !state) return null

  const players = state.players
  const currentPlayer = players?.[room.sessionId]

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {isDebug && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 10,
          color: '#0f0', fontFamily: 'monospace', fontSize: 12,
          background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4,
          pointerEvents: 'none',
        }}>
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
          <hemisphericLight name="light1" intensity={0.7} direction={new Vector3(0, 1, 0)} />
          <ground name="ground" width={20} height={20} />

          {currentPlayer && <PlayerCamera room={room} player={currentPlayer} isDebug={isDebug} />}

          {players &&
            Object.entries(players).map(([pid]) =>
              pid !== room.sessionId ? (
                <OtherPlayer key={pid} pid={pid} name={`player-${pid}`} isDebug={isDebug} />
              ) : null,
            )}
        </Scene>
      </Engine>
    </div>
  )
}
