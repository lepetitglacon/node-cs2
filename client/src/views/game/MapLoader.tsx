import { useEffect } from 'react'
import { useScene } from 'react-babylonjs'
import { SceneLoader, Quaternion, type AbstractMesh } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'

interface Props {
  mapId: string
}

const isProd = import.meta.env.PROD
const SERVER_URL = isProd 
  ? `${window.location.protocol}//${window.location.host}` 
  : 'http://localhost:2567'

export const MapLoader = ({ mapId }: Props) => {
  const scene = useScene()

  useEffect(() => {
    if (!scene || !mapId) return

    let cancelled = false
    const meshes: AbstractMesh[] = []

    SceneLoader.ImportMeshAsync(
      '',
      `${SERVER_URL}/assets/map/${mapId}.glb`,
      '',
      scene
    ).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        return
      }
      meshes.push(...result.meshes)
      const root = result.meshes[0]
      if (root) {
        console.log('root scaling:', root.scaling.toString())
        root.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0)
      }
    })

    return () => {
      cancelled = true
      meshes.forEach((m) => m.dispose())
    }
  }, [scene, mapId])

  return null
}
