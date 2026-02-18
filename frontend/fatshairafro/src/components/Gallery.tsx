import { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Play, Sparkles } from 'lucide-react';
import galleryData from '@/data/gallery.json';

interface GalleryItem {
  id: number;
  src: string;
  alt: string;
  category: string;
  type?: 'image' | 'video';
  videoSrc?: string;
}

type Category = 'all' | 'locks' | 'tresses' | 'soins' | 'coiffure';

interface GalleryProps {
  maxImages?: number;
  showFilters?: boolean;
  showHeader?: boolean;
  cinematicStyle?: boolean;
  lightMode?: boolean;
}

const categoryImages: Record<string, string> = {
  locks: '/gallery/creation-locks.jpg',
  tresses: '/gallery/braids-service.jpg',
  soins: '/gallery/soin-complet.jpg',
  coiffure: '/gallery/coloration-naturelle.jpg',
};

const categoryDescriptions: Record<string, string> = {
  all: 'Toutes nos créations',
  locks: 'Locks, microlocks et dreadlocks',
  tresses: 'Box braids, nattes collées, cornrows',
  soins: 'Soins capillaires et hydratation',
  coiffure: 'Brushing, coloration et plus',
};

export default function Gallery({ maxImages, showFilters = true, showHeader = true, cinematicStyle = true, lightMode = false }: GalleryProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const categories: { value: Category; label: string; icon: string }[] = [
    { value: 'all', label: 'Tout voir', icon: '✨' },
    { value: 'locks', label: 'Locks', icon: '🔒' },
    { value: 'tresses', label: 'Tresses', icon: '💫' },
    { value: 'soins', label: 'Soins', icon: '💧' },
    { value: 'coiffure', label: 'Coiffure', icon: '🎨' }
  ];

  const galleryItems: GalleryItem[] = useMemo(() => {
    return galleryData.map(item => ({
      id: item.id,
      src: item.src,
      alt: item.alt,
      category: item.category,
      type: (item as GalleryItem).type || 'image',
      videoSrc: (item as GalleryItem).videoSrc
    }));
  }, []);

  const filteredItems = useMemo(() => {
    let items = activeCategory === 'all'
      ? galleryItems
      : galleryItems.filter(item => item.category === activeCategory);

    if (maxImages && maxImages > 0) {
      items = items.slice(0, maxImages);
    }

    return items;
  }, [activeCategory, galleryItems, maxImages]);

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) =>
      (prev - 1 + filteredItems.length) % filteredItems.length
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) =>
      (prev + 1) % filteredItems.length
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  return (
    <section className="relative overflow-hidden">
      {/* Cinematic Header */}
      {showHeader && cinematicStyle && (
        <div className="relative h-[40vh] min-h-[300px] bg-black overflow-hidden">
          {/* Letterbox bars */}
          <div className="absolute top-0 left-0 right-0 h-6 bg-black z-20" />
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-20" />

          {/* Background collage */}
          <div className="absolute inset-0 grid grid-cols-4">
            {Object.entries(categoryImages).map(([key, src], index) => (
              <div key={key} className="relative overflow-hidden">
                <img
                  src={src}
                  alt={key}
                  className={`w-full h-full object-cover transition-all duration-1000 ${
                    isLoaded ? 'scale-100 opacity-60' : 'scale-110 opacity-0'
                  }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                />
              </div>
            ))}
          </div>

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50 z-10" />

          {/* Content */}
          <div className={`relative z-10 h-full flex flex-col items-center justify-center text-center px-4 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-4">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Portfolio</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="text-white">Nos </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                Réalisations
              </span>
            </h2>
            <p className="text-white/70 max-w-xl text-lg">
              Chaque coiffure raconte une histoire. Découvrez l'art de Fatou.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">{galleryItems.filter(i => i.type !== 'video').length}</p>
                <p className="text-white/50 text-sm">Photos</p>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">{galleryItems.filter(i => i.type === 'video').length}</p>
                <p className="text-white/50 text-sm">Vidéos</p>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">4</p>
                <p className="text-white/50 text-sm">Catégories</p>
              </div>
            </div>
          </div>

          {/* Decorative corners */}
          <div className="absolute top-10 left-6 w-12 h-12 border-l-2 border-t-2 border-amber-500/40 z-20" />
          <div className="absolute top-10 right-6 w-12 h-12 border-r-2 border-t-2 border-amber-500/40 z-20" />
          <div className="absolute bottom-10 left-6 w-12 h-12 border-l-2 border-b-2 border-amber-500/40 z-20" />
          <div className="absolute bottom-10 right-6 w-12 h-12 border-r-2 border-b-2 border-amber-500/40 z-20" />
        </div>
      )}

      {/* Simple Header (when not cinematic) */}
      {showHeader && !cinematicStyle && (
        <div className="text-center py-12 bg-white">
          <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
            Galerie
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            Nos <span className="text-amber-600">réalisations</span>
          </h2>
          <p className="text-zinc-600 max-w-2xl mx-auto">
            Découvrez quelques-unes de nos créations. Chaque coiffure est unique et personnalisée.
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className={`py-12 ${lightMode ? 'bg-transparent' : 'bg-zinc-950'}`}>
        <div className={`${showHeader || showFilters ? 'max-w-7xl mx-auto px-4 md:px-6' : ''}`}>
          {/* Category filters - Cinematic style */}
          {showFilters && (
            <div className="mb-12">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {categories.map((cat, index) => (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`group relative px-6 py-3 rounded-xl text-sm font-medium transition-all duration-500 overflow-hidden ${
                      lightMode
                        ? activeCategory === cat.value
                          ? 'text-white'
                          : 'text-zinc-600 hover:text-zinc-900'
                        : activeCategory === cat.value
                          ? 'text-white'
                          : 'text-white/60 hover:text-white'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Background */}
                    <div className={`absolute inset-0 transition-all duration-500 ${
                      activeCategory === cat.value
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 opacity-100'
                        : lightMode
                          ? 'bg-zinc-100 opacity-100 group-hover:bg-zinc-200'
                          : 'bg-white/5 opacity-100 group-hover:bg-white/10'
                    }`} />

                    {/* Glow effect */}
                    {activeCategory === cat.value && (
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 blur-xl opacity-50" />
                    )}

                    {/* Content */}
                    <span className="relative flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Category description */}
              <p className={`text-center mt-4 text-sm ${lightMode ? 'text-zinc-500' : 'text-white/40'}`}>
                {categoryDescriptions[activeCategory]}
              </p>
            </div>
          )}

          {/* Gallery Grid - Bento style */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredItems.map((item, index) => {
              // Make some items larger for visual interest (only in full view)
              const isLarge = !lightMode && (index === 0 || index === 5);
              const isTall = !lightMode && (index === 2 || index === 7);

              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-2xl cursor-pointer ${lightMode ? 'bg-zinc-100' : 'bg-zinc-900'} ${
                    isLarge ? 'md:col-span-2 md:row-span-2' : ''
                  } ${isTall ? 'row-span-2' : ''}`}
                  onClick={() => openLightbox(index)}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Aspect ratio container */}
                  <div className={`relative ${isLarge ? 'aspect-square' : isTall ? 'aspect-[3/4]' : 'aspect-square'}`}>
                    <img
                      src={item.src}
                      alt={item.alt}
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                      loading="lazy"
                    />

                    {/* Video play indicator */}
                    {item.type === 'video' && (
                      <div className="absolute top-3 right-3 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center z-10">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">
                            {item.type === 'video' ? 'Vidéo' : 'Photo'} #{item.id}
                          </p>
                          <p className="text-amber-400 text-xs capitalize">{item.category}</p>
                        </div>
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                          {item.type === 'video' ? (
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          ) : (
                            <ZoomIn className="w-5 h-5 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Corner accents on hover */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-20">
              <p className={`text-lg ${lightMode ? 'text-zinc-500' : 'text-white/50'}`}>Aucun contenu dans cette catégorie.</p>
            </div>
          )}

          {/* Bottom decorative line - only in cinematic mode */}
          {!lightMode && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/50" />
              <Sparkles className="h-5 w-5 text-amber-500/50" />
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/50" />
            </div>
          )}
        </div>
      </div>

      {/* Cinematic Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Letterbox bars */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-black z-30 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <span className="text-amber-500 font-medium">Fat's Hair-Afro</span>
              <span className="text-white/30">|</span>
              <span className="text-white/50 text-sm">Galerie</span>
            </div>
            <button
              onClick={closeLightbox}
              className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-black z-30" />

          {/* Navigation */}
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 z-20"
            aria-label="Image précédente"
          >
            <ChevronLeft className="w-7 h-7 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 z-20"
            aria-label="Image suivante"
          >
            <ChevronRight className="w-7 h-7 text-white" />
          </button>

          {/* Content */}
          <div className="relative z-10 max-w-[85vw] max-h-[70vh]">
            {filteredItems[currentImageIndex]?.type === 'video' ? (
              <video
                src={filteredItems[currentImageIndex]?.videoSrc}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={filteredItems[currentImageIndex]?.src}
                alt={filteredItems[currentImageIndex]?.alt}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Bottom info bar */}
          <div className="absolute bottom-4 left-0 right-0 z-30 px-6">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-white font-medium">
                  {filteredItems[currentImageIndex]?.alt}
                </p>
                <p className="text-amber-400 text-sm capitalize">
                  {filteredItems[currentImageIndex]?.category}
                </p>
              </div>

              {/* Thumbnail navigation */}
              <div className="flex items-center gap-2">
                {filteredItems.slice(Math.max(0, currentImageIndex - 2), currentImageIndex + 3).map((item, idx) => {
                  const actualIndex = Math.max(0, currentImageIndex - 2) + idx;
                  return (
                    <button
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(actualIndex); }}
                      className={`w-12 h-12 rounded-lg overflow-hidden transition-all ${
                        actualIndex === currentImageIndex
                          ? 'ring-2 ring-amber-500 scale-110'
                          : 'opacity-50 hover:opacity-100'
                      }`}
                    >
                      <img src={item.src} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>

              <div className="text-right">
                <p className="text-white/50 text-sm">
                  {currentImageIndex + 1} / {filteredItems.length}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-40">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
              style={{ width: `${((currentImageIndex + 1) / filteredItems.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
