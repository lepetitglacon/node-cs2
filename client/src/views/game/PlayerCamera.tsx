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
import {
  BODY_Y_OFFSET,
  ClientPhysics,
  initRapier,
  type MeshGeometry,
  type ColliderDescriptor,
} from '@/game/physicsClient.ts'

interface Props {
  room: Room
  player: { x: number; y: number; z: number }
  isDebug: boolean
  inputRef: React.MutableRefObject<InputState>
}

const HEIGHT = 1.7
const EYE_OVER_BODY = HEIGHT - BODY_Y_OFFSET
const TICK_RATE = 60

export const PlayerCamera = ({ room, player, isDebug, inputRef }: Props) => {
  const scene = useScene()
  const cameraRef = useRef<FreeCamera | null>(null)
  const debugMeshRef = useRef<Mesh | null>(null)
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const roomRef = useRef(room)
  roomRef.current = room

  const physicsRef = useRef<ClientPhysics | null>(null)

  useEffect(() => {
    if (!scene) return

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

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    initRapier().then(() => {
      if (cancelled) return
      const physics = new ClientPhysics()
      physicsRef.current = physics
      physics.createPlayerBody(player.x, player.y, player.z)

      unsubscribe = roomRef.current.onMessage(
        'debugMapMesh',
        (data: { geometries: MeshGeometry[]; colliders: ColliderDescriptor[] }) => {
          if (cancelled) return
          physics.loadColliders(data.geometries, data.colliders)
        }
      )
      roomRef.current.send('requestDebugMesh')
    })

    return () => {
      cancelled = true
      unsubscribe?.()
      physicsRef.current?.dispose()
      physicsRef.current = null
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
    if (!camera || !p) return

    if (p.state === 'dead') {
      camera.position.set(p.x, p.headY, p.z)
      return
    }

    const physics = physicsRef.current
    if (physics?.playerBody && physics.hasColliders) {
      physics.reconcile(p.x, p.y, p.z)
      const bodyPos = physics.getBodyPosition()!
      camera.position.x = bodyPos.x
      camera.position.y = bodyPos.y + EYE_OVER_BODY
      camera.position.z = bodyPos.z

      const debug = debugMeshRef.current
      if (debug) {
        debug.isVisible = isDebugRef.current
        if (isDebugRef.current) {
          debug.position.set(p.x, p.y + BODY_Y_OFFSET, p.z)
        }
      }
      return
    }

    // Fallback avant que la physique soit prête
    camera.position.set(p.x, p.y + HEIGHT, p.z)
  })

  useTickLoop(() => {
    const camera = cameraRef.current
    if (!camera) return

    const physics = physicsRef.current
    if (physics) physics.step(inputRef.current, camera.rotation.y)

    roomRef.current.send('playerInput', {
      forward: inputRef.current.forward,
      back:    inputRef.current.back,
      left:    inputRef.current.left,
      right:   inputRef.current.right,
      sprint:  inputRef.current.sprint,
      crouch:  inputRef.current.crouch,
      jump:    inputRef.current.jump,
      yaw:   camera.rotation.y,
      pitch: camera.rotation.x,
    })
  }, TICK_RATE)

  return null
}
