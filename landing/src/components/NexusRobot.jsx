import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { clsx } from 'clsx'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SPLINE_SCENE_URL = null

export default function NexusRobot({ state = 'idle' }) {
  const [currentState, setCurrentState] = useState(state)
  const splineRef = useRef(null)

  useEffect(() => {
    setCurrentState(state)
    if (splineRef.current) {
      try {
        // Spline API trigger
      } catch (e) {}
    }
  }, [state])

  const robotClasses = clsx(
    'relative transition-all duration-500',
    currentState === 'entering' && 'animate-robot-enter',
    currentState === 'idle' && 'animate-float',
    currentState === 'talking' && 'animate-float',
    currentState === 'waving' && 'animate-float'
  )

  if (SPLINE_SCENE_URL) {
    return (
      <div className={robotClasses}>
        <div className="relative w-48 h-48 md:w-64 md:h-64">
          <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse-glow" />
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
            </div>
          }>
            <Spline
              scene={SPLINE_SCENE_URL}
              onLoad={(spline) => { splineRef.current = spline }}
              className="w-full h-full"
            />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className={robotClasses}>
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse-glow" />

        <svg viewBox="0 0 200 200" className="w-full h-full relative z-10">
          {/* Jet flames under feet */}
          <g className={clsx(currentState !== 'entering' && 'animate-pulse')}>
            <ellipse cx="70" cy="185" rx="12" ry="20" fill="url(#flameGradient)" opacity="0.8" />
            <ellipse cx="130" cy="185" rx="12" ry="20" fill="url(#flameGradient)" opacity="0.8" />
          </g>

          {/* Legs */}
          <rect x="60" y="140" width="20" height="40" rx="8" fill="#1e3a5f" />
          <rect x="120" y="140" width="20" height="40" rx="8" fill="#1e3a5f" />

          {/* Feet/Jets */}
          <ellipse cx="70" cy="175" rx="15" ry="8" fill="#0ea5e9" />
          <ellipse cx="130" cy="175" rx="15" ry="8" fill="#0ea5e9" />

          {/* Body */}
          <rect x="55" y="80" width="90" height="65" rx="20" fill="url(#bodyGradient)" />

          {/* Chest light */}
          <circle cx="100" cy="110" r="12" fill="#00f5ff" className={clsx(
            currentState === 'talking' ? 'animate-pulse' : 'opacity-80'
          )} />
          <circle cx="100" cy="110" r="8" fill="#ffffff" opacity="0.8" />

          {/* Arms */}
          <g className={clsx(
            currentState === 'waving' && 'origin-[45px_95px]',
            currentState === 'waving' && 'animate-[wave_0.5s_ease-in-out_infinite]'
          )}>
            <rect x="30" y="85" width="18" height="40" rx="8" fill="#1e3a5f" />
            <circle cx="39" cy="130" r="10" fill="#0ea5e9" />
          </g>
          <rect x="152" y="85" width="18" height="40" rx="8" fill="#1e3a5f" />
          <circle cx="161" cy="130" r="10" fill="#0ea5e9" />

          {/* Head */}
          <ellipse cx="100" cy="55" rx="40" ry="35" fill="url(#headGradient)" />

          {/* Visor/Face */}
          <ellipse cx="100" cy="55" rx="32" ry="20" fill="#0a1929" />

          {/* Eyes */}
          <g className={clsx(currentState === 'talking' && 'animate-pulse')}>
            <ellipse cx="82" cy="52" rx="8" ry="10" fill="#00f5ff" />
            <ellipse cx="118" cy="52" rx="8" ry="10" fill="#00f5ff" />
            <circle cx="85" cy="49" r="3" fill="#ffffff" opacity="0.8" />
            <circle cx="121" cy="49" r="3" fill="#ffffff" opacity="0.8" />
          </g>

          {/* Antenna */}
          <line x1="100" y1="20" x2="100" y2="8" stroke="#0ea5e9" strokeWidth="3" />
          <circle cx="100" cy="5" r="5" fill="#00f5ff" className="animate-pulse" />

          {/* Mouth (visible when talking) */}
          {currentState === 'talking' && (
            <rect x="90" y="62" width="20" height="4" rx="2" fill="#00f5ff" className="animate-pulse" />
          )}

          {/* Gradients */}
          <defs>
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="headGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <linearGradient id="flameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" stopOpacity="0" />
              <stop offset="50%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#bf00ff" />
            </linearGradient>
          </defs>
        </svg>

        {/* Floating particles around robot */}
        <div className="absolute top-1/4 left-0 w-2 h-2 bg-neon-cyan rounded-full animate-float opacity-60" style={{ animationDelay: '0s' }} />
        <div className="absolute top-1/3 right-0 w-1.5 h-1.5 bg-neon-purple rounded-full animate-float opacity-60" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 left-4 w-1 h-1 bg-neon-cyan rounded-full animate-float opacity-60" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  )
}
