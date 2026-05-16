import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  FreeCamera,
  SceneLoader,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'

const WEAPON_URL = 'http://localhost:2567/assets/weapon/ak-47.glb'
const WEAPON_OFFSET = new Vector3(0.15, -0.25, 0.4)
const WEAPON_ROTATION = new Vector3(0, Math.PI * 1.5, 0)
const WEAPON_LAYER = 0x10000000

const SWAY_SENSITIVITY = 0.0015
const SWAY_MAX = 0.06
const SWAY_LERP = 0.08
const SWAY_DECAY = 0.8

export const WeaponManager = () => {
  const scene = useScene()
  const meshRef = useRef<AbstractMesh | null>(null)
  const weaponCameraRef = useRef<FreeCamera | null>(null)
  const swayRef = useRef({ x: 0, y: 0 })
  const mouseDeltaRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!scene) return

    // Weapon camera: only renders WEAPON_LAYER, clears depth so weapon always renders on top
    const weaponCamera = new FreeCamera('weaponCamera', Vector3.Zero(), scene)
    weaponCamera.layerMask = WEAPON_LAYER
    weaponCamera.minZ = 0.01
    weaponCamera.maxZ = 10
    weaponCamera.parent = scene.activeCamera
    scene.activeCameras = [scene.activeCamera!, weaponCamera]
    weaponCameraRef.current = weaponCamera

    // Main camera excludes weapon layer
    scene.activeCamera!.layerMask = 0x0fffffff & ~WEAPON_LAYER

    let cancelled = false
    SceneLoader.ImportMeshAsync('', WEAPON_URL, '', scene).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        return
      }
      const root = result.meshes[0]
      result.meshes.forEach((m) => {
        m.layerMask = WEAPON_LAYER
      })
      // Attach to weapon camera so it follows automatically
      root.parent = weaponCamera
      root.position = WEAPON_OFFSET.clone()
      root.rotation = WEAPON_ROTATION.clone()
      meshRef.current = root
    })

    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      mouseDeltaRef.current.x += e.movementX
      mouseDeltaRef.current.y += e.movementY
    }
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelled = true
      document.removeEventListener('mousemove', handleMouseMove)
      meshRef.current?.dispose()
      meshRef.current = null
      weaponCamera.dispose()
      weaponCameraRef.current = null
      if (scene.activeCamera) {
        scene.activeCamera.layerMask = 0x0fffffff
        scene.activeCameras = [scene.activeCamera]
      }
    }
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const clamp = (v: number) => Math.max(-SWAY_MAX, Math.min(SWAY_MAX, v))
    const targetX = clamp(mouseDeltaRef.current.x * SWAY_SENSITIVITY)
    const targetY = clamp(mouseDeltaRef.current.y * SWAY_SENSITIVITY)
    mouseDeltaRef.current.x *= SWAY_DECAY
    mouseDeltaRef.current.y *= SWAY_DECAY

    swayRef.current.x += (targetX - swayRef.current.x) * SWAY_LERP
    swayRef.current.y += (targetY - swayRef.current.y) * SWAY_LERP

    mesh.position.x = WEAPON_OFFSET.x - swayRef.current.x
    mesh.position.y = WEAPON_OFFSET.y - swayRef.current.y
    mesh.rotation.x = WEAPON_ROTATION.x - swayRef.current.y
    mesh.rotation.y = WEAPON_ROTATION.y
    mesh.rotation.z = WEAPON_ROTATION.z - swayRef.current.x * 0.3
  })

  return null
}
