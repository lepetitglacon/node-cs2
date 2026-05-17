import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  SceneLoader,
  CreateSoundAsync,
  Vector3,
  type AbstractMesh,
  type StaticSound,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { Room } from '@colyseus/sdk'

interface Props {
  room: Room
}

const WEAPON_URL = 'http://localhost:2567/assets/weapon/ak-47.glb'
const SHOT_SOUND_URL = 'http://localhost:2567/assets/sound/ak_shot.wav'
const SHOT_POOL_SIZE = 6
const WEAPON_OFFSET = new Vector3(0.15, -0.25, 0.4)
const WEAPON_ROTATION = new Vector3(0, Math.PI * 1.5, 0)
const WEAPON_GROUP = 2

const SWAY_SENSITIVITY = 0.0015
const SWAY_MAX = 0.06
const SWAY_LERP = 0.08
const SWAY_DECAY = 0.8

const RECOIL_APPLY_LERP = 0.4
const RECOIL_RECOVERY_LERP = 0.06
const RECOIL_RECOVERY_DELAY = 250

export const WeaponManager = ({ room }: Props) => {
  const scene = useScene()
  const meshRef = useRef<AbstractMesh | null>(null)
  const swayRef = useRef({ x: 0, y: 0 })
  const mouseDeltaRef = useRef({ x: 0, y: 0 })
  const targetRecoilRef = useRef({ pitch: 0, yaw: 0 })
  const appliedRecoilRef = useRef({ pitch: 0, yaw: 0 })
  const lastRecoilTimeRef = useRef(0)
  const shotPoolRef = useRef<StaticSound[]>([])
  const shotPoolIndexRef = useRef(0)

  useEffect(() => {
    if (!scene) return

    let cancelled = false

    const aud = async () => {
      const pool: StaticSound[] = []
      for (let i = 0; i < SHOT_POOL_SIZE; i++) {
        pool.push(await CreateSoundAsync(`ak-shot-local-${i}`, SHOT_SOUND_URL))
      }
      if (!cancelled) {
        shotPoolRef.current = pool
        shotPoolIndexRef.current = 0
      } else {
        pool.forEach((s) => s.dispose())
      }
    }
    aud()

    // Le groupe 2 se rend après la scène principale.
    // On vide le depth buffer avant ce groupe pour que l'arme passe toujours devant.
    scene.setRenderingAutoClearDepthStencil(WEAPON_GROUP, true)

    SceneLoader.ImportMeshAsync('', WEAPON_URL, '', scene).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        return
      }
      const camera = scene.getCameraByName('playerCamera')
      if (!camera) {
        result.meshes.forEach((m) => m.dispose())
        return
      }
      const root = result.meshes[0]
      result.meshes.forEach((m) => {
        m.renderingGroupId = WEAPON_GROUP
      })
      root.parent = camera
      root.position = WEAPON_OFFSET.clone()
      root.rotation = WEAPON_ROTATION.clone()
      meshRef.current = root
    })

    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      mouseDeltaRef.current.x += e.movementX
      mouseDeltaRef.current.y += e.movementY
    }

    const recoilHandler = room.onMessage(
      'recoil',
      (data: { pitch: number; yaw: number }) => {
        targetRecoilRef.current = { pitch: data.pitch, yaw: data.yaw }
        lastRecoilTimeRef.current = Date.now()
        const p = shotPoolRef.current
        if (p.length > 0) {
          p[shotPoolIndexRef.current].play()
          shotPoolIndexRef.current = (shotPoolIndexRef.current + 1) % p.length
        }
      }
    )

    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelled = true
      recoilHandler()
      document.removeEventListener('mousemove', handleMouseMove)
      meshRef.current?.dispose()
      meshRef.current = null
      shotPoolRef.current.forEach((s) => s.dispose())
      shotPoolRef.current = []
    }
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // Sway
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v))
    const targetX = clamp(mouseDeltaRef.current.x * SWAY_SENSITIVITY, SWAY_MAX)
    const targetY = clamp(mouseDeltaRef.current.y * SWAY_SENSITIVITY, SWAY_MAX)
    mouseDeltaRef.current.x *= SWAY_DECAY
    mouseDeltaRef.current.y *= SWAY_DECAY

    swayRef.current.x += (targetX - swayRef.current.x) * SWAY_LERP
    swayRef.current.y += (targetY - swayRef.current.y) * SWAY_LERP

    mesh.position.x = WEAPON_OFFSET.x - swayRef.current.x
    mesh.position.y = WEAPON_OFFSET.y - swayRef.current.y
    mesh.rotation.x = WEAPON_ROTATION.x - swayRef.current.y
    mesh.rotation.y = WEAPON_ROTATION.y
    mesh.rotation.z = WEAPON_ROTATION.z - swayRef.current.x * 0.3

    // Recoil — appliqué en delta sur la caméra pour ne pas perturber la rotation souris
    const camera = scene?.activeCamera
    if (!camera) return

    const recovering =
      Date.now() - lastRecoilTimeRef.current > RECOIL_RECOVERY_DELAY

    if (recovering) {
      targetRecoilRef.current.pitch +=
        (0 - targetRecoilRef.current.pitch) * RECOIL_RECOVERY_LERP
      targetRecoilRef.current.yaw +=
        (0 - targetRecoilRef.current.yaw) * RECOIL_RECOVERY_LERP
    }

    const newPitch =
      appliedRecoilRef.current.pitch +
      (targetRecoilRef.current.pitch - appliedRecoilRef.current.pitch) *
        RECOIL_APPLY_LERP
    const newYaw =
      appliedRecoilRef.current.yaw +
      (targetRecoilRef.current.yaw - appliedRecoilRef.current.yaw) *
        RECOIL_APPLY_LERP

    camera.rotation.x -= newPitch - appliedRecoilRef.current.pitch
    camera.rotation.y += newYaw - appliedRecoilRef.current.yaw

    appliedRecoilRef.current = { pitch: newPitch, yaw: newYaw }
  })

  return null
}
