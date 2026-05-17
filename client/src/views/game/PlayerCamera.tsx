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
import type { InputState } from '@/hooks/useInput.ts'
import { useTickLoop } from '@/hooks/useTickLoop.ts'
import { applyMovement } from '@/game/movement.ts'

interface Props {
  room: Room
  player: { x: number; y: number; z: number }
  isDebug: boolean
  inputRef: React.MutableRefObject<InputState>
}

const HEIGHT = 1.7
const BODY_Y_OFFSET = 0.85
const RECONCILE_LERP = 0.05
const TICK_RATE = 64

export const PlayerCamera = ({ room, player, isDebug, inputRef }: Props) => {
  const scene = useScene()
  const cameraRef = useRef<FreeCamera | null>(null)
  const debugMeshRef = useRef<Mesh | null>(null)
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const roomRef = useRef(room)
  roomRef.current = room

  const localPos = useRef({ x: player.x, y: player.y, z: player.z })
  const localVel = useRef({ x: 0, z: 0 })

  useEffect(() => {
    if (!scene) return

    localPos.current = { x: player.x, y: player.y, z: player.z }
    localVel.current = { x: 0, z: 0 }

    const canvas = scene.getEngine().getRenderingCanvas()!
    const camera = new FreeCamera(
      'playerCamera',
      new Vector3(player.x, player.y + HEIGHT, player.z),
      scene
    )
    camera.minZ = 0.2
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

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !document.pointerLockElement) return
      const cam = cameraRef.current
      if (!cam) return
      roomRef.current.send('shotStart', { yaw: cam.rotation.y, pitch: cam.rotation.x })
    }
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      roomRef.current.send('shotEnd')
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        const p = roomRef.current.state?.players?.get(roomRef.current.sessionId)
        if (!p || p.isReloading || p.totalAmmo <= 0 || p.bullets >= 30) return
        roomRef.current.send('reload')
      }
    }
    document.addEventListener('keydown', handleKeyDown)

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
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.exitPointerLock()
      camera.detachControl()
      camera.dispose()
      debugMesh.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const camera = cameraRef.current
    const p = roomRef.current.state?.players?.get(roomRef.current.sessionId)
    if (!camera || !p || !scene) return

    if (p.state === 'dead') {
      camera.position.x = p.x
      camera.position.y = p.headY
      camera.position.z = p.z
      return
    }

    localPos.current.y = p.y
    localPos.current.x += (p.x - localPos.current.x) * RECONCILE_LERP
    localPos.current.z += (p.z - localPos.current.z) * RECONCILE_LERP

    camera.position.x = localPos.current.x
    camera.position.y = localPos.current.y + HEIGHT
    camera.position.z = localPos.current.z

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

    applyMovement(localVel.current, inputRef.current, camera.rotation.y)
    localPos.current.x += localVel.current.x
    localPos.current.z += localVel.current.z

    roomRef.current.send('playerInput', {
      forward: inputRef.current.forward,
      back: inputRef.current.back,
      left: inputRef.current.left,
      right: inputRef.current.right,
      sprint: inputRef.current.sprint,
      crouch: inputRef.current.crouch,
      jump: inputRef.current.jump,
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
    })
  }, TICK_RATE)

  return null
}
