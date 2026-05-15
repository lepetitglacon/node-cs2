import { useEffect, useRef } from 'react'

export const useTickLoop = (callback: () => void, ticksPerSecond: number) => {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const interval = setInterval(() => callbackRef.current(), 1000 / ticksPerSecond)
    return () => clearInterval(interval)
  }, [ticksPerSecond])
}
