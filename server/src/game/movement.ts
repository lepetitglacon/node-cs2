export const ACCELERATION   = 0.012
export const FRICTION       = 0.72
export const MAX_SPEED      = 0.14
export const SPRINT_MULT    = 1.9
export const CROUCH_MULT    = 0.5

// Vitesse réellement atteinte en walk à l'équilibre (accel/friction convergent en-dessous du cap)
const WALK_SPEED = ACCELERATION * FRICTION / (1 - FRICTION)

export interface Velocity {
  x: number
  z: number
}

export interface Inputs {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  sprint?: boolean
  crouch?: boolean
  jump?: boolean
}

export const applyMovement = (velocity: Velocity, inputs: Inputs, yaw: number): void => {
  const maxSpeed = inputs.sprint ? MAX_SPEED * SPRINT_MULT : inputs.crouch ? MAX_SPEED * CROUCH_MULT : MAX_SPEED
  const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw)
  const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw)

  let dirX = 0, dirZ = 0
  if (inputs.forward) { dirX += fwdX; dirZ += fwdZ }
  if (inputs.back)    { dirX -= fwdX; dirZ -= fwdZ }
  if (inputs.left)    { dirX -= rgtX; dirZ -= rgtZ }
  if (inputs.right)   { dirX += rgtX; dirZ += rgtZ }
  const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ)

  // Sprint : vélocité instantanée à WALK_SPEED × SPRINT_MULT, pas d'accélération
  if (inputs.sprint && dirLen > 0) {
    const sprintSpeed = WALK_SPEED * SPRINT_MULT
    velocity.x = (dirX / dirLen) * sprintSpeed
    velocity.z = (dirZ / dirLen) * sprintSpeed
    return
  }

  velocity.x += dirX * ACCELERATION
  velocity.z += dirZ * ACCELERATION

  const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
  if (speed > maxSpeed) {
    velocity.x = (velocity.x / speed) * maxSpeed
    velocity.z = (velocity.z / speed) * maxSpeed
  }

  velocity.x *= FRICTION
  velocity.z *= FRICTION
}
