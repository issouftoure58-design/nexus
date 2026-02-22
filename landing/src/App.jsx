import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react'

// Lazy load Spline pour éviter de bloquer le chargement initial
const Spline = lazy(() => import('@splinetool/react-spline'))
import {
  Phone, MessageCircle, Calendar, BarChart3, Mail,
  ShoppingBag, Users, Globe, Search, Check, ArrowRight,
  Sparkles, Clock, Shield, Zap, Star, ChevronRight,
  Send, Mic, Menu, X, Play, Pause, ChevronLeft, Monitor,
  Image as ImageIcon, Film, Volume2, VolumeX
} from 'lucide-react'
import { clsx } from 'clsx'

// ============================================
// STARFIELD BACKGROUND - Arrière-plan spatial avec parallax
// ============================================
function StarfieldBackground() {
  const [stars, setStars] = useState([])
  const [shootingStars, setShootingStars] = useState([])
  const [scrollY, setScrollY] = useState(0)

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Generate stars on mount
  useEffect(() => {
    const generatedStars = []
    // Layer 1: Small distant stars (slowest parallax)
    for (let i = 0; i < 150; i++) {
      generatedStars.push({
        id: `s1-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200, // Extended range for parallax
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 5,
        layer: 1,
        parallaxSpeed: 0.02 // Slowest
      })
    }
    // Layer 2: Medium stars (medium parallax)
    for (let i = 0; i < 80; i++) {
      generatedStars.push({
        id: `s2-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.4 + 0.4,
        duration: Math.random() * 4 + 3,
        delay: Math.random() * 5,
        layer: 2,
        parallaxSpeed: 0.05 // Medium
      })
    }
    // Layer 3: Bright stars (fastest parallax - closest)
    for (let i = 0; i < 30; i++) {
      generatedStars.push({
        id: `s3-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: Math.random() * 2.5 + 2,
        opacity: Math.random() * 0.3 + 0.7,
        duration: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        layer: 3,
        parallaxSpeed: 0.1, // Fastest
        color: ['#ffffff', '#00f5ff', '#bf00ff', '#ffd700'][Math.floor(Math.random() * 4)]
      })
    }
    setStars(generatedStars)
  }, [])

  // Shooting stars
  useEffect(() => {
    const createShootingStar = () => {
      const id = Date.now()
      const star = {
        id,
        x: Math.random() * 70 + 10,
        y: Math.random() * 30,
        duration: Math.random() * 1 + 0.5
      }
      setShootingStars(prev => [...prev, star])
      setTimeout(() => {
        setShootingStars(prev => prev.filter(s => s.id !== id))
      }, star.duration * 1000 + 500)
    }

    // Random shooting stars
    const interval = setInterval(() => {
      if (Math.random() > 0.6) createShootingStar()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-[#0a0a1a] to-dark-950" />

      {/* Nebula effects with parallax */}
      <div
        className="absolute left-1/4 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] animate-pulse"
        style={{
          animationDuration: '8s',
          top: `calc(0% - ${scrollY * 0.03}px)`
        }}
      />
      <div
        className="absolute right-0 w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[100px] animate-pulse"
        style={{
          animationDuration: '10s',
          animationDelay: '2s',
          top: `calc(33% - ${scrollY * 0.04}px)`
        }}
      />
      <div
        className="absolute left-0 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[80px] animate-pulse"
        style={{
          animationDuration: '12s',
          animationDelay: '4s',
          bottom: `calc(0% + ${scrollY * 0.02}px)`
        }}
      />

      {/* Stars with parallax */}
      {stars.map(star => {
        const parallaxOffset = scrollY * star.parallaxSpeed
        return (
          <div
            key={star.id}
            className="absolute rounded-full animate-twinkle"
            style={{
              left: `${star.x}%`,
              top: `calc(${star.y}% - ${parallaxOffset}px)`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color || '#ffffff',
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              boxShadow: star.layer === 3 ? `0 0 ${star.size * 2}px ${star.color || '#ffffff'}` : 'none',
              willChange: 'top'
            }}
          />
        )
      })}

      {/* Shooting stars */}
      {shootingStars.map(star => (
        <div
          key={star.id}
          className="absolute animate-shooting-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            animationDuration: `${star.duration}s`
          }}
        >
          <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_6px_#fff,_-30px_0_20px_rgba(255,255,255,0.3),_-60px_0_30px_rgba(255,255,255,0.1)]"
               style={{ transform: 'rotate(-45deg)' }} />
        </div>
      ))}

      {/* Grid overlay (subtle) */}
      <div className="absolute inset-0 bg-grid-pattern bg-[size:60px_60px] opacity-[0.03]" />
    </div>
  )
}

// ============================================
// GALLERY SCREENSHOTS - Liste des images
// ============================================
const SCREENSHOTS = Array.from({ length: 19 }, (_, i) => ({
  id: i + 1,
  src: `/gallery/screenshot-${String(i + 1).padStart(2, '0')}.png`,
  alt: `NEXUS Interface ${i + 1}`
}))

// ============================================
// GALLERY SLIDESHOW - Carrousel auto-défilant
// ============================================
function GallerySlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isHovering, setIsHovering] = useState(false)
  const intervalRef = useRef(null)

  // Auto-advance slides
  useEffect(() => {
    if (isPlaying && !isHovering) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % SCREENSHOTS.length)
      }, 4000)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, isHovering])

  const goToSlide = (index) => {
    setCurrentIndex(index)
  }

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % SCREENSHOTS.length)
  }

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Screen Frame */}
      <div
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Monitor Frame */}
        <div className="bg-dark-800 rounded-2xl p-3 border border-white/10 shadow-2xl">
          {/* Top bar (like browser/app) */}
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex-1 bg-dark-700 rounded-lg h-7 flex items-center justify-center">
              <span className="text-xs text-gray-500">admin.nexus-saas.com</span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="relative bg-dark-950 rounded-xl overflow-hidden aspect-[16/9]">
            {/* Images */}
            <div className="relative w-full h-full flex items-center justify-center">
              {SCREENSHOTS.map((screenshot, index) => (
                <img
                  key={screenshot.id}
                  src={screenshot.src}
                  alt={screenshot.alt}
                  className={clsx(
                    'absolute inset-0 w-full h-full object-contain transition-opacity duration-700',
                    index === currentIndex ? 'opacity-100' : 'opacity-0'
                  )}
                />
              ))}
            </div>

            {/* Navigation arrows (visible on hover) */}
            <div className={clsx(
              'absolute inset-0 flex items-center justify-between px-4 transition-opacity duration-300',
              isHovering ? 'opacity-100' : 'opacity-0'
            )}>
              <button
                onClick={prevSlide}
                className="p-2 bg-dark-900/80 backdrop-blur-sm rounded-full border border-white/10 hover:border-neon-cyan/50 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextSlide}
                className="p-2 bg-dark-900/80 backdrop-blur-sm rounded-full border border-white/10 hover:border-neon-cyan/50 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Play/Pause indicator */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={clsx(
                'absolute top-4 right-4 p-2 bg-dark-900/80 backdrop-blur-sm rounded-full border border-white/10 transition-all duration-300',
                isHovering ? 'opacity-100' : 'opacity-0'
              )}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Slide counter */}
            <div className="absolute bottom-4 left-4 bg-dark-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm border border-white/10">
              {currentIndex + 1} / {SCREENSHOTS.length}
            </div>
          </div>
        </div>

        {/* Monitor Stand */}
        <div className="flex justify-center">
          <div className="w-20 h-6 bg-gradient-to-b from-dark-700 to-dark-800 rounded-b-lg" />
        </div>
        <div className="flex justify-center">
          <div className="w-32 h-2 bg-dark-700 rounded-full" />
        </div>
      </div>

      {/* Thumbnails/Dots */}
      <div className="flex justify-center gap-1.5 mt-6 flex-wrap max-w-2xl mx-auto">
        {SCREENSHOTS.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={clsx(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentIndex
                ? 'bg-neon-cyan w-6'
                : 'bg-dark-600 hover:bg-dark-500'
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================
// VIDEO PLAYER - Lecteur vidéo séparé
// ============================================
// ============================================
// DEMOS SECTION - Toutes les démonstrations
// ============================================
const DEMOS = [
  {
    id: 'whatsapp',
    title: 'WhatsApp IA',
    description: 'Réponses automatiques intelligentes sur WhatsApp',
    icon: MessageCircle,
    iconColor: 'text-green-400',
    bgColor: 'from-green-500/20 to-green-600/20',
    borderColor: 'border-green-500/30',
    src: '/demos/demo-whatsapp.mov',
    type: 'video'
  },
  {
    id: 'chat-web',
    title: 'Chat Web',
    description: 'Assistant virtuel intégré à votre site',
    icon: Monitor,
    iconColor: 'text-neon-cyan',
    bgColor: 'from-neon-cyan/20 to-primary-500/20',
    borderColor: 'border-neon-cyan/30',
    src: '/demos/demo-chat-web.mov',
    type: 'video'
  },
  {
    id: 'chat-2',
    title: 'Chat Avancé',
    description: 'Conversation fluide et naturelle',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    bgColor: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    src: '/demos/demo-chat-2.mov',
    type: 'video'
  },
  {
    id: 'telephone',
    title: 'Téléphone IA',
    description: 'Réservation complète par téléphone',
    icon: Phone,
    iconColor: 'text-orange-400',
    bgColor: 'from-orange-500/20 to-red-500/20',
    borderColor: 'border-orange-500/30',
    src: '/demos/demo-telephone.m4a',
    type: 'audio'
  }
]

function DemosSection() {
  const [activeDemo, setActiveDemo] = useState(DEMOS[0])
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Reset when changing demo
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [activeDemo])

  const togglePlay = () => {
    const mediaRef = activeDemo.type === 'video' ? videoRef : audioRef
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
      } else {
        mediaRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    const mediaRef = activeDemo.type === 'video' ? videoRef : audioRef
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    const mediaRef = activeDemo.type === 'video' ? videoRef : audioRef
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration)
    }
  }

  const handleSeek = (e) => {
    const mediaRef = activeDemo.type === 'video' ? videoRef : audioRef
    if (mediaRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width
      mediaRef.current.currentTime = percentage * duration
    }
  }

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate)
    if (videoRef.current) videoRef.current.playbackRate = rate
    if (audioRef.current) audioRef.current.playbackRate = rate
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const ActiveIcon = activeDemo.icon

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Demo Tabs */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {DEMOS.map((demo) => {
          const Icon = demo.icon
          const isActive = activeDemo.id === demo.id
          return (
            <button
              key={demo.id}
              onClick={() => setActiveDemo(demo)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                isActive
                  ? `bg-gradient-to-r ${demo.bgColor} border ${demo.borderColor} ${demo.iconColor}`
                  : 'bg-dark-800/50 border border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{demo.title}</span>
              {demo.type === 'audio' && (
                <span className="text-xs bg-dark-700 px-1.5 py-0.5 rounded">Audio</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Demo Player */}
      <div
        className="relative"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(!isPlaying)}
      >
        {/* Monitor Frame */}
        <div className={clsx(
          'bg-dark-800 rounded-2xl p-3 border shadow-2xl',
          activeDemo.borderColor,
          `shadow-${activeDemo.iconColor.replace('text-', '')}/10`
        )}>
          {/* Top bar */}
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex-1 bg-dark-700 rounded-lg h-7 flex items-center justify-center gap-2">
              <ActiveIcon className={clsx('w-4 h-4', activeDemo.iconColor)} />
              <span className="text-xs text-gray-400">{activeDemo.title} - {activeDemo.description}</span>
            </div>
          </div>

          {/* Content */}
          {activeDemo.type === 'video' ? (
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                src={activeDemo.src}
                className="w-full h-full object-contain"
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />

              {/* Play overlay */}
              <div
                className={clsx(
                  'absolute inset-0 flex items-center justify-center bg-dark-900/50 transition-opacity duration-300 cursor-pointer',
                  isPlaying && !showControls ? 'opacity-0' : 'opacity-100'
                )}
                onClick={togglePlay}
              >
                <button className={clsx(
                  'p-6 backdrop-blur-sm rounded-full border-2 transition-all group',
                  `bg-gradient-to-r ${activeDemo.bgColor} ${activeDemo.borderColor} hover:opacity-80`
                )}>
                  {isPlaying ? (
                    <Pause className="w-12 h-12 text-white group-hover:scale-110 transition-transform" />
                  ) : (
                    <Play className="w-12 h-12 text-white ml-1 group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Audio Player */
            <div className="relative bg-gradient-to-br from-dark-900 to-dark-800 rounded-xl p-8 min-h-[300px] flex flex-col items-center justify-center">
              <audio
                ref={audioRef}
                src={activeDemo.src}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />

              {/* Phone icon animation */}
              <div className={clsx(
                'w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all',
                `bg-gradient-to-br ${activeDemo.bgColor}`,
                isPlaying && 'animate-pulse'
              )}>
                <Phone className={clsx('w-12 h-12', activeDemo.iconColor)} />
              </div>

              <h3 className="text-xl font-bold mb-2">{activeDemo.title}</h3>
              <p className="text-gray-400 text-sm mb-6">{activeDemo.description}</p>

              {/* Play button */}
              <button
                onClick={togglePlay}
                className={clsx(
                  'p-4 rounded-full border-2 transition-all',
                  `bg-gradient-to-r ${activeDemo.bgColor} ${activeDemo.borderColor} hover:opacity-80`
                )}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-0.5" />
                )}
              </button>

              {/* Progress bar */}
              <div className="w-full max-w-md mt-6">
                <div
                  className="h-2 bg-dark-700 rounded-full cursor-pointer overflow-hidden"
                  onClick={handleSeek}
                >
                  <div
                    className={clsx('h-full rounded-full transition-all', activeDemo.iconColor.replace('text-', 'bg-'))}
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback speed control */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-gray-500">Vitesse:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded transition-all',
                      playbackRate === rate
                        ? `${activeDemo.iconColor} bg-dark-700`
                        : 'text-gray-500 hover:text-white'
                    )}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video progress bar (for videos) */}
          {activeDemo.type === 'video' && duration > 0 && (
            <div className="mt-3 px-2">
              <div
                className="h-1.5 bg-dark-700 rounded-full cursor-pointer overflow-hidden"
                onClick={handleSeek}
              >
                <div
                  className={clsx('h-full rounded-full transition-all', activeDemo.iconColor.replace('text-', 'bg-'))}
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                <div className="flex items-center gap-1">
                  <span>Vitesse:</span>
                  {[1, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-xs transition-all',
                        playbackRate === rate
                          ? `${activeDemo.iconColor} bg-dark-700`
                          : 'text-gray-500 hover:text-white'
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monitor Stand */}
        <div className="flex justify-center">
          <div className="w-16 h-5 bg-gradient-to-b from-dark-700 to-dark-800 rounded-b-lg" />
        </div>
        <div className="flex justify-center">
          <div className="w-28 h-2 bg-dark-700 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Configuration Spline (mettre l'URL de votre scène ici)
// ============================================
const SPLINE_SCENE_URL = null // Ex: 'https://prod.spline.design/xxxxx/scene.splinecode'

// ============================================
// NEXUS ROBOT - Le personnage animé (SVG ou Spline)
// ============================================
function NexusRobot({ state = 'idle', onAnimationComplete }) {
  // States: 'entering', 'idle', 'talking', 'listening', 'waving'
  const [currentState, setCurrentState] = useState(state)
  const splineRef = useRef(null)

  useEffect(() => {
    setCurrentState(state)

    // Si Spline est chargé, déclencher les animations
    if (splineRef.current) {
      try {
        // Spline permet de trigger des états via l'API
        // splineRef.current.emitEvent('mouseDown', 'robotState')
      } catch (e) {}
    }
  }, [state])

  // Animation classes based on state
  const robotClasses = clsx(
    'relative transition-all duration-500',
    currentState === 'entering' && 'animate-robot-enter',
    currentState === 'idle' && 'animate-float',
    currentState === 'talking' && 'animate-float',
    currentState === 'waving' && 'animate-float'
  )

  // Si une URL Spline est configurée, utiliser Spline
  if (SPLINE_SCENE_URL) {
    return (
      <div className={robotClasses}>
        <div className="relative w-48 h-48 md:w-64 md:h-64">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse-glow" />

          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
            </div>
          }>
            <Spline
              scene={SPLINE_SCENE_URL}
              onLoad={(spline) => {
                splineRef.current = spline
              }}
              className="w-full h-full"
            />
          </Suspense>
        </div>
      </div>
    )
  }

  // Fallback: Robot SVG animé
  return (
    <div className={robotClasses}>
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        {/* Glow effect behind robot */}
        <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse-glow" />

        {/* Robot body */}
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
          <g className={clsx(
            currentState === 'talking' && 'animate-pulse'
          )}>
            <ellipse cx="82" cy="52" rx="8" ry="10" fill="#00f5ff" />
            <ellipse cx="118" cy="52" rx="8" ry="10" fill="#00f5ff" />
            {/* Eye shine */}
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

// ============================================
// NEXUS CHAT - Chat avec streaming + Voice
// ============================================
function NexusChat({
  messages,
  onSend,
  isTyping,
  inputDisabled,
  disableAutoScroll = false,
  voiceEnabled = false,
  isListening = false,
  transcript = '',
  onStartVoice,
  onStopVoice,
  isSpeaking = false
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const chatContainerRef = useRef(null)

  // Auto-scroll only within the chat container, not the page
  useEffect(() => {
    if (!disableAutoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, disableAutoScroll])

  // Mettre à jour l'input avec le transcript vocal
  useEffect(() => {
    if (transcript) {
      setInput(transcript)
    }
  }, [transcript])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !inputDisabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleVoiceClick = () => {
    if (isListening) {
      onStopVoice?.()
      // Envoyer automatiquement si on a du texte
      if (input.trim()) {
        setTimeout(() => {
          onSend(input.trim())
          setInput('')
        }, 300)
      }
    } else {
      onStartVoice?.()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Chat container */}
      <div className="bg-dark-900/80 backdrop-blur-xl border border-neon-cyan/20 rounded-2xl overflow-hidden shadow-2xl">
        {/* Messages area */}
        <div ref={chatContainerRef} className="h-48 md:h-56 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'flex animate-slide-up',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : 'bg-dark-700 text-gray-100 rounded-bl-md border border-neon-cyan/10'
              )}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-neon-cyan font-medium">NEXUS</span>
                  </div>
                )}
                <p className="text-sm md:text-base leading-relaxed">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-neon-cyan ml-1 animate-typing" />
                  )}
                </p>
              </div>
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-dark-700 rounded-2xl rounded-bl-md px-4 py-3 border border-neon-cyan/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="border-t border-neon-cyan/10 p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Je vous écoute..." : "Posez votre question..."}
              disabled={inputDisabled || isListening}
              className={clsx(
                "flex-1 bg-dark-800 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all disabled:opacity-50",
                isListening
                  ? "border-red-500/50 ring-2 ring-red-500/30 animate-pulse"
                  : "border-dark-600 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30"
              )}
            />
            {/* Bouton micro */}
            {voiceEnabled && (
              <button
                type="button"
                onClick={handleVoiceClick}
                disabled={inputDisabled || isSpeaking}
                className={clsx(
                  "p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white border border-dark-600"
                )}
                title={isListening ? "Arrêter l'écoute" : "Parler"}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            {/* Bouton envoyer */}
            <button
              type="submit"
              disabled={!input.trim() || inputDisabled || isListening}
              className="p-3 bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {isSpeaking ? (
              <span className="text-neon-cyan flex items-center justify-center gap-2">
                <Volume2 className="w-3 h-3 animate-pulse" /> NEXUS parle...
              </span>
            ) : isListening ? (
              <span className="text-red-400 flex items-center justify-center gap-2">
                <Mic className="w-3 h-3 animate-pulse" /> Parlez maintenant...
              </span>
            ) : voiceEnabled ? (
              "Tapez ou cliquez sur le micro pour parler"
            ) : (
              "NEXUS peut répondre à toutes vos questions"
            )}
          </p>
        </form>
      </div>
    </div>
  )
}

// ============================================
// UTILITAIRE - Nettoyage texte pour TTS
// ============================================

/**
 * Nettoie le texte pour une lecture TTS naturelle
 * - Supprime emojis, markdown, caractères spéciaux
 * - Convertit les prix et pourcentages en format parlé
 * - Améliore la ponctuation pour des pauses naturelles
 */
function cleanTextForTTS(text) {
  if (!text) return ''

  let cleaned = text
    // Supprimer tous les emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols Extended-A
    .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, Hourglass
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Various symbols
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Various symbols
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
    .replace(/[\u{25B6}]/gu, '')            // Play button
    .replace(/[\u{25C0}]/gu, '')            // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
    .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, Coffee
    .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
    .replace(/[\u{267F}]/gu, '')            // Wheelchair
    .replace(/[\u{2693}]/gu, '')            // Anchor
    .replace(/[\u{26A1}]/gu, '')            // High voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, Baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, Sun
    .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
    .replace(/[\u{26D4}]/gu, '')            // No entry
    .replace(/[\u{26EA}]/gu, '')            // Church
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, Golf
    .replace(/[\u{26F5}]/gu, '')            // Sailboat
    .replace(/[\u{26FA}]/gu, '')            // Tent
    .replace(/[\u{26FD}]/gu, '')            // Fuel pump
    .replace(/[\u{2702}]/gu, '')            // Scissors
    .replace(/[\u{2705}]/gu, '')            // Check mark
    .replace(/[\u{2708}-\u{270D}]/gu, '')   // Airplane to Writing hand
    .replace(/[\u{270F}]/gu, '')            // Pencil
    .replace(/[\u{2712}]/gu, '')            // Black nib
    .replace(/[\u{2714}]/gu, '')            // Check mark
    .replace(/[\u{2716}]/gu, '')            // X mark
    .replace(/[\u{271D}]/gu, '')            // Latin cross
    .replace(/[\u{2721}]/gu, '')            // Star of David
    .replace(/[\u{2728}]/gu, '')            // Sparkles
    .replace(/[\u{2733}-\u{2734}]/gu, '')   // Eight spoked asterisk
    .replace(/[\u{2744}]/gu, '')            // Snowflake
    .replace(/[\u{2747}]/gu, '')            // Sparkle
    .replace(/[\u{274C}]/gu, '')            // Cross mark
    .replace(/[\u{274E}]/gu, '')            // Cross mark
    .replace(/[\u{2753}-\u{2755}]/gu, '')   // Question marks
    .replace(/[\u{2757}]/gu, '')            // Exclamation
    .replace(/[\u{2763}-\u{2764}]/gu, '')   // Heart exclamation
    .replace(/[\u{2795}-\u{2797}]/gu, '')   // Plus, Minus, Division
    .replace(/[\u{27A1}]/gu, '')            // Right arrow
    .replace(/[\u{27B0}]/gu, '')            // Curly loop
    .replace(/[\u{27BF}]/gu, '')            // Double curly loop
    .replace(/[\u{2934}-\u{2935}]/gu, '')   // Arrows
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')   // Arrows
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')   // Squares
    .replace(/[\u{2B50}]/gu, '')            // Star
    .replace(/[\u{2B55}]/gu, '')            // Circle
    .replace(/[\u{3030}]/gu, '')            // Wavy dash
    .replace(/[\u{303D}]/gu, '')            // Part alternation mark
    .replace(/[\u{3297}]/gu, '')            // Circled Ideograph Congratulation
    .replace(/[\u{3299}]/gu, '')            // Circled Ideograph Secret

    // Supprimer le markdown
    .replace(/\*\*/g, '')           // Bold
    .replace(/\*/g, '')             // Italic
    .replace(/__/g, '')             // Bold alt
    .replace(/_/g, ' ')             // Italic alt -> espace
    .replace(/`/g, '')              // Code
    .replace(/#{1,6}\s/g, '')       // Headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links -> texte seul

    // Convertir les prix en format parlé
    .replace(/(\d+)€\/mois/g, '$1 euros par mois')
    .replace(/(\d+)€/g, '$1 euros')
    .replace(/(\d+)\$/g, '$1 dollars')

    // Convertir les pourcentages
    .replace(/(\d+)%/g, '$1 pour cent')

    // Convertir les fractions de temps
    .replace(/24h\/24/g, 'vingt-quatre heures sur vingt-quatre')
    .replace(/7j\/7/g, 'sept jours sur sept')
    .replace(/24\/7/g, 'vingt-quatre sept')

    // Améliorer les nombres pour une meilleure lecture
    .replace(/(\d+)-(\d+)/g, '$1 à $2')  // Plages: 2-3 -> 2 à 3

    // Nettoyer les listes
    .replace(/^[-•]\s*/gm, '')      // Puces en début de ligne
    .replace(/\n[-•]\s*/g, ', ')    // Puces -> virgules
    .replace(/^\d+\.\s*/gm, '')     // Numéros de liste

    // Nettoyer la ponctuation excessive
    .replace(/\.{2,}/g, '.')        // Multiple points -> un seul
    .replace(/!{2,}/g, '!')         // Multiple exclamations
    .replace(/\?{2,}/g, '?')        // Multiple questions
    .replace(/,{2,}/g, ',')         // Multiple virgules
    .replace(/:\s*$/gm, '.')        // Deux-points en fin -> point
    .replace(/;\s/g, ', ')          // Point-virgule -> virgule

    // Améliorer les pauses
    .replace(/\n+/g, '. ')          // Sauts de ligne -> pauses
    .replace(/\s*\.\s*\.\s*/g, '. ') // Double points -> simple

    // Nettoyer les espaces
    .replace(/\s+/g, ' ')           // Espaces multiples -> simple
    .replace(/\s+\./g, '.')         // Espace avant point
    .replace(/\s+,/g, ',')          // Espace avant virgule
    .replace(/\(\s+/g, '(')         // Espace après parenthèse ouvrante
    .replace(/\s+\)/g, ')')         // Espace avant parenthèse fermante

    // Supprimer les parenthèses vides ou avec juste des espaces
    .replace(/\(\s*\)/g, '')

    // Trim final
    .trim()

  // S'assurer que le texte se termine par une ponctuation
  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.'
  }

  return cleaned
}

// ============================================
// CONFIGURATIONS - Messages de Nexus
// ============================================
const MESSAGES_CONFIG = {
  welcome: {
    text: "Bonjour ! Je suis NEXUS, votre assistant IA. Je peux automatiser votre business : reservations, appels telephoniques, WhatsApp, CRM, facturation... Posez-moi vos questions, je suis la pour vous aider !",
    audio: "/audio/welcome.mp3"
  },
  prix: {
    text: "Nous avons 3 plans : Starter a 199€/mois avec 1 assistant IA, CRM et agenda. Pro a 399€/mois avec tous les assistants IA, marketing et comptabilite. Business a 799€/mois pour les entreprises multi-sites avec API et account manager dedie. Essai gratuit de 14 jours !",
    audio: null // Pas d'audio pour ce nouveau texte
  },
  telephone: {
    text: "Notre assistant Telephone IA repond a vos appels 24h/24, 7j/7. Il peut prendre des rendez-vous, repondre aux questions frequentes, et transferer vers un humain si necessaire. Disponible dans les plans Starter, Pro et Business.",
    audio: null
  },
  whatsapp: {
    text: "L'assistant WhatsApp IA repond instantanement a vos clients. Il peut prendre des RDV, envoyer des confirmations, et repondre aux questions. Inclus dans tous nos plans !",
    audio: null
  },
  reservation: {
    text: "Notre systeme de reservations permet a vos clients de reserver en ligne 24/7. Calendrier synchronise, rappels automatiques, gestion des creneaux. Inclus dans tous les plans NEXUS !",
    audio: null
  },
  essai: {
    text: "Vous pouvez essayer NEXUS gratuitement pendant 14 jours, sans carte bancaire requise. Cliquez sur 'Essai gratuit' pour commencer !",
    audio: "/audio/faq-essai.mp3"
  },
  default: {
    text: "Je suis la pour repondre a toutes vos questions sur NEXUS ! Vous pouvez me demander des infos sur nos plans (Starter 199€, Pro 399€, Business 799€), les fonctionnalites, ou comment demarrer votre essai gratuit.",
    audio: null
  }
}

// Hook pour l'ambiance spatiale
function useSpaceAmbient(enabled) {
  const audioContextRef = useRef(null)
  const nodesRef = useRef([])

  useEffect(() => {
    if (!enabled) {
      // Arrêter l'ambiance
      nodesRef.current.forEach(node => {
        try { node.stop() } catch (e) {}
      })
      nodesRef.current = []
      return
    }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = ctx

      // Créer un drone spatial subtil
      const createDrone = (freq, vol) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.value = freq
        // Légère modulation de fréquence pour un effet spatial
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

      // Plusieurs couches de drones pour un son riche
      createDrone(40, 0.015)  // Très basse fréquence
      createDrone(60, 0.01)   // Bass
      createDrone(80, 0.008)  // Sub-mid

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

// Hook pour les effets sonores (bips, ambient)
function useSoundEffects() {
  const audioContextRef = useRef(null)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  // Jouer un bip robotique
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

  // Séquence de bips robotiques
  const playRobotBeeps = useCallback(() => {
    const frequencies = [600, 800, 1000, 800]
    frequencies.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.08, 0.05), i * 100)
    })
  }, [playBeep])

  // Bip de confirmation
  const playConfirmBeep = useCallback(() => {
    playBeep(600, 0.1, 0.05)
    setTimeout(() => playBeep(900, 0.15, 0.05), 120)
  }, [playBeep])

  return { playBeep, playRobotBeeps, playConfirmBeep }
}

// Hook pour la synthèse vocale (TTS) - Stable et performant
function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const voiceRef = useRef(null)
  const queueRef = useRef([])
  const isProcessingRef = useRef(false)

  // Charger les voix
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || []
      if (voices.length > 0) {
        // Chercher une voix française de qualité
        const frenchVoices = voices.filter(v => v.lang.startsWith('fr'))
        // Préférer les voix "premium" ou "enhanced"
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

  // Traiter la queue de parole
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
    utterance.rate = 0.95   // Un peu plus lent pour clarté
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)

    utterance.onend = () => {
      setIsSpeaking(false)
      isProcessingRef.current = false
      onEnd?.()
      // Traiter le prochain élément
      setTimeout(processQueue, 100)
    }

    utterance.onerror = (e) => {
      console.warn('TTS error:', e.error)
      setIsSpeaking(false)
      isProcessingRef.current = false
      onEnd?.()
      setTimeout(processQueue, 100)
    }

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

    window.speechSynthesis.speak(utterance)
  }, [])

  const speak = useCallback((text, onEnd) => {
    if (!text) {
      onEnd?.()
      return
    }

    // Découper en phrases pour une meilleure fluidité
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

// Hook pour la reconnaissance vocale (Speech-to-Text)
function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    // Vérifier le support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSupported(true)

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'fr-FR'
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setTranscript('')
      }

      recognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        setTranscript(finalTranscript || interimTranscript)
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      try {
        recognitionRef.current.start()
      } catch (e) {
        // Peut arriver si déjà en cours
        console.warn('Recognition already started')
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening
  }
}

// Hook pour gérer l'audio principal (voix)
function useNexusAudio() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const { playRobotBeeps, playConfirmBeep } = useSoundEffects()

  const playAudio = useCallback((audioSrc) => {
    if (!audioEnabled) return Promise.resolve()

    // Si pas de source audio, juste jouer les bips
    if (!audioSrc) {
      playRobotBeeps()
      return new Promise((resolve) => {
        setTimeout(() => {
          playConfirmBeep()
          resolve()
        }, 500)
      })
    }

    // Jouer les bips d'introduction
    playRobotBeeps()

    return new Promise((resolve) => {
      // Arrêter l'audio précédent
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      // Petit délai après les bips
      setTimeout(() => {
        // Créer nouvel audio
        const audio = new Audio(audioSrc)
        audioRef.current = audio

        audio.onplay = () => setIsPlaying(true)
        audio.onended = () => {
          setIsPlaying(false)
          playConfirmBeep() // Bip de fin
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
      }, 400) // Délai après les bips
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

// ============================================
// MAIN APP
// ============================================
function App() {
  const [robotState, setRobotState] = useState('entering')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showStartButton, setShowStartButton] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { playAudio, stopAudio, isPlaying, audioEnabled, setAudioEnabled } = useNexusAudio()
  const { speak: speakTTS, stop: stopTTS, isSpeaking } = useTextToSpeech()
  const { playRobotBeeps, playConfirmBeep } = useSoundEffects()
  const {
    isListening,
    transcript,
    isSupported: voiceSupported,
    startListening,
    stopListening
  } = useSpeechRecognition()

  // Activer l'ambiance spatiale quand le son est activé
  useSpaceAmbient(audioEnabled && hasStarted)

  // Sequence d'entree - Robot arrive puis attend le clic
  useEffect(() => {
    // Robot arrive
    setTimeout(() => {
      setRobotState('idle')
      setShowStartButton(true)
    }, 1500)
  }, [])

  // Fonction pour démarrer l'expérience (appelée au clic)
  const startExperience = async () => {
    setShowStartButton(false)
    setRobotState('talking')
    await speakMessage('welcome')
  }

  // Fonction pour faire parler Nexus (audio + texte synchronisé)
  const speakMessage = async (messageKey) => {
    const config = MESSAGES_CONFIG[messageKey]
    if (!config) return

    setIsTyping(true)
    setHasStarted(true)
    setRobotState('talking')

    // Ajouter un message vide qui va se remplir
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

    // Lancer l'audio en parallèle
    const audioPromise = playAudio(config.audio)

    // Calculer la vitesse de frappe basée sur la durée estimée de l'audio
    // ~180 mots/min en parole = ~25 caractères/seconde (voix rapide)
    const estimatedAudioDuration = config.text.length / 25 * 1000
    const charDelay = estimatedAudioDuration / config.text.length

    // Streamer caractere par caractere synchronisé avec l'audio
    for (let i = 0; i <= config.text.length; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.max(charDelay, 15)))
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: config.text.slice(0, i)
        }
        return updated
      })
    }

    // Attendre la fin de l'audio
    await audioPromise

    // Terminer le streaming
    setMessages(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        isStreaming: false
      }
      return updated
    })

    setIsTyping(false)
    setRobotState('idle')
  }

  // API URL pour l'agent commercial
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Gerer l'envoi d'un message utilisateur - Appel API avec streaming + TTS
  const handleSend = async (text) => {
    // Arrêter l'audio et TTS en cours
    stopAudio()
    stopTTS()

    // Ajouter le message utilisateur
    setMessages(prev => [...prev, { role: 'user', content: text }])

    // Robot ecoute puis repond
    setRobotState('listening')
    setHasStarted(true)

    // Jouer les bips robotiques
    if (audioEnabled) {
      playRobotBeeps()
    }

    await new Promise(resolve => setTimeout(resolve, 400))

    // Préparer l'historique des messages pour l'API (sans les messages système)
    const chatHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    // Ajouter le nouveau message
    chatHistory.push({ role: 'user', content: text })

    // Ajouter un message vide qui va se remplir en streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])
    setIsTyping(true)
    setRobotState('talking')

    let fullResponse = ''
    let spokenText = ''
    let sentenceBuffer = ''

    // Fonction pour parler une phrase complète
    const speakSentence = (sentence) => {
      if (!audioEnabled || !sentence.trim()) return
      const cleanSentence = cleanTextForTTS(sentence)
      if (cleanSentence && cleanSentence !== spokenText) {
        speakTTS(cleanSentence)
        spokenText += cleanSentence
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/landing/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error('API error')
      }

      // Lire le stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullResponse += parsed.text
                sentenceBuffer += parsed.text

                // Mettre à jour le message en streaming
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullResponse
                  }
                  return updated
                })

                // Vérifier si on a une phrase complète à lire
                const sentenceMatch = sentenceBuffer.match(/^(.+?[.!?])\s*/)
                if (sentenceMatch) {
                  speakSentence(sentenceMatch[1])
                  sentenceBuffer = sentenceBuffer.slice(sentenceMatch[0].length)
                }
              }
            } catch (e) {
              // Ignorer les erreurs de parsing JSON
            }
          }
        }
      }

      // Lire le reste du buffer s'il reste du texte
      if (sentenceBuffer.trim()) {
        speakSentence(sentenceBuffer)
      }

      // Terminer le streaming texte
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false
        }
        return updated
      })

      // Attendre que la synthèse vocale termine
      if (audioEnabled) {
        await new Promise(resolve => {
          const checkSpeaking = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              clearInterval(checkSpeaking)
              playConfirmBeep()
              resolve()
            }
          }, 100)
          // Timeout de sécurité
          setTimeout(() => {
            clearInterval(checkSpeaking)
            resolve()
          }, 30000)
        })
      }

    } catch (error) {
      console.error('Chat API error:', error)
      // En cas d'erreur, afficher un message d'erreur
      const errorMsg = "Désolé, je rencontre un problème technique. Vous pouvez me contacter directement via le formulaire de contact ou essayer de nouveau dans quelques instants."
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: errorMsg,
          isStreaming: false
        }
        return updated
      })

      if (audioEnabled) {
        speakTTS(errorMsg)
      }
    }

    setIsTyping(false)
    setRobotState('idle')
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white overflow-x-hidden">
      {/* Starfield Background - z-index négatif pour être derrière le contenu */}
      <div className="fixed inset-0 z-0">
        <StarfieldBackground />
      </div>

      {/* Contenu principal - z-index positif */}
      <div className="relative z-10">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                NEXUS
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#gallery" className="text-gray-400 hover:text-white transition">Galerie</a>
              <a href="#demo" className="text-gray-400 hover:text-white transition">Demo</a>
              <a href="#pricing" className="text-gray-400 hover:text-white transition">Tarifs</a>
            </div>

            <div className="flex items-center gap-4">
              <a href="http://localhost:3001/login" className="text-gray-400 hover:text-white transition hidden sm:block">
                Connexion
              </a>
              <a
                href="http://localhost:3001/signup"
                className="bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Essai gratuit
              </a>
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-dark-900 border-t border-white/5 animate-slide-up">
            <div className="px-4 py-4 space-y-3">
              <a href="#gallery" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Galerie</a>
              <a href="#demo" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Demo</a>
              <a href="#pricing" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Tarifs</a>
              <a href="http://localhost:3001/login" className="block text-gray-300 hover:text-white py-2">Connexion</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Robot + Chat Central */}
      <section className="min-h-screen flex flex-col items-center pt-20 pb-8 px-4 relative">
        {/* Title - More compact */}
        <div className="text-center mb-4 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-2">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Rencontrez
            </span>{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              NEXUS
            </span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            Votre assistant IA qui automatise tout votre business
          </p>
        </div>

        {/* Robot - Smaller */}
        <div className="mb-4 scale-90 md:scale-100 relative">
          <NexusRobot state={robotState} />
          {/* Audio toggle button */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={clsx(
              'absolute -bottom-2 right-0 p-2 rounded-full border transition-all',
              audioEnabled
                ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                : 'bg-dark-800/80 border-white/10 text-gray-500'
            )}
            title={audioEnabled ? 'Couper le son' : 'Activer le son'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Bouton Démarrer - Apparaît avant que Nexus parle */}
        {showStartButton && (
          <button
            onClick={startExperience}
            className="mb-6 px-8 py-4 bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition-all animate-pulse-glow flex items-center gap-3"
          >
            <Play className="w-6 h-6" />
            Cliquez pour parler avec NEXUS
          </button>
        )}

        {/* Chat - Reduced height */}
        {hasStarted && (
          <NexusChat
            messages={messages}
            onSend={handleSend}
            isTyping={isTyping}
            inputDisabled={isTyping || isSpeaking}
            voiceEnabled={voiceSupported && audioEnabled}
            isListening={isListening}
            transcript={transcript}
            onStartVoice={startListening}
            onStopVoice={stopListening}
            isSpeaking={isSpeaking}
          />
        )}

        {/* Scroll indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-5 h-5 text-gray-500 rotate-90" />
        </div>
      </section>

      {/* Features highlight */}
      <section className="py-16 px-4 bg-dark-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-neon-cyan/20 to-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-7 h-7 text-neon-cyan" />
              </div>
              <h3 className="text-xl font-bold mb-2">Telephone IA</h3>
              <p className="text-gray-400">Repondez a 100% de vos appels, meme a 3h du matin</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">WhatsApp IA</h3>
              <p className="text-gray-400">Reponses instantanees sur le canal prefere de vos clients</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Reservations</h3>
              <p className="text-gray-400">Vos clients reservent 24/7, vous ne ratez plus rien</p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section - Screenshots */}
      <section id="gallery" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 text-neon-cyan px-4 py-2 rounded-full text-sm font-medium mb-4">
              <ImageIcon className="w-4 h-4" />
              Apercu de la plateforme
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Decouvrez
              </span>{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                l'interface
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Une interface moderne et intuitive, concue pour les professionnels qui veulent gagner du temps.
            </p>
          </div>

          <GallerySlideshow />
        </div>
      </section>

      {/* Demos Section */}
      <section id="demos" className="py-20 px-4 bg-dark-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neon-purple/10 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Film className="w-4 h-4" />
              Démonstrations
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                NEXUS en
              </span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                action
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Découvrez comment NEXUS automatise les tâches quotidiennes de votre business.
            </p>
          </div>

          <DemosSection />
        </div>
      </section>

      {/* Pricing Section - 3 Plans */}
      <section id="pricing" className="py-20 px-4 bg-dark-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Choisissez votre{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                plan
              </span>
            </h2>
            <p className="text-gray-400 text-lg">
              Pas de frais caches. 14 jours d'essai gratuit. Annulez a tout moment.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Starter */}
            <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-white/20 transition-colors">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Starter</h3>
                <p className="text-gray-400 text-sm mb-4">Pour demarrer avec l'IA</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">199€</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>1 Assistant IA (Telephone ou WhatsApp)</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>CRM & Gestion clients</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Agenda & Reservations</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Facturation & Devis</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Support email</span>
                </li>
              </ul>
              <a
                href="http://localhost:3001/signup?plan=starter"
                className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-white/10 rounded-xl font-semibold transition-colors"
              >
                Commencer l'essai
              </a>
            </div>

            {/* Pro - Featured */}
            <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/50 rounded-2xl p-6 lg:p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon-cyan text-dark-900 text-xs font-bold px-3 py-1 rounded-full">
                POPULAIRE
              </div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <p className="text-gray-400 text-sm mb-4">Pour les professionnels</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-neon-cyan">399€</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Tous les assistants IA inclus</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>CRM avance + Marketing</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Agenda multi-employes</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Comptabilite complete</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Gestion des stocks</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>Support prioritaire</span>
                </li>
              </ul>
              <a
                href="http://localhost:3001/signup?plan=pro"
                className="block w-full py-3 px-6 text-center bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Commencer l'essai
              </a>
            </div>

            {/* Business */}
            <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-purple-500/30 transition-colors">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Business</h3>
                <p className="text-gray-400 text-sm mb-4">Pour les entreprises</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-purple-400">799€</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Tout le plan Pro inclus</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Multi-sites / Multi-agences</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>API & Integrations</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Rapports avances</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Formations personnalisees</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Account manager dedie</span>
                </li>
              </ul>
              <a
                href="http://localhost:3001/signup?plan=business"
                className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-purple-500/30 rounded-xl font-semibold transition-colors"
              >
                Contacter les ventes
              </a>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400 mt-12">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span>14 jours d'essai gratuit</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>Sans carte bancaire</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span>Sans engagement</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-neon-cyan/10 to-primary-500/10 border border-neon-cyan/20 rounded-3xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pret a automatiser votre{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                business
              </span>{' '}?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Rejoignez des centaines de professionnels qui gagnent du temps chaque jour grace a NEXUS.
            </p>
            <a
              href="http://localhost:3001/signup"
              className="inline-flex items-center gap-2 bg-white text-dark-900 font-semibold py-4 px-10 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Demarrer l'essai gratuit
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">NEXUS</span>
              </div>
              <p className="text-sm text-gray-500">
                Automatisez votre business avec l'intelligence artificielle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#pricing" className="hover:text-white transition">Tarifs</a></li>
                <li><a href="#demos" className="hover:text-white transition">Démos</a></li>
                <li><a href="#gallery" className="hover:text-white transition">Galerie</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-white transition">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-white transition">CGV</a></li>
                <li><a href="#" className="hover:text-white transition">Confidentialite</a></li>
                <li><a href="#" className="hover:text-white transition">Mentions legales</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-sm text-gray-500">
            <p>© 2026 NEXUS. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
      </div>{/* Fin du contenu principal z-10 */}
    </div>
  )
}

export default App
