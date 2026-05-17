import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import { Mesh, VertexData, StandardMaterial, Color3 } from '@babylonjs/core'
import type { Room } from '@colyseus/sdk'

interface MeshGeometry {
  positions: number[]
  indices: number[]
}

interface Props {
  room: Room
  isDebug: boolean
}

export const DebugMapMesh = ({ room, isDebug }: Props) => {
  const scene = useScene()
  const meshesRef = useRef<Mesh[]>([])
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug

  useEffect(() => {
    if (!scene) return

    const unsubscribe = room.onMessage('debugMapMesh', (geometries: MeshGeometry[]) => {
      meshesRef.current.forEach((m) => m.dispose())
      meshesRef.current = []

      geometries.forEach((geo, i) => {
        const mesh = new Mesh(`debug-server-map-${i}`, scene)
        const vertexData = new VertexData()
        vertexData.positions = geo.positions
        vertexData.indices = geo.indices
        vertexData.applyToMesh(mesh)

        const mat = new StandardMaterial(`debug-server-map-mat-${i}`, scene)
        mat.wireframe = true
        mat.emissiveColor = new Color3(0, 0.8, 1)
        mat.backFaceCulling = false
        mesh.material = mat
        mesh.isVisible = isDebugRef.current

        meshesRef.current.push(mesh)
      })
    })

    room.send('requestDebugMesh')

    return () => {
      unsubscribe()
      meshesRef.current.forEach((m) => m.dispose())
      meshesRef.current = []
    }
  }, [scene])

  useBeforeRender(() => {
    const visible = isDebugRef.current
    meshesRef.current.forEach((m) => {
      m.isVisible = visible
    })
  })

  return null
}
