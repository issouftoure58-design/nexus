import { useEffect, useRef } from 'react'

export default function useSpaceAmbient(enabled) {
  const audioContextRef = useRef(null)
  const nodesRef = useRef([])

  useEffect(() => {
    if (!enabled) {
      nodesRef.current.forEach(node => {
        try { node.stop() } catch (e) {}
      })
      nodesRef.current = []
      return
    }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = ctx

      const createDrone = (freq, vol) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.value = freq
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.frequency.value = 0.1
        lfoGain.gain.value = 2
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start()

        filter.type = 'lowpass'
        filter.frequency.value = 200

        gain.gain.value = vol

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)

        osc.start()
        nodesRef.current.push(osc, lfo)
        return osc
      }

      createDrone(40, 0.015)
      createDrone(60, 0.01)
      createDrone(80, 0.008)

    } catch (e) {
      // Web Audio not supported
    }

    return () => {
      nodesRef.current.forEach(node => {
        try { node.stop() } catch (e) {}
      })
      nodesRef.current = []
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [enabled])
}
