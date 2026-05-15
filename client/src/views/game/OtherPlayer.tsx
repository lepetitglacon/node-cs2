import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { SceneLoader, MeshBuilder, Quaternion, Vector3, StandardMaterial, Color3, type Mesh, type AbstractMesh, type AnimationGroup } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { useRoom } from './roomContext.ts'

interface Props {
  pid: string
  name: string
  isDebug: boolean
}

const LERP = 0.2
const BODY_Y_OFFSET = 0.85
const MODEL_URL = 'http://localhost:2567/assets/soldier.glb'
const MODEL_OFFSET = Quaternion.RotationAxis(Vector3.Up(), Math.PI)

export const OtherPlayer = ({ pid, name, isDebug }: Props) => {
  const scene = useScene()
  const { room } = useRoom()
  const roomRef = useRef(room)
  roomRef.current = room
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const meshRef = useRef<AbstractMesh | null>(null)
  const debugMeshRef = useRef<Mesh | null>(null)
  const animGroupsRef = useRef<AnimationGroup[]>([])

  useEffect(() => {
    if (!scene) return

    const p = roomRef.current?.state?.players?.get(pid)
    let rootMesh: AbstractMesh | null = null
    let cancelled = false

    SceneLoader.ImportMeshAsync('', MODEL_URL, '', scene).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        result.animationGroups.forEach((ag) => ag.dispose())
        return
      }
      rootMesh = result.meshes[0]
      rootMesh.name = name
      rootMesh.position.set(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0)
      const serverQuat = new Quaternion(p?.qx ?? 0, p?.qy ?? 0, p?.qz ?? 0, p?.qw ?? 1)
      rootMesh.rotationQuaternion = serverQuat.multiply(MODEL_OFFSET)
      meshRef.current = rootMesh

      animGroupsRef.current = result.animationGroups
      result.animationGroups.forEach((ag) => ag.stop())
      const idle = result.animationGroups.find((ag) => ag.name === 'idle.001')
      idle?.start(true)
    })

    const mat = new StandardMaterial(`debug-${pid}-mat`, scene)
    mat.wireframe = true
    mat.emissiveColor = new Color3(1, 0.3, 0)
    const debugMesh = MeshBuilder.CreateCapsule(`debug-${pid}`, { height: 1.7, radius: 0.25 }, scene)
    debugMesh.material = mat
    debugMesh.isVisible = false
    debugMeshRef.current = debugMesh

    return () => {
      cancelled = true
      animGroupsRef.current.forEach((ag) => ag.dispose())
      meshRef.current?.dispose()
      meshRef.current = null
      debugMesh.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    const p = roomRef.current?.state?.players?.get(pid)
    if (!mesh || !p) return

    mesh.position.x += (p.x - mesh.position.x) * LERP
    mesh.position.y += (p.y + 0.5 - mesh.position.y) * LERP
    mesh.position.z += (p.z - mesh.position.z) * LERP

    if (mesh.rotationQuaternion) {
      const target = new Quaternion(p.qx, p.qy, p.qz, p.qw).multiply(MODEL_OFFSET)
      Quaternion.SlerpToRef(mesh.rotationQuaternion, target, LERP, mesh.rotationQuaternion)
    }

    const debug = debugMeshRef.current
    if (debug) {
      debug.isVisible = isDebugRef.current
      if (isDebugRef.current) {
        debug.position.set(p.x, p.y + BODY_Y_OFFSET, p.z)
      }
    }
  })

  return null
}
