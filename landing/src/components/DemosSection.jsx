import { useState, useEffect, useRef } from 'react'
import {
  Phone, MessageCircle, Monitor, Sparkles,
  Play, Pause
} from 'lucide-react'
import { clsx } from 'clsx'

const DEMOS = [
  {
    id: 'whatsapp',
    title: 'WhatsApp IA',
    description: 'Réponses automatiques intelligentes sur WhatsApp',
    icon: MessageCircle,
    iconColor: 'text-green-400',
    bgColor: 'from-green-500/20 to-green-600/20',
    borderColor: 'border-green-500/30',
    src: '/demos/demo-whatsapp.mp4',
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
    src: '/demos/demo-chat-web.mp4',
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
    src: '/demos/demo-chat-2.mp4',
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

export default function DemosSection() {
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
                preload="none"
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
                preload="none"
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
