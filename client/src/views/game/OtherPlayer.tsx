import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  SceneLoader,
  MeshBuilder,
  Quaternion,
  CreateSoundAsync,
  Vector3,
  TransformNode,
  StandardMaterial,
  Color3,
  type LinesMesh,
  type AbstractMesh,
  type AnimationGroup,
  type StaticSound,
} from '@babylonjs/core'
import { AdvancedDynamicTexture, Rectangle, TextBlock } from '@babylonjs/gui'
import '@babylonjs/loaders/glTF'
import { useRoom } from './roomContext.ts'

interface Props {
  pid: string
  name: string
  isDebug: boolean
}

const LERP = 0.2
const BODY_Y_OFFSET = 0.85
const AIM_RAY_LENGTH = 50
const isProd = import.meta.env.PROD
const SERVER_URL = isProd 
  ? `${window.location.protocol}//${window.location.host}` 
  : 'http://localhost:2567'

const MODEL_URL = `${SERVER_URL}/assets/soldier.glb`
const WEAPON_URL = `${SERVER_URL}/assets/weapon/ak-47.glb`
const SHOT_SOUND_URL = `${SERVER_URL}/assets/sound/ak_shot.wav`
const SHOT_POOL_SIZE = 6
const FOOTSTEP_SOUND_URLS = [
  `${SERVER_URL}/assets/sound/footstep_1.wav`,
  `${SERVER_URL}/assets/sound/footstep_2.wav`,
  `${SERVER_URL}/assets/sound/footstep_3.wav`,
]
const FOOTSTEP_WALK_INTERVAL_MS = 800
const FOOTSTEP_SPRINT_INTERVAL_MS = 400
const FOOTSTEP_MAX_DISTANCE = 25
const MODEL_OFFSET = Quaternion.RotationAxis(Vector3.Up(), Math.PI)

// --- Offset de l'arme (espace local du pivot = origine joueur) ---
const WEAPON_HAND_OFFSET = new Vector3(-0.12, 1.48, -0.25)
const WEAPON_HAND_ROTATION = new Vector3(0.25, Math.PI * 0.5 - 0.1, 0.2)
const WEAPON_HAND_SCALE = new Vector3(0.47, 0.47, 0.47)
// ----------------------------------------------------------------

const ANIM_MAP: Record<string, string> = {
  idle: 'idle',
  walk_front: 'walk_front',
  walk_back: 'walk_back',
  walk_left: 'walk_left',
  walk_right: 'walk_right',
  dying: 'dying',
}

export const OtherPlayer = ({ pid, name, isDebug }: Props) => {
  const scene = useScene()
  const { room } = useRoom()
  const roomRef = useRef(room)
  roomRef.current = room
  const isDebugRef = useRef(isDebug)
  isDebugRef.current = isDebug
  const meshRef = useRef<AbstractMesh | null>(null)
  const weaponPivotRef = useRef<TransformNode | null>(null)
  const weaponMeshRef = useRef<AbstractMesh | null>(null)
  const debugMeshRef = useRef<any | null>(null)
  const aimLineRef = useRef<LinesMesh | null>(null)
  const hpBarRef = useRef<Rectangle | null>(null)
  const hpTextRef = useRef<TextBlock | null>(null)
  const lastHealthRef = useRef(-1)
  const lastMoveStateRef = useRef<string | null>(null)
  const animGroupsRef = useRef<AnimationGroup[]>([])
  const shotPoolRef = useRef<StaticSound[]>([])
  const shotPoolIndexRef = useRef(0)
  const footstepPoolRef = useRef<StaticSound[]>([])
  const lastFootstepAtRef = useRef(0)
  const lastFootstepIdxRef = useRef(-1)

  useEffect(() => {
    if (!scene) return

    const p = roomRef.current?.state?.players?.get(pid)
    let rootMesh: AbstractMesh | null = null
    let cancelled = false

    const gui = AdvancedDynamicTexture.CreateFullscreenUI(
      `hp-ui-${pid}`,
      true,
      scene
    )

    const hpContainer = new Rectangle(`hp-bg-${pid}`)
    hpContainer.width = '120px'
    hpContainer.height = '24px'
    hpContainer.background = '#000000'
    hpContainer.thickness = 1
    hpContainer.color = '#ffffff'
    gui.addControl(hpContainer)
    hpContainer.linkOffsetY = 50

    const hpBar = new Rectangle(`hp-bar-${pid}`)
    hpBar.width = '100%'
    hpBar.height = '100%'
    hpBar.background = '#00ff00'
    hpBar.thickness = 0
    hpContainer.addControl(hpBar)
    hpBarRef.current = hpBar

    const hpText = new TextBlock(`hp-text-${pid}`, '100')
    hpText.fontSize = 12
    hpText.color = 'white'
    hpContainer.addControl(hpText)
    hpTextRef.current = hpText

    // Pivot de l'arme : positionné à l'origine du joueur, tourne avec le quaternion complet
    const weaponPivot = new TransformNode(`weapon-pivot-${pid}`, scene)
    weaponPivot.position.set(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0)
    weaponPivot.rotationQuaternion = new Quaternion(
      p?.qx ?? 0,
      p?.qy ?? 0,
      p?.qz ?? 0,
      p?.qw ?? 1
    ).multiply(MODEL_OFFSET)
    weaponPivotRef.current = weaponPivot

    SceneLoader.ImportMeshAsync('', WEAPON_URL, '', scene).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        return
      }
      const weaponRoot = result.meshes[0]
      weaponRoot.parent = weaponPivot
      weaponRoot.position = WEAPON_HAND_OFFSET.clone()
      weaponRoot.rotation = WEAPON_HAND_ROTATION.clone()
      weaponRoot.scaling = WEAPON_HAND_SCALE.clone()
      weaponMeshRef.current = weaponRoot
    })

    SceneLoader.ImportMeshAsync('', MODEL_URL, '', scene).then((result) => {
      if (cancelled) {
        result.meshes.forEach((m) => m.dispose())
        result.animationGroups.forEach((ag) => ag.dispose())
        return
      }
      rootMesh = result.meshes[0]
      rootMesh.name = name
      rootMesh.position.set(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0)
      const serverQuat = new Quaternion(
        p?.qx ?? 0,
        p?.qy ?? 0,
        p?.qz ?? 0,
        p?.qw ?? 1
      )
      rootMesh.rotationQuaternion = serverQuat.multiply(MODEL_OFFSET)
      meshRef.current = rootMesh

      animGroupsRef.current = result.animationGroups
      result.animationGroups.forEach((ag) => ag.stop())

      const playAnimation = (moveState: string) => {
        const animName = ANIM_MAP[moveState]
        if (!animName) return

        const shouldLoop = moveState !== 'dying'
        result.animationGroups.forEach((ag) => {
          if (ag.name.toLowerCase().includes(animName)) {
            ag.start(shouldLoop)
          } else {
            ag.stop()
          }
        })
      }

      const playerMoveState = p?.moveState ?? 'IDLE'
      lastMoveStateRef.current = playerMoveState
      playAnimation(playerMoveState)

      // Lier la barre de HP au mesh une fois chargé
      hpContainer.linkWithMesh(rootMesh)
    })

    const loadShots = async () => {
      try {
        const pool = await Promise.all(
          Array.from({ length: SHOT_POOL_SIZE }, (_, i) =>
            CreateSoundAsync(`ak-shot-${pid}-${i}`, SHOT_SOUND_URL, {
              spatialEnabled: true,
              spatialMaxDistance: 80,
            })
          )
        )
        if (cancelled) {
          pool.forEach((s) => s.dispose())
          return
        }
        shotPoolRef.current = pool
        shotPoolIndexRef.current = 0
      } catch (e) {
        console.warn('shot sounds load failed', e)
      }
    }
    const loadFootsteps = async () => {
      try {
        const pool = await Promise.all(
          FOOTSTEP_SOUND_URLS.map((url, i) =>
            CreateSoundAsync(`footstep-${pid}-${i}`, url, {
              spatialEnabled: true,
              spatialMaxDistance: FOOTSTEP_MAX_DISTANCE,
            })
          )
        )
        if (cancelled) {
          pool.forEach((s) => s.dispose())
          return
        }
        footstepPoolRef.current = pool
      } catch (e) {
        console.warn('footstep sounds load failed (fichiers manquants ?)', e)
      }
    }
    loadShots()
    loadFootsteps()

    const shotHandler = roomRef.current?.onMessage(
      'shotFired',
      (data: { sessionId: string; x: number; y: number; z: number }) => {
        if (data.sessionId !== pid) return
        const pool = shotPoolRef.current
        if (pool.length === 0) return
        const snd = pool[shotPoolIndexRef.current]
        snd.spatial.position = new Vector3(data.x, data.y, data.z)
        snd.play()
        shotPoolIndexRef.current = (shotPoolIndexRef.current + 1) % pool.length
      }
    )

    const mat = new StandardMaterial(`debug-${pid}-mat`, scene)
    mat.wireframe = true
    mat.emissiveColor = new Color3(1, 0.3, 0)
    const debugMesh = MeshBuilder.CreateCapsule(
      `debug-${pid}`,
      { height: 1.7, radius: 0.25 },
      scene
    )
    debugMesh.material = mat
    debugMesh.isVisible = false
    debugMeshRef.current = debugMesh

    const aimLine = MeshBuilder.CreateLines(
      `aim-${pid}`,
      { points: [Vector3.Zero(), Vector3.One()], updatable: true },
      scene
    ) as LinesMesh
    aimLine.color = new Color3(1, 0, 0)
    aimLine.isVisible = false
    aimLineRef.current = aimLine

    return () => {
      cancelled = true
      shotHandler?.()
      animGroupsRef.current.forEach((ag) => ag.dispose())
      meshRef.current?.dispose()
      meshRef.current = null
      weaponMeshRef.current?.dispose()
      weaponMeshRef.current = null
      weaponPivotRef.current?.dispose()
      weaponPivotRef.current = null
      shotPoolRef.current.forEach((s) => s.dispose())
      shotPoolRef.current = []
      footstepPoolRef.current.forEach((s) => s.dispose())
      footstepPoolRef.current = []
      debugMesh.dispose()
      aimLine.dispose()
      gui.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    const p = roomRef.current?.state?.players?.get(pid)
    if (!mesh || !p) return

    // Footsteps : joué seulement pendant walk/sprint, à intervalle régulier,
    // avec un son random différent du précédent pour éviter la répétition audible.
    const moveState = p.moveState ?? 'idle'
    const isWalking = moveState.startsWith('walk_')
    const isSprinting = moveState.startsWith('sprint_')
    if (isWalking || isSprinting) {
      const interval = isSprinting
        ? FOOTSTEP_SPRINT_INTERVAL_MS
        : FOOTSTEP_WALK_INTERVAL_MS
      const now = Date.now()
      if (now - lastFootstepAtRef.current >= interval) {
        const pool = footstepPoolRef.current
        if (pool.length > 0) {
          const lastIdx = lastFootstepIdxRef.current
          let idx = Math.floor(Math.random() * pool.length)
          if (pool.length > 1 && idx === lastIdx) idx = (idx + 1) % pool.length
          const snd = pool[idx]
          snd.spatial.position = new Vector3(p.x, p.y, p.z)
          snd.play()
          lastFootstepIdxRef.current = idx
          lastFootstepAtRef.current = now
        }
      }
    } else {
      // Reset pour que le prochain pas démarre tout de suite quand le joueur reprend
      lastFootstepAtRef.current = 0
    }

    // Handle moveState changes
    if (p.moveState && p.moveState !== lastMoveStateRef.current) {
      lastMoveStateRef.current = p.moveState

      const animName = ANIM_MAP[p.moveState]
      if (animName) {
        const shouldLoop = p.moveState !== 'dying'
        animGroupsRef.current.forEach((ag) => {
          if (ag.name.toLowerCase().includes(animName)) {
            if (!ag.isPlaying) ag.start(shouldLoop)
          } else {
            ag.stop()
          }
        })
      }
    }

    mesh.position.x += (p.x - mesh.position.x) * LERP
    mesh.position.y += (p.y - mesh.position.y) * LERP
    mesh.position.z += (p.z - mesh.position.z) * LERP

    if (mesh.rotationQuaternion) {
      const target = new Quaternion(0, p.qy, 0, p.qw).multiply(MODEL_OFFSET)
      Quaternion.SlerpToRef(
        mesh.rotationQuaternion,
        target,
        LERP,
        mesh.rotationQuaternion
      )
    }

    // Pivot de l'arme : suit la position du joueur + rotation complète (pitch + yaw)
    const pivot = weaponPivotRef.current
    if (pivot?.rotationQuaternion) {
      pivot.position.x += (p.x - pivot.position.x) * LERP
      pivot.position.y += (p.y - pivot.position.y) * LERP
      pivot.position.z += (p.z - pivot.position.z) * LERP
      const weaponTarget = new Quaternion(p.qx, p.qy, p.qz, p.qw).multiply(
        MODEL_OFFSET
      )
      Quaternion.SlerpToRef(
        pivot.rotationQuaternion,
        weaponTarget,
        LERP,
        pivot.rotationQuaternion
      )
    }

    const debug = debugMeshRef.current
    if (debug) {
      debug.isVisible = isDebugRef.current
      if (isDebugRef.current) {
        debug.position.set(p.x, p.y + BODY_Y_OFFSET, p.z)
      }
    }

    const aimLine = aimLineRef.current
    if (aimLine) {
      aimLine.isVisible = isDebugRef.current
      if (isDebugRef.current) {
        const { qx, qy, qz, qw } = p
        const fwdX = 2 * (qx * qz + qy * qw)
        const fwdY = 2 * (qy * qz - qx * qw)
        const fwdZ = 1 - 2 * (qx * qx + qy * qy)
        const origin = new Vector3(p.x, p.headY, p.z)
        const end = new Vector3(
          p.x + fwdX * AIM_RAY_LENGTH,
          p.headY + fwdY * AIM_RAY_LENGTH,
          p.z + fwdZ * AIM_RAY_LENGTH
        )
        MeshBuilder.CreateLines(`aim-${pid}`, {
          points: [origin, end],
          instance: aimLine,
        })
      }
    }

    const hpBar = hpBarRef.current
    const hpText = hpTextRef.current
    if (hpBar && hpText && p.health !== undefined) {
      if (p.health !== lastHealthRef.current) {
        lastHealthRef.current = p.health
        const healthPercent = Math.max(0, Math.min(100, p.health)) / 100
        hpBar.width = `${healthPercent * 100}%`
        hpBar.background = '#00ff00'
        hpText.text = `${Math.round(p.health)}`
      }
    }
  })

  return null
}
