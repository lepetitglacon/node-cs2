import { LoadAssetContainerAsync, type Scene } from '@babylonjs/core'
import {
  ASSET_BASE_URL,
  MESH_ASSETS,
  SOUND_ASSETS,
  mapMeshKey,
  mapMeshUrl,
  type SoundKey,
} from './manifest.ts'
import { assetRegistry } from './registry.ts'

export interface PreloadProgress {
  loaded: number
  total: number
}

type ProgressCallback = (progress: PreloadProgress) => void

async function preloadMesh(
  scene: Scene,
  key: string,
  url: string,
): Promise<void> {
  if (assetRegistry.hasMesh(key)) return
  const container = await LoadAssetContainerAsync(`${ASSET_BASE_URL}${url}`, scene)
  // Les nodes sont stockés dans le container mais pas dans la scène — les
  // composants les instancieront via container.instantiateModelsToScene().
  assetRegistry.setMesh(key, container)
}

async function preloadSound(key: SoundKey, url: string): Promise<void> {
  const res = await fetch(`${ASSET_BASE_URL}${url}`)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = await res.arrayBuffer()
  assetRegistry.setSound(key, buf)
}

export async function preloadAssets(
  scene: Scene,
  mapId: string,
  onProgress: ProgressCallback,
): Promise<void> {
  const meshEntries = Object.entries(MESH_ASSETS) as [string, string][]
  const soundEntries = Object.entries(SOUND_ASSETS) as [SoundKey, string][]
  const total = meshEntries.length + soundEntries.length + 1 // +1 pour la map
  let loaded = 0

  const tick = () => {
    loaded++
    onProgress({ loaded, total })
  }

  onProgress({ loaded: 0, total })

  await Promise.all([
    ...meshEntries.map(([key, url]) => preloadMesh(scene, key, url).then(tick)),
    ...soundEntries.map(([key, url]) => preloadSound(key, url).then(tick)),
    preloadMesh(scene, mapMeshKey(mapId), mapMeshUrl(mapId)).then(tick),
  ])

  assetRegistry.markReady()
}
