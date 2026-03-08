import { useRef, useCallback } from 'react'

export default function useSoundEffects() {
  const audioContextRef = useRef(null)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const playBeep = useCallback((frequency = 800, duration = 0.1, volume = 0.1) => {
    try {
      const ctx = getAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(volume, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
      // Audio context not supported
    }
  }, [getAudioContext])

  const playRobotBeeps = useCallback(() => {
    const frequencies = [600, 800, 1000, 800]
    frequencies.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.08, 0.05), i * 100)
    })
  }, [playBeep])

  const playConfirmBeep = useCallback(() => {
    playBeep(600, 0.1, 0.05)
    setTimeout(() => playBeep(900, 0.15, 0.05), 120)
  }, [playBeep])

  return { playBeep, playRobotBeeps, playConfirmBeep }
}
