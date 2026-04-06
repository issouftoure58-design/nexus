import { useState, useEffect, useRef } from 'react'
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

const SCREENSHOT_ALTS = [
  'Tableau de bord NEXUS avec indicateurs de performance et reservations du jour',
  'Page de gestion des reservations en ligne avec calendrier interactif',
  'CRM client NEXUS avec historique des visites et preferences',
  'Assistant WhatsApp IA repondant automatiquement a un client',
  'Interface de configuration du chatbot IA conversationnel',
  'Page comptabilite avec suivi des revenus et depenses mensuels',
  'Gestion des equipes et planning des collaborateurs',
  'Campagne marketing automatisee avec segmentation clients',
  'Parametres de l\'activite avec horaires et services personnalises',
  'Dashboard analytique avec statistiques de frequentation',
  'Page de gestion des services et tarifs du salon',
  'Interface de reservation en ligne vue client mobile',
  'Gestion des avis clients et reputation en ligne',
  'Configuration du telephone IA avec scenarios de reponse',
  'Suivi des workflows automatises et actions programmees',
  'Export comptable et rapports financiers detailles',
  'Page de gestion des disponibilites et conges',
  'Interface Sentinel de monitoring et alertes en temps reel',
  'Page de parametrage general avec personnalisation du compte',
]

const SCREENSHOTS = Array.from({ length: 19 }, (_, i) => ({
  id: i + 1,
  src: `/gallery/screenshot-${String(i + 1).padStart(2, '0')}.png`,
  webp: `/gallery/screenshot-${String(i + 1).padStart(2, '0')}.webp`,
  alt: SCREENSHOT_ALTS[i] || `Capture d'ecran de l'interface NEXUS - fonctionnalite ${i + 1}`
}))

export default function GallerySlideshow() {
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
              <span className="text-xs text-gray-500">app.nexus-ai-saas.com</span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="relative bg-dark-950 rounded-xl overflow-hidden aspect-[16/9]">
            {/* Images - only load current, previous and next for performance */}
            <div className="relative w-full h-full flex items-center justify-center">
              {SCREENSHOTS.map((screenshot, index) => {
                const shouldLoad = Math.abs(index - currentIndex) <= 1 ||
                  (currentIndex === 0 && index === SCREENSHOTS.length - 1) ||
                  (currentIndex === SCREENSHOTS.length - 1 && index === 0)
                return (
                  <picture
                    key={screenshot.id}
                    className={clsx(
                      'absolute inset-0 w-full h-full transition-opacity duration-700',
                      index === currentIndex ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {shouldLoad && <source srcSet={screenshot.webp} type="image/webp" />}
                    <img
                      src={shouldLoad ? screenshot.src : undefined}
                      alt={screenshot.alt}
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </picture>
                )
              })}
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
