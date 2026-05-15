import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { MeshBuilder, Quaternion, type Mesh } from '@babylonjs/core'
import { useRoom } from './roomContext.ts'

interface Props {
  pid: string
  name: string
}

const LERP = 0.2

export const OtherPlayer = ({ pid, name }: Props) => {
  const scene = useScene()
  const { room } = useRoom()
  const roomRef = useRef(room)
  roomRef.current = room
  const meshRef = useRef<Mesh | null>(null)

  useEffect(() => {
    if (!scene) return

    const p = roomRef.current?.state?.players?.get(pid)
    const mesh = MeshBuilder.CreateBox(name, { size: 1 }, scene)
    mesh.position.set(p?.x ?? 0, (p?.y ?? 0) + 0.5, p?.z ?? 0)
    mesh.rotationQuaternion = new Quaternion(p?.qx ?? 0, p?.qy ?? 0, p?.qz ?? 0, p?.qw ?? 1)
    meshRef.current = mesh

    return () => mesh.dispose()
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
  })

  return null
}
