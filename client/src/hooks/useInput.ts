import { useEffect, useRef, useState } from 'react'

export interface InputState {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  shoot: boolean
  sprint: boolean
  crouch: boolean
  jump: boolean
}

const INITIAL: InputState = { forward: false, back: false, left: false, right: false, shoot: false, sprint: false, crouch: false, jump: false }

export const useInput = () => {
  const ref = useRef<InputState>({ ...INITIAL })
  const [state, setState] = useState<InputState>({ ...INITIAL })

  useEffect(() => {
    const sync = () => setState({ ...ref.current })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') ref.current.forward = true
      else if (e.key === 's' || e.key === 'S') ref.current.back = true
      else if (e.key === 'q' || e.key === 'Q') ref.current.left = true
      else if (e.key === 'd' || e.key === 'D') ref.current.right = true
      else if (e.key === 'Shift' && e.location === 1) ref.current.sprint = true
      else if (e.key === 'Control' && e.location === 1) ref.current.crouch = true
      else if (e.key === ' ') ref.current.jump = true
      else return
      sync()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') ref.current.forward = false
      else if (e.key === 's' || e.key === 'S') ref.current.back = false
      else if (e.key === 'q' || e.key === 'Q') ref.current.left = false
      else if (e.key === 'd' || e.key === 'D') ref.current.right = false
      else if (e.key === 'Shift' && e.location === 1) ref.current.sprint = false
      else if (e.key === 'Control' && e.location === 1) ref.current.crouch = false
      else if (e.key === ' ') ref.current.jump = false
      else return
      sync()
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) {
        ref.current.shoot = true
        sync()
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        ref.current.shoot = false
        sync()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      const shooting = (e.buttons & 1) !== 0
      if (shooting !== ref.current.shoot) {
        ref.current.shoot = shooting
        sync()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return { ref, state }
}
