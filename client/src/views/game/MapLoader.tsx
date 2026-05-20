import { useEffect } from 'react'
import { useScene } from 'react-babylonjs'
import { Quaternion } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { assetRegistry } from '@/game/assets/registry.ts'
import { mapMeshKey } from '@/game/assets/manifest.ts'

interface Props {
  mapId: string
}

export const MapLoader = ({ mapId }: Props) => {
  const scene = useScene()

  useEffect(() => {
    if (!scene || !mapId) return

    const container = assetRegistry.getMesh(mapMeshKey(mapId))
    const instances = container.instantiateModelsToScene(
      (name) => `map-${mapId}-${name}`,
      false,
      { doNotInstantiate: true }
    )

    // Murs invisibles (Invisible.XXX) : collision uniquement, jamais affichés.
    instances.rootNodes.forEach((node) => {
      node
        .getChildMeshes(
          false,
          (m) => m.name.includes('Invisible') || m.name.includes('Plane')
        )
        .forEach((m) => {
          m.isVisible = false
        })
    })

    const root = instances.rootNodes[0]
    if (root && 'rotationQuaternion' in root) {
      ;(root as { rotationQuaternion: Quaternion }).rotationQuaternion =
        Quaternion.FromEulerAngles(0, 0, 0)
    }

    return () => {
      instances.rootNodes.forEach((n) => n.dispose())
      instances.animationGroups.forEach((ag) => ag.dispose())
    }
  }, [scene, mapId])

  return null
}
