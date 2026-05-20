import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  Quaternion,
  Vector3,
  type AbstractMesh,
  type AnimationGroup,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { Room } from '@colyseus/sdk'
import { assetRegistry } from '@/game/assets/registry.ts'

// Le modèle soldat est orienté à l'envers : demi-tour pour le remettre d'aplomb.
const MODEL_OFFSET = Quaternion.RotationAxis(Vector3.Up(), Math.PI)

const playAnim = (groups: AnimationGroup[], name: string, loop: boolean) => {
  groups.forEach((ag) => {
    if (ag.name.toLowerCase().includes(name)) ag.start(loop)
    else ag.stop()
  })
}

interface Props {
  room: Room
  tid: string
}

export const TargetEntity = ({ room, tid }: Props) => {
  const scene = useScene()
  const animGroupsRef = useRef<AnimationGroup[]>([])
  const dyingRef = useRef(false)

  useEffect(() => {
    if (!scene) return

    const t = room.state?.targets?.get(tid)
    const instances = assetRegistry
      .getMesh('soldier')
      .instantiateModelsToScene((n) => `target-${tid}-${n}`)

    const root = instances.rootNodes[0] as AbstractMesh
    if (root) {
      root.position.set(t?.x ?? 0, t?.y ?? 0, t?.z ?? 0)
      root.rotationQuaternion = MODEL_OFFSET.clone()
    }

    animGroupsRef.current = instances.animationGroups
    instances.animationGroups.forEach((ag) => ag.stop())
    playAnim(instances.animationGroups, 'idle', true)

    return () => {
      instances.animationGroups.forEach((ag) => ag.dispose())
      instances.rootNodes.forEach((n) => n.dispose())
      animGroupsRef.current = []
    }
  }, [scene])

  // Quand le serveur passe la cible en active=false, on joue la mort une fois.
  useBeforeRender(() => {
    if (dyingRef.current) return
    const t = room.state?.targets?.get(tid)
    if (t && !t.active) {
      dyingRef.current = true
      playAnim(animGroupsRef.current, 'dying', false)
    }
  })

  return null
}
