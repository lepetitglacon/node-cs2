import type { AssetContainer } from '@babylonjs/core'
import type { MeshKey, SoundKey } from './manifest.ts'

// Singleton qui détient tous les assets décodés une fois pour toutes.
// Les composants consomment de manière synchrone via getMesh/getSound — pas de race
// condition pendant le gameplay.
class AssetRegistry {
  private meshes = new Map<string, AssetContainer>()
  private sounds = new Map<string, ArrayBuffer>()
  private ready = false

  setMesh(key: string, container: AssetContainer): void {
    this.meshes.get(key)?.dispose()
    this.meshes.set(key, container)
  }

  setSound(key: SoundKey, buffer: ArrayBuffer): void {
    this.sounds.set(key, buffer)
  }

  getMesh(key: MeshKey | string): AssetContainer {
    const c = this.meshes.get(key)
    if (!c) throw new Error(`[AssetRegistry] mesh "${key}" non préchargé`)
    return c
  }

  getSound(key: SoundKey): ArrayBuffer {
    const b = this.sounds.get(key)
    if (!b) throw new Error(`[AssetRegistry] sound "${key}" non préchargé`)
    // On retourne une copie pour éviter qu'un consommateur transfère le buffer
    return b.slice(0)
  }

  hasMesh(key: string): boolean {
    return this.meshes.has(key)
  }

  markReady(): void {
    this.ready = true
  }

  isReady(): boolean {
    return this.ready
  }

  reset(): void {
    this.meshes.forEach((c) => c.dispose())
    this.meshes.clear()
    this.sounds.clear()
    this.ready = false
  }
}

export const assetRegistry = new AssetRegistry()
