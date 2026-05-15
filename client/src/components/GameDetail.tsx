import { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom, useRoomState } from '@colyseus/react'
import { client } from '@/components/GamesList.tsx'
import { Scene, Engine } from 'react-babylonjs'
import { Vector3 } from '@babylonjs/core'

export const GameDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { room } = useRoom(() => client.joinById(id))
  const state = useRoomState(room)
  const players = useRoomState(room, (s) => s.players)

  if (!state) return

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <pre>{JSON.stringify(players, null, 2)}</pre>
      </div>

      <Engine
        antialias
        adaptToDeviceRatio
        canvasId="babylon-js"
        renderOptions={{
          whenVisibleOnly: true,
        }}
      >
        <Scene>
          <freeCamera
            name="camera1"
            position={new Vector3(0, 5, -10)}
            setTarget={[Vector3.Zero()]}
          />
          <hemisphericLight
            name="light1"
            intensity={0.7}
            direction={new Vector3(0, 1, 0)}
          />
          <ground name="ground" width={6} height={6} />

          {players &&
            Object.entries(players).map(([id, player]) => (
              <box
                name="box"
                size={1}
                position={new Vector3(player.x, player.y, player.z)}
                rotation={Vector3.Zero()}
              />
            ))}
        </Scene>
      </Engine>
    </div>
  )
}
