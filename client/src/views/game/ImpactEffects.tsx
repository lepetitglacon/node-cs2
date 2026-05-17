import { useEffect, useRef } from 'react'
import { useScene, useBeforeRender } from 'react-babylonjs'
import {
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Vector3,
  Quaternion,
  Color3,
  Color4,
  ParticleSystem,
  Ray,
  type Mesh,
} from '@babylonjs/core'
import type { Room } from '@colyseus/sdk'

interface Props {
  room: Room
}

interface ShotMsg {
  sessionId: string
  x: number; y: number; z: number       // origine (œil)
  mx: number; my: number; mz: number    // bout du canon (pour tracer)
  hit: {
    x: number; y: number; z: number
    nx: number; ny: number; nz: number
    onPlayer: boolean
  } | null
}

const MAX_DECALS = 60
const PARTICLE_POOL_SIZE = 8
const TRACER_POOL_SIZE = 12
const DECAL_SIZE = 0.12
const PARTICLE_BURST_MS = 80
const TRACER_LIFETIME_MS = 70
const TRACER_DIAMETER = 0.02

interface TracerSlot {
  mesh: Mesh
  expiresAt: number
}

// Quaternion qui aligne l'axe Y du cylindre sur la direction from→to.
function orientCylinder(from: Vector3, to: Vector3): Quaternion {
  const dir = to.subtract(from).normalize()
  const up = Vector3.Up()
  const dot = Vector3.Dot(up, dir)
  if (dot > 0.9999) return Quaternion.Identity()
  if (dot < -0.9999) return Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI)
  const axis = Vector3.Cross(up, dir).normalize()
  return Quaternion.RotationAxis(axis, Math.acos(dot))
}

export const ImpactEffects = ({ room }: Props) => {
  const scene = useScene()
  const decalSlotsRef = useRef<(Mesh | null)[]>([])
  const decalIdxRef = useRef(0)
  const particlePoolRef = useRef<ParticleSystem[]>([])
  const particleIdxRef = useRef(0)
  const tracerPoolRef = useRef<TracerSlot[]>([])
  const tracerIdxRef = useRef(0)

  useEffect(() => {
    if (!scene) return

    // --- Bullet hole texture (procédural) ---
    const bhTex = new DynamicTexture('bh-tex', { width: 64, height: 64 }, scene, false)
    bhTex.hasAlpha = true
    const bhCtx = bhTex.getContext()
    bhCtx.clearRect(0, 0, 64, 64)
    bhCtx.fillStyle = 'rgba(20,15,10,0.95)'
    bhCtx.beginPath()
    bhCtx.arc(32, 32, 22, 0, Math.PI * 2)
    bhCtx.fill()
    bhCtx.fillStyle = 'rgba(0,0,0,1)'
    bhCtx.beginPath()
    bhCtx.arc(32, 32, 10, 0, Math.PI * 2)
    bhCtx.fill()
    bhTex.update()

    const bhMat = new StandardMaterial('bh-mat', scene)
    bhMat.diffuseTexture = bhTex
    bhMat.useAlphaFromDiffuseTexture = true
    bhMat.specularColor.set(0, 0, 0)
    bhMat.zOffset = -2

    // --- Spark texture (gradient radial) ---
    const sparkTex = new DynamicTexture('spark-tex', { width: 64, height: 64 }, scene, false)
    sparkTex.hasAlpha = true
    const spCtx = sparkTex.getContext()
    const grad = spCtx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.4, 'rgba(255,200,80,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    spCtx.fillStyle = grad
    spCtx.fillRect(0, 0, 64, 64)
    sparkTex.update()

    // --- Pool de particules ---
    const particles: ParticleSystem[] = []
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const ps = new ParticleSystem(`impact-ps-${i}`, 16, scene)
      ps.particleTexture = sparkTex
      ps.minSize = 0.025
      ps.maxSize = 0.07
      ps.minLifeTime = 0.05
      ps.maxLifeTime = 0.18
      ps.emitRate = 0
      ps.minEmitPower = 1.2
      ps.maxEmitPower = 2.8
      ps.updateSpeed = 0.01
      ps.color1 = new Color4(1, 0.9, 0.4, 1)
      ps.color2 = new Color4(1, 0.5, 0.1, 1)
      ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
      ps.blendMode = ParticleSystem.BLENDMODE_ADD
      ps.gravity = new Vector3(0, -5, 0)
      particles.push(ps)
    }
    particlePoolRef.current = particles

    // --- Pool de tracers (cylindres fins, jaune émissif) ---
    const tracerMat = new StandardMaterial('tracer-mat', scene)
    tracerMat.emissiveColor = new Color3(1, 0.9, 0.3)
    tracerMat.disableLighting = true
    tracerMat.specularColor.set(0, 0, 0)
    tracerMat.alpha = 1

    const tracers: TracerSlot[] = []
    for (let i = 0; i < TRACER_POOL_SIZE; i++) {
      const mesh = MeshBuilder.CreateCylinder(
        `tracer-${i}`,
        { height: 1, diameter: TRACER_DIAMETER, tessellation: 6 },
        scene,
      )
      mesh.material = tracerMat
      mesh.isPickable = false
      mesh.isVisible = false
      mesh.rotationQuaternion = Quaternion.Identity()
      tracers.push({ mesh, expiresAt: 0 })
    }
    tracerPoolRef.current = tracers

    // --- Ring buffer de décals ---
    decalSlotsRef.current = new Array(MAX_DECALS).fill(null)
    decalIdxRef.current = 0

    const handler = room.onMessage('shotFired', (data: ShotMsg) => {
      if (!data.hit) return

      const muzzle = new Vector3(data.mx, data.my, data.mz)
      const impact = new Vector3(data.hit.x, data.hit.y, data.hit.z)

      // Tracer du canon vers l'impact (toujours, même sur joueur)
      const slot = tracerPoolRef.current[tracerIdxRef.current]
      const length = Vector3.Distance(muzzle, impact)
      slot.mesh.position = muzzle.add(impact).scale(0.5)
      slot.mesh.scaling.y = length
      slot.mesh.rotationQuaternion = orientCylinder(muzzle, impact)
      slot.mesh.isVisible = true
      slot.mesh.visibility = 1
      slot.expiresAt = Date.now() + TRACER_LIFETIME_MS
      tracerIdxRef.current = (tracerIdxRef.current + 1) % TRACER_POOL_SIZE

      // Décal + particules : que sur les surfaces (pas les joueurs)
      if (data.hit.onPlayer) return

      const normal = new Vector3(data.hit.nx, data.hit.ny, data.hit.nz)

      // Trouver le mesh à projeter le décal dessus
      const rayOrigin = impact.add(normal.scale(0.05))
      const ray = new Ray(rayOrigin, normal.scale(-1), 0.2)
      const pick = scene.pickWithRay(ray, (m) => m.isPickable !== false && m.isVisible)

      if (pick?.pickedMesh) {
        const decal = MeshBuilder.CreateDecal('decal', pick.pickedMesh, {
          position: impact,
          normal,
          size: new Vector3(DECAL_SIZE, DECAL_SIZE, DECAL_SIZE),
        })
        decal.material = bhMat
        const old = decalSlotsRef.current[decalIdxRef.current]
        if (old) old.dispose()
        decalSlotsRef.current[decalIdxRef.current] = decal
        decalIdxRef.current = (decalIdxRef.current + 1) % MAX_DECALS
      }

      // Particules : cône serré autour de la normale
      const ps = particlePoolRef.current[particleIdxRef.current]
      ps.emitter = impact.clone()
      const right = Math.abs(normal.y) < 0.9
        ? Vector3.Cross(normal, Vector3.Up()).normalize()
        : new Vector3(1, 0, 0)
      const up = Vector3.Cross(normal, right).normalize()
      const spread = 0.15
      ps.direction1 = normal.scale(2.5).add(right.scale(spread)).add(up.scale(spread))
      ps.direction2 = normal.scale(2.5).add(right.scale(-spread)).add(up.scale(-spread))
      ps.manualEmitCount = 8
      ps.start()
      setTimeout(() => ps.stop(), PARTICLE_BURST_MS)
      particleIdxRef.current = (particleIdxRef.current + 1) % PARTICLE_POOL_SIZE
    })

    return () => {
      handler()
      decalSlotsRef.current.forEach((m) => m?.dispose())
      decalSlotsRef.current = []
      particlePoolRef.current.forEach((p) => p.dispose())
      particlePoolRef.current = []
      tracerPoolRef.current.forEach((s) => s.mesh.dispose())
      tracerPoolRef.current = []
      bhTex.dispose()
      bhMat.dispose()
      sparkTex.dispose()
      tracerMat.dispose()
    }
  }, [scene])

  // Fade out des tracers
  useBeforeRender(() => {
    const now = Date.now()
    const pool = tracerPoolRef.current
    for (const slot of pool) {
      if (!slot.mesh.isVisible) continue
      const remaining = slot.expiresAt - now
      if (remaining <= 0) {
        slot.mesh.isVisible = false
        slot.mesh.visibility = 0
      } else {
        slot.mesh.visibility = remaining / TRACER_LIFETIME_MS
      }
    }
  })

  return null
}
