import { Scene, Engine } from 'react-babylonjs'
import { Vector3 } from '@babylonjs/core'
import { useRoom, useRoomState } from './roomContext.ts'
import { PlayerCamera } from './PlayerCamera.tsx'

export const Game = () => {
  const { room } = useRoom()
  const players = useRoomState((s) => s?.players)

  if (!room || !players) return null

  const currentPlayer = players[room.sessionId]
  if (!currentPlayer) return null

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
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
          <ground name="ground" width={20} height={20} />

          <PlayerCamera room={room} spawnPosition={currentPlayer} />

          {Object.entries(players).map(([pid, player]) =>
            pid !== room.sessionId ? (
              <box
                key={pid}
                name={`player-${pid}`}
                size={1}
                position={new Vector3(player.x, player.y, player.z)}
                rotation={Vector3.Zero()}
              />
            ) : null
          )}
        </Scene>
      </Engine>
    </div>
  )
}
