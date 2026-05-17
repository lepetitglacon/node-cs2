export const ACCELERATION   = 0.012
export const FRICTION       = 0.72
export const MAX_SPEED      = 0.14
export const SPRINT_MULT    = 1.65
export const CROUCH_MULT    = 0.5

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

  if (inputs.forward) { velocity.x += fwdX * ACCELERATION; velocity.z += fwdZ * ACCELERATION }
  if (inputs.back)    { velocity.x -= fwdX * ACCELERATION; velocity.z -= fwdZ * ACCELERATION }
  if (inputs.left)    { velocity.x -= rgtX * ACCELERATION; velocity.z -= rgtZ * ACCELERATION }
  if (inputs.right)   { velocity.x += rgtX * ACCELERATION; velocity.z += rgtZ * ACCELERATION }

  const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
  if (speed > maxSpeed) {
    velocity.x = (velocity.x / speed) * maxSpeed
    velocity.z = (velocity.z / speed) * maxSpeed
  }

  velocity.x *= FRICTION
  velocity.z *= FRICTION
}
