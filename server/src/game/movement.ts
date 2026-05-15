export const ACCELERATION = 0.012
export const FRICTION     = 0.72
export const MAX_SPEED    = 0.14

export interface Velocity {
  x: number
  z: number
}

export interface Inputs {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export const applyMovement = (velocity: Velocity, inputs: Inputs, yaw: number): void => {
  const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw)
  const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw)

  if (inputs.forward) { velocity.x += fwdX * ACCELERATION; velocity.z += fwdZ * ACCELERATION }
  if (inputs.back)    { velocity.x -= fwdX * ACCELERATION; velocity.z -= fwdZ * ACCELERATION }
  if (inputs.left)    { velocity.x -= rgtX * ACCELERATION; velocity.z -= rgtZ * ACCELERATION }
  if (inputs.right)   { velocity.x += rgtX * ACCELERATION; velocity.z += rgtZ * ACCELERATION }

  const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
  if (speed > MAX_SPEED) {
    velocity.x = (velocity.x / speed) * MAX_SPEED
    velocity.z = (velocity.z / speed) * MAX_SPEED
  }

  velocity.x *= FRICTION
  velocity.z *= FRICTION
}
