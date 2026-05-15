import { useEffect, useRef } from 'react'

export interface PlayerInput {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export const usePlayerInput = () => {
  const input = useRef<PlayerInput>({ forward: false, back: false, left: false, right: false })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z') input.current.forward = true
      if (e.key === 's') input.current.back = true
      if (e.key === 'q') input.current.left = true
      if (e.key === 'd') input.current.right = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'z') input.current.forward = false
      if (e.key === 's') input.current.back = false
      if (e.key === 'q') input.current.left = false
      if (e.key === 'd') input.current.right = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return input
}
