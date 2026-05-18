import RAPIER from '@dimforge/rapier3d-compat'
import { applyMovement, type Velocity, type Inputs } from './movement.ts'

// Doit matcher MyRoom.ts côté serveur
const CAPSULE_HALF_HEIGHT = 0.6
const CAPSULE_RADIUS = 0.25
export const BODY_Y_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS
const VEL_SCALE = 64
const JUMP_VEL = 6
const GROUND_VEL_THRESHOLD = 0.5
const GRAVITY = { x: 0, y: -9.81, z: 0 }

// Au-delà de 4m de drift on snap, sinon on lerp doucement chaque frame
const RECONCILE_SNAP_DIST_SQ = 16
const RECONCILE_LERP = 0.15

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
  cx: number; cy: number; cz: number
  hx: number; hy: number; hz: number
}

export class ClientPhysics {
  world: RAPIER.World
  playerBody: RAPIER.RigidBody | null = null
  velocity: Velocity = { x: 0, z: 0 }
  hasColliders = false

  constructor() {
    this.world = new RAPIER.World(GRAVITY)
  }

  loadColliders(geometries: MeshGeometry[], colliders: ColliderDescriptor[] = []): void {
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
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(desc.cx, desc.cy, desc.cz)
      const body = this.world.createRigidBody(bodyDesc)
      switch (desc.type) {
        case 'cuboid':
          this.world.createCollider(RAPIER.ColliderDesc.cuboid(desc.hx, desc.hy, desc.hz), body)
          break
        case 'cylinder':
          this.world.createCollider(RAPIER.ColliderDesc.cylinder(desc.hy, Math.max(desc.hx, desc.hz)), body)
          break
        case 'ball':
          this.world.createCollider(RAPIER.ColliderDesc.ball(Math.max(desc.hx, desc.hy, desc.hz)), body)
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

  step(inputs: Inputs, yaw: number): void {
    if (!this.playerBody || !this.hasColliders) return

    applyMovement(this.velocity, inputs, yaw)

    const linvel = this.playerBody.linvel()
    const grounded = Math.abs(linvel.y) < GROUND_VEL_THRESHOLD
    this.playerBody.setLinvel(
      {
        x: this.velocity.x * VEL_SCALE,
        y: inputs.jump && grounded ? JUMP_VEL : linvel.y,
        z: this.velocity.z * VEL_SCALE,
      },
      true
    )

    this.world.step()
  }

  // Le serveur envoie player.{x,y,z} (position des pieds). On compare au centre du body.
  reconcile(serverFeetX: number, serverFeetY: number, serverFeetZ: number): void {
    if (!this.playerBody) return
    const t = this.playerBody.translation()
    const targetY = serverFeetY + BODY_Y_OFFSET
    const dx = serverFeetX - t.x
    const dy = targetY - t.y
    const dz = serverFeetZ - t.z

    if (dx * dx + dy * dy + dz * dz > RECONCILE_SNAP_DIST_SQ) {
      this.playerBody.setTranslation({ x: serverFeetX, y: targetY, z: serverFeetZ }, true)
      this.playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    this.playerBody.setTranslation(
      {
        x: t.x + dx * RECONCILE_LERP,
        y: t.y + dy * RECONCILE_LERP,
        z: t.z + dz * RECONCILE_LERP,
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
