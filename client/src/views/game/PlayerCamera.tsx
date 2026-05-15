import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { FreeCamera, Vector3 } from '@babylonjs/core'
import type { Room } from '@colyseus/sdk'
import { usePlayerInput } from '@/hooks/usePlayerInput.ts'
import { useTickLoop } from '@/hooks/useTickLoop.ts'
import { applyMovement } from '@/game/movement.ts'

interface Props {
  room: Room
  player: { x: number; y: number; z: number }
}

const HEIGHT = 1.7
const TICK_RATE = 64
const SOFT_THRESHOLD = 0.3
const HARD_THRESHOLD = 2.0
const SOFT_CORRECTION = 0.05

export const PlayerCamera = ({ room, player }: Props) => {
  const scene = useScene()
  const cameraRef = useRef<FreeCamera | null>(null)
  const roomRef = useRef(room)
  roomRef.current = room
  const input = usePlayerInput()
  const velocity = useRef({ x: 0, z: 0 })
  const predicted = useRef({ x: player.x, y: player.y, z: player.z })

  useEffect(() => {
    if (!scene) return

    const camera = new FreeCamera(
      'playerCamera',
      new Vector3(player.x, player.y + HEIGHT, player.z),
      scene
    )
    camera.setTarget(new Vector3(player.x + 1, player.y + HEIGHT, player.z))
    camera.keysUp = []
    camera.keysLeft = []
    camera.keysDown = []
    camera.keysRight = []
    camera.inertia = 0
    const canvas = scene.getEngine().getRenderingCanvas()!
    camera.attachControl(canvas, true)
    scene.activeCamera = camera
    cameraRef.current = camera

    const requestLock = () => canvas.requestPointerLock()
    canvas.addEventListener('click', requestLock)

    return () => {
      canvas.removeEventListener('click', requestLock)
      document.exitPointerLock()
      camera.detachControl()
      camera.dispose()
    }
  }, [scene])

  // Physique à 64/s — même cadence que le serveur
  useTickLoop(() => {
    const camera = cameraRef.current
    const r = roomRef.current
    const serverPlayer = r.state?.players?.get(r.sessionId)
    if (!camera || !serverPlayer) return

    applyMovement(velocity.current, input.current, camera.rotation.y)
    predicted.current.x += velocity.current.x
    predicted.current.z += velocity.current.z
    predicted.current.y = serverPlayer.y

    const dx = serverPlayer.x - predicted.current.x
    const dz = serverPlayer.z - predicted.current.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    if (distance > HARD_THRESHOLD) {
      predicted.current.x = serverPlayer.x
      predicted.current.z = serverPlayer.z
      velocity.current.x = 0
      velocity.current.z = 0
    } else if (distance > SOFT_THRESHOLD) {
      predicted.current.x += dx * SOFT_CORRECTION
      predicted.current.z += dz * SOFT_CORRECTION
    }

    r.send('playerInput', {
      forward: input.current.forward,
      back: input.current.back,
      left: input.current.left,
      right: input.current.right,
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
    })
  }, TICK_RATE)

  // Rendu — lerp caméra vers position prédite chaque frame
  useBeforeRender(() => {
    const camera = cameraRef.current
    if (!camera) return

    camera.position.x += (predicted.current.x - camera.position.x) * 0.8
    camera.position.y +=
      (predicted.current.y + HEIGHT - camera.position.y) * 0.8
    camera.position.z += (predicted.current.z - camera.position.z) * 0.8
  })

  return null
}
