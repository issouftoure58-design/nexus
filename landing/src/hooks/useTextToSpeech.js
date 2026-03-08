import { useState, useEffect, useRef, useCallback } from 'react'

export default function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const voiceRef = useRef(null)
  const queueRef = useRef([])
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || []
      if (voices.length > 0) {
        const frenchVoices = voices.filter(v => v.lang.startsWith('fr'))
        const premiumFr = frenchVoices.find(v =>
          v.name.toLowerCase().includes('premium') ||
          v.name.toLowerCase().includes('enhanced') ||
          v.name.toLowerCase().includes('google') ||
          v.name.toLowerCase().includes('microsoft')
        )
        voiceRef.current = premiumFr || frenchVoices[0] || voices[0]
        setVoicesLoaded(true)
      }
    }

    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
    }
  }, [])

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) return

    isProcessingRef.current = true
    const { text, onEnd } = queueRef.current.shift()

    if (!window.speechSynthesis || !text) {
      isProcessingRef.current = false
      onEnd?.()
      processQueue()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)

    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.lang = 'fr-FR'
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)

    // Workaround pour Chrome qui coupe parfois la synthèse
    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
    }, 500)

    utterance.onend = () => {
      clearInterval(resumeInterval)
      setIsSpeaking(false)
      isProcessingRef.current = false
      onEnd?.()
      setTimeout(processQueue, 100)
    }

    utterance.onerror = (e) => {
      clearInterval(resumeInterval)
      console.warn('TTS error:', e.error)
      setIsSpeaking(false)
      isProcessingRef.current = false
      onEnd?.()
      setTimeout(processQueue, 100)
    }

    window.speechSynthesis.speak(utterance)
  }, [])

  const speak = useCallback((text, onEnd) => {
    if (!text) {
      onEnd?.()
      return
    }

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

    sentences.forEach((sentence, index) => {
      queueRef.current.push({
        text: sentence.trim(),
        onEnd: index === sentences.length - 1 ? onEnd : undefined
      })
    })

    processQueue()
  }, [processQueue])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    queueRef.current = []
    isProcessingRef.current = false
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, voicesLoaded }
}
