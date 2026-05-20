import RAPIER from '@dimforge/rapier3d-compat'
import { applyMovement, type Velocity, type Inputs } from './movement.ts'

// Doit matcher MyRoom.ts côté serveur
const CAPSULE_HALF_HEIGHT = 0.6
const CAPSULE_RADIUS = 0.25
export const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS
const VEL_SCALE = 64
const JUMP_VEL = 4
// Marge sous les pieds pour considérer le joueur au sol (ray vers le bas).
const GROUND_RAY_MARGIN = 0.5
const GRAVITY = { x: 0, y: -9.81, z: 0 }

// Au-delà de 4m de drift on snap, sinon on lerp doucement chaque frame
const RECONCILE_SNAP_DIST_SQ = 16
// Taux de convergence indépendant du fps : ~constante de temps en secondes
// factor = 1 - exp(-dt * RATE). RATE=8 → ~125ms pour rattraper 63% du drift
const RECONCILE_RATE = 10
// Sous ce seuil on ignore le serveur et on fait confiance à la prédiction client
// (pas de rubber-banding sur les micro-écarts dus à la latence/dt variable)
const RECONCILE_DEADBAND = 0.05
const RECONCILE_DEADBAND_SQ = RECONCILE_DEADBAND * RECONCILE_DEADBAND

let initPromise: Promise<void> | null = null

export const initRapier = (): Promise<void> => {
  if (!initPromise) initPromise = RAPIER.init()
  return initPromise
}

export interface MeshGeometry {
  positions: number[]
  indices: number[]
}

export interface ColliderDescriptor {
  type: 'cuboid' | 'cylinder' | 'ball'
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
}

export class ClientPhysics {
  world: RAPIER.World
  playerBody: RAPIER.RigidBody | null = null
  velocity: Velocity = { x: 0, z: 0 }
  hasColliders = false

  constructor() {
    this.world = new RAPIER.World(GRAVITY)
  }

  loadColliders(
    geometries: MeshGeometry[],
    colliders: ColliderDescriptor[] = []
  ): void {
    geometries.forEach((geo) => {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          new Float32Array(geo.positions),
          new Uint32Array(geo.indices)
        ),
        body
      )
    })

    colliders.forEach((desc) => {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        desc.cx,
        desc.cy,
        desc.cz
      )
      const body = this.world.createRigidBody(bodyDesc)
      switch (desc.type) {
        case 'cuboid':
          this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(desc.hx, desc.hy, desc.hz),
            body
          )
          break
        case 'cylinder':
          this.world.createCollider(
            RAPIER.ColliderDesc.cylinder(desc.hy, Math.max(desc.hx, desc.hz)),
            body
          )
          break
        case 'ball':
          this.world.createCollider(
            RAPIER.ColliderDesc.ball(Math.max(desc.hx, desc.hy, desc.hz)),
            body
          )
          break
      }
    })

    this.hasColliders = true
  }

  createPlayerBody(feetX: number, feetY: number, feetZ: number): void {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(feetX, feetY + BODY_Y_OFFSET + 0.5, feetZ)
      .lockRotations()
    this.playerBody = this.world.createRigidBody(desc)
    this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      this.playerBody
    )
  }

  step(inputs: Inputs, yaw: number, dt?: number): void {
    if (!this.playerBody || !this.hasColliders) return

    if (dt !== undefined && dt > 0) this.world.timestep = dt

    applyMovement(this.velocity, inputs, yaw)

    const linvel = this.playerBody.linvel()
    const grounded = this.isGrounded()
    if (grounded) {
      // Au sol : déplacement piloté par les inputs (+ saut éventuel).
      this.playerBody.setLinvel(
        {
          x: this.velocity.x * VEL_SCALE,
          y: inputs.jump ? JUMP_VEL : linvel.y,
          z: this.velocity.z * VEL_SCALE,
        },
        true
      )
    }
    // En l'air : on garde la vélocité → momentum du saut conservé.

    this.world.step()
  }

  // Au sol : raycast vers le bas pour détecter le contact avec le sol.
  isGrounded(): boolean {
    if (!this.playerBody) return false
    const t = this.playerBody.translation()
    const ray = new RAPIER.Ray(
      { x: t.x, y: t.y, z: t.z },
      { x: 0, y: -1, z: 0 }
    )
    const hit = this.world.castRay(
      ray,
      BODY_Y_OFFSET + GROUND_RAY_MARGIN,
      true,
      undefined,
      undefined,
      undefined,
      this.playerBody
    )
    return hit !== null
  }

  // Le serveur envoie player.{x,y,z} (position des pieds). On compare au centre du body.
  // dt en secondes pour rendre la lerp indépendante du framerate.
  reconcile(
    serverFeetX: number,
    serverFeetY: number,
    serverFeetZ: number,
    dt: number
  ): void {
    if (!this.playerBody) return
    const t = this.playerBody.translation()
    const targetY = serverFeetY + BODY_Y_OFFSET
    const dx = serverFeetX - t.x
    const dy = targetY - t.y
    const dz = serverFeetZ - t.z

    const distSq = dx * dx + dy * dy + dz * dz

    if (distSq > RECONCILE_SNAP_DIST_SQ) {
      this.playerBody.setTranslation(
        { x: serverFeetX, y: targetY, z: serverFeetZ },
        true
      )
      this.playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    // Deadband : sous 5cm d'écart, on trust 100% la prédiction client → zéro rubber-band
    if (distSq < RECONCILE_DEADBAND_SQ) return

    const factor = 1 - Math.exp(-dt * RECONCILE_RATE)
    this.playerBody.setTranslation(
      {
        x: t.x + dx * factor,
        y: t.y + dy * factor,
        z: t.z + dz * factor,
      },
      true
    )
  }

  getBodyPosition(): { x: number; y: number; z: number } | null {
    if (!this.playerBody) return null
    const t = this.playerBody.translation()
    return { x: t.x, y: t.y, z: t.z }
  }

  dispose(): void {
    this.world.free()
    this.playerBody = null
    this.hasColliders = false
  }
}
