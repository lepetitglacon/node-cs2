import { useEffect } from 'react'
import { useScene } from 'react-babylonjs'
import { MeshBuilder, StandardMaterial, Texture } from '@babylonjs/core'
import { assetRegistry } from '@/game/assets/registry.ts'

interface EnvironmentSetupProps {
  envKey: string
}

export const EnvironmentSetup = ({ envKey }: EnvironmentSetupProps) => {
  const scene = useScene()

  useEffect(() => {
    if (!scene) return

    const texture = assetRegistry.getEnvTexture(envKey)
    texture.coordinatesMode = Texture.FIXED_EQUIRECTANGULAR_MODE

    const skybox = MeshBuilder.CreateBox('skybox', { size: 1000 }, scene)
    skybox.infiniteDistance = true

    const mat = new StandardMaterial('skybox-mat', scene)
    mat.backFaceCulling = false
    mat.disableLighting = true
    // Le skybox est rendu en premier (mesh créé avant la map) et n'écrit pas
    // la profondeur → tout le reste se dessine par-dessus sans être occulté.
    mat.disableDepthWrite = true
    mat.reflectionTexture = texture
    skybox.material = mat

    return () => {
      skybox.dispose()
      mat.dispose()
    }
  }, [scene, envKey])

  return null
}
