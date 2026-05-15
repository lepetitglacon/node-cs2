import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  FreeCamera,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  type Mesh,
} from '@babylonjs/core'
import type { Room } from '@colyseus/sdk'
import { usePlayerInput } from '@/hooks/usePlayerInput.ts'
import { useTickLoop } from '@/hooks/useTickLoop.ts'

interface Props {
  room: Room
  player: { x: number; y: number; z: number }
  isDebug: boolean
}

const HEIGHT = 1.7
const BODY_Y_OFFSET = 0.85
const LERP = 0.1
const TICK_RATE = 64

export const PlayerCamera = ({ room, player, isDebug }: Props) => {
  const scene = useScene()
  const cameraRef = useRef<FreeCamera | null>(null)
  const debugMeshRef = useRef<Mesh | null>(null)
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const roomRef = useRef(room)
  roomRef.current = room
  const input = usePlayerInput()

  useEffect(() => {
    if (!scene) return

    const canvas = scene.getEngine().getRenderingCanvas()!
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
    camera.attachControl(canvas, true)
    scene.activeCamera = camera
    cameraRef.current = camera

    const requestLock = () => canvas.requestPointerLock()
    canvas.addEventListener('click', requestLock)

    // Capsule de debug (position serveur brute)
    const mat = new StandardMaterial('debug-local-mat', scene)
    mat.wireframe = true
    mat.emissiveColor = new Color3(0, 1, 0)
    const debugMesh = MeshBuilder.CreateCapsule(
      'debug-local',
      { height: 1.7, radius: 0.25 },
      scene
    )
    debugMesh.material = mat
    debugMesh.isVisible = false
    debugMeshRef.current = debugMesh

    return () => {
      canvas.removeEventListener('click', requestLock)
      document.exitPointerLock()
      camera.detachControl()
      camera.dispose()
      debugMesh.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const camera = cameraRef.current
    const p = roomRef.current.state?.players?.get(roomRef.current.sessionId)
    if (!camera || !p) return

    camera.position.x += (p.x - camera.position.x) * LERP
    camera.position.y += (p.y + HEIGHT - camera.position.y) * LERP
    camera.position.z += (p.z - camera.position.z) * LERP

    const debug = debugMeshRef.current
    if (debug) {
      debug.isVisible = isDebugRef.current
      if (isDebugRef.current) {
        debug.position.set(p.x, p.y + BODY_Y_OFFSET, p.z)
      }
    }
  })

  useTickLoop(() => {
    const camera = cameraRef.current
    if (!camera) return

    roomRef.current.send('playerInput', {
      forward: input.current.forward,
      back: input.current.back,
      left: input.current.left,
      right: input.current.right,
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
    })
  }, TICK_RATE)

  return null
}
