const isProd = import.meta.env.PROD
export const ASSET_BASE_URL = isProd
  ? `${window.location.protocol}//${window.location.host}`
  : 'http://localhost:2567'

// Assets toujours nécessaires, préchargés à chaque entrée en partie.
export const MESH_ASSETS = {
  weapon_ak47: '/assets/weapon/ak-47.glb',
  soldier: '/assets/soldier.glb',
} as const

export const SOUND_ASSETS = {
  ak_shot: '/assets/sound/ak_shot.wav',
  ak_reload: '/assets/sound/ak_reload.wav',
  footstep_1: '/assets/sound/footstep_1.wav',
  footstep_2: '/assets/sound/footstep_2.wav',
  footstep_3: '/assets/sound/footstep_3.wav',
} as const

export type MeshKey = keyof typeof MESH_ASSETS
export type SoundKey = keyof typeof SOUND_ASSETS

// La map est dynamique (dépend de l'état de la room), donc préchargée à part.
export const mapMeshUrl = (mapId: string) => `/assets/map/${mapId}.glb`
export const mapMeshKey = (mapId: string) => `map_${mapId}`
