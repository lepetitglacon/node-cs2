import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { MeshBuilder, Quaternion, StandardMaterial, Color3, type Mesh } from '@babylonjs/core'
import { useRoom } from './roomContext.ts'

interface Props {
  pid: string
  name: string
  isDebug: boolean
}

const LERP = 0.2
const BODY_Y_OFFSET = 0.85

export const OtherPlayer = ({ pid, name, isDebug }: Props) => {
  const scene = useScene()
  const { room } = useRoom()
  const roomRef = useRef(room)
  roomRef.current = room
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const meshRef = useRef<Mesh | null>(null)
  const debugMeshRef = useRef<Mesh | null>(null)

  useEffect(() => {
    if (!scene) return

    const p = roomRef.current?.state?.players?.get(pid)
    const mesh = MeshBuilder.CreateBox(name, { size: 1 }, scene)
    mesh.position.set(p?.x ?? 0, (p?.y ?? 0) + 0.5, p?.z ?? 0)
    mesh.rotationQuaternion = new Quaternion(p?.qx ?? 0, p?.qy ?? 0, p?.qz ?? 0, p?.qw ?? 1)
    meshRef.current = mesh

    const mat = new StandardMaterial(`debug-${pid}-mat`, scene)
    mat.wireframe = true
    mat.emissiveColor = new Color3(1, 0.3, 0)
    const debugMesh = MeshBuilder.CreateCapsule(`debug-${pid}`, { height: 1.7, radius: 0.25 }, scene)
    debugMesh.material = mat
    debugMesh.isVisible = false
    debugMeshRef.current = debugMesh

    return () => {
      mesh.dispose()
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
      Quaternion.SlerpToRef(
        mesh.rotationQuaternion,
        new Quaternion(p.qx, p.qy, p.qz, p.qw),
        LERP,
        mesh.rotationQuaternion,
      )
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
