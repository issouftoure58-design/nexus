import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Calendar, Play, Pause } from 'lucide-react';

const slides = [
  {
    image: '/gallery/creation-locks.jpg',
    title: 'Locks',
    subtitle: 'L\'art du crochet',
  },
  {
    image: '/gallery/braids-service.jpg',
    title: 'Tresses',
    subtitle: 'Élégance africaine',
  },
  {
    image: '/gallery/nattes-service.jpg',
    title: 'Nattes',
    subtitle: 'Tradition & style',
  },
  {
    image: '/gallery/soin-complet.jpg',
    title: 'Soins',
    subtitle: 'Beauté naturelle',
  },
];

const taglines = [
  "25 ans de savoir-faire",
  "Chez vous ou chez Fatou à Franconville",
  "Sublimez votre beauté naturelle",
];

export default function HeroSpot() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTagline, setCurrentTagline] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Delay content appearance for cinematic effect
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);

    const taglineInterval = setInterval(() => {
      setCurrentTagline((prev) => (prev + 1) % taglines.length);
    }, 3000);

    return () => {
      clearInterval(slideInterval);
      clearInterval(taglineInterval);
    };
  }, [isPlaying]);

  return (
    <section className="relative h-[85vh] min-h-[600px] max-h-[900px] overflow-hidden bg-black">
      {/* Cinematic letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-black z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-black z-20" />

      {/* Background slides with Ken Burns effect */}
      {slides.map((slide, index) => (
        <div
          key={slide.image}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className={`w-full h-full object-cover ${
              index === currentSlide ? 'animate-ken-burns' : ''
            }`}
          />
          {/* Overlay gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        </div>
      ))}

      {/* Animated particles */}
      <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/40 rounded-full animate-float-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className={`relative z-10 h-full flex flex-col justify-center px-6 md:px-12 lg:px-20 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-4xl">
          {/* Animated badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6 animate-fade-in-up">
            <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-300 text-sm font-medium tracking-wide">
              Fat's Hair-Afro
            </span>
          </div>

          {/* Main title with stagger animation */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 overflow-hidden">
            <span className="block text-white animate-slide-in-left" style={{ animationDelay: '0.2s' }}>
              L'excellence
            </span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 animate-slide-in-left" style={{ animationDelay: '0.4s' }}>
              Africaine
            </span>
          </h1>

          {/* Current service highlight */}
          <div className="mb-6 h-20 overflow-hidden">
            {slides.map((slide, index) => (
              <div
                key={slide.title}
                className={`transition-all duration-700 ${
                  index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-full absolute'
                }`}
              >
                <p className="text-3xl md:text-4xl font-light text-white/90">
                  {slide.title}
                  <span className="text-amber-400 mx-3">—</span>
                  <span className="text-amber-300">{slide.subtitle}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Animated tagline */}
          <div className="h-8 mb-8 overflow-hidden">
            {taglines.map((tagline, index) => (
              <p
                key={tagline}
                className={`text-lg text-white/70 transition-all duration-500 ${
                  index === currentTagline
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-full absolute'
                }`}
              >
                {tagline}
              </p>
            ))}
          </div>

          {/* CTA Button with glow effect */}
          <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <Link href="/reserver">
              <Button
                size="lg"
                className="group relative px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-lg rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Calendar className="mr-2 h-5 w-5" />
                Réserver maintenant
              </Button>
            </Link>
          </div>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-20 left-6 md:left-12 lg:left-20 flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-white" />
            ) : (
              <Play className="h-4 w-4 text-white" />
            )}
          </button>
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-8 bg-amber-500'
                    : 'w-4 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Service name overlay (bottom right) */}
        <div className="absolute bottom-20 right-6 md:right-12 lg:right-20 text-right">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Service</p>
          <p className="text-xl font-semibold text-white">
            {slides[currentSlide].title}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-12 left-0 right-0 h-0.5 bg-white/10 z-20">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Decorative corner elements */}
      <div className="absolute top-16 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30 z-10" />
      <div className="absolute top-16 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30 z-10" />
      <div className="absolute bottom-16 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30 z-10" />
      <div className="absolute bottom-16 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30 z-10" />
    </section>
  );
}
