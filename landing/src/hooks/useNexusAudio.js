import { useState, useRef, useCallback } from 'react'
import useSoundEffects from './useSoundEffects'

export default function useNexusAudio() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const { playRobotBeeps, playConfirmBeep } = useSoundEffects()

  const playAudio = useCallback((audioSrc) => {
    if (!audioEnabled) return Promise.resolve()

    if (!audioSrc) {
      playRobotBeeps()
      return new Promise((resolve) => {
        setTimeout(() => {
          playConfirmBeep()
          resolve()
        }, 500)
      })
    }

    playRobotBeeps()

    return new Promise((resolve) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      setTimeout(() => {
        const audio = new Audio(audioSrc)
        audioRef.current = audio

        audio.onplay = () => setIsPlaying(true)
        audio.onended = () => {
          setIsPlaying(false)
          playConfirmBeep()
          resolve()
        }
        audio.onerror = () => {
          setIsPlaying(false)
          resolve()
        }

        audio.play().catch(() => {
          setIsPlaying(false)
          resolve()
        })
      }, 400)
    })
  }, [audioEnabled, playRobotBeeps, playConfirmBeep])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }, [])

  return { playAudio, stopAudio, isPlaying, audioEnabled, setAudioEnabled }
}
