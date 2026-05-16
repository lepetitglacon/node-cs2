import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  SceneLoader,
  MeshBuilder,
  Quaternion,
  Vector3,
  StandardMaterial,
  Color3,
  type LinesMesh,
  type AbstractMesh,
  type AnimationGroup,
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
const MODEL_URL = 'http://localhost:2567/assets/soldier.glb'
const MODEL_OFFSET = Quaternion.RotationAxis(Vector3.Up(), Math.PI)

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
  const debugMeshRef = useRef<any | null>(null)
  const aimLineRef = useRef<LinesMesh | null>(null)
  const hpBarRef = useRef<Rectangle | null>(null)
  const hpTextRef = useRef<TextBlock | null>(null)
  const lastHealthRef = useRef(-1)
  const lastMoveStateRef = useRef<string | null>(null)
  const animGroupsRef = useRef<AnimationGroup[]>([])

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
    hpContainer.borderColor = '#ffffff'
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
    hpText.thickness = 0
    hpContainer.addControl(hpText)
    hpTextRef.current = hpText

    SceneLoader.ImportMeshAsync('', MODEL_URL, '', scene).then((result) => {
      console.log(result.animationGroups)
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
      animGroupsRef.current.forEach((ag) => ag.dispose())
      meshRef.current?.dispose()
      meshRef.current = null
      debugMesh.dispose()
      aimLine.dispose()
      gui.dispose()
    }
  }, [scene])

  useBeforeRender(() => {
    const mesh = meshRef.current
    const p = roomRef.current?.state?.players?.get(pid)
    if (!mesh || !p) return

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
