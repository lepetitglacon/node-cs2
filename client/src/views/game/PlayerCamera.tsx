import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { FreeCamera, Vector3 } from '@babylonjs/core'
import type { Room } from '@colyseus/sdk'

interface Props {
  room: Room
  spawnPosition: { x: number; y: number; z: number }
}

const HEIGHT = 1.7

export const PlayerCamera = ({ room, spawnPosition }: Props) => {
  const scene = useScene()
  const cameraRef = useRef<FreeCamera | null>(null)
  const lastState = useRef({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 })

  useEffect(() => {
    if (!scene) return

    const camera = new FreeCamera(
      'playerCamera',
      new Vector3(spawnPosition.x, spawnPosition.y + HEIGHT, spawnPosition.z),
      scene,
    )
    camera.setTarget(new Vector3(spawnPosition.x + 1, spawnPosition.y + HEIGHT, spawnPosition.z))

    camera.keysUp = [90]    // Z
    camera.keysLeft = [81]  // Q
    camera.keysDown = [83]  // S
    camera.keysRight = [68] // D
    camera.speed = 0.15

    camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
    scene.activeCamera = camera
    cameraRef.current = camera

    return () => {
      camera.detachControl()
      camera.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const camera = cameraRef.current
    if (!camera) return

    const x = camera.position.x
    const y = camera.position.y - HEIGHT
    const z = camera.position.z
    const yaw = camera.rotation.y
    const pitch = camera.rotation.x

    const prev = lastState.current
    if (x !== prev.x || y !== prev.y || z !== prev.z || yaw !== prev.yaw || pitch !== prev.pitch) {
      lastState.current = { x, y, z, yaw, pitch }
      room.send('playerMove', { x, y, z, yaw, pitch })
    }
  })

  return null
}
