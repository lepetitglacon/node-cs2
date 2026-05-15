import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { MeshBuilder, Quaternion, type Mesh } from '@babylonjs/core'

interface Props {
  name: string
  player: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }
}

const LERP = 0.2

export const OtherPlayer = ({ name, player }: Props) => {
  const scene = useScene()
  const meshRef = useRef<Mesh | null>(null)
  const playerRef = useRef(player)
  playerRef.current = player

  useEffect(() => {
    if (!scene) return

    const mesh = MeshBuilder.CreateBox(name, { size: 1 }, scene)
    mesh.position.set(player.x, player.y + 0.5, player.z)
    mesh.rotationQuaternion = new Quaternion(player.qx, player.qy, player.qz, player.qw)
    meshRef.current = mesh

    return () => mesh.dispose()
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    const p = playerRef.current
    if (!mesh) return

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
