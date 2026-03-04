import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, Sparkles, Heart, MessageCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-config';

interface Testimonial {
  id: number;
  name: string;
  initials: string;
  service: string;
  rating: number;
  comment: string;
  color: string;
  date: string;
  location: string;
}

const fallbackTestimonials: Testimonial[] = [
  {
    id: 1,
    name: "Aminata D.",
    initials: "AD",
    service: "Création de locks",
    rating: 5,
    comment: "Fatou est une vraie artiste ! Mes locks sont magnifiques, exactement ce que je voulais. Elle a pris le temps de m'expliquer l'entretien. Je recommande à 100% !",
    color: "from-amber-500 to-orange-500",
    date: "Décembre 2025",
    location: "Franconville"
  },
  {
    id: 2,
    name: "Fatima K.",
    initials: "FK",
    service: "Braids avec rajouts",
    rating: 5,
    comment: "Service impeccable à domicile. Fatou est venue chez moi, super ponctuelle et professionnelle. Mes tresses sont parfaites et ont tenu plus de 2 mois !",
    color: "from-pink-500 to-rose-500",
    date: "Janvier 2026",
    location: "Argenteuil"
  },
  {
    id: 3,
    name: "Marie-Claire T.",
    initials: "MT",
    service: "Soin hydratant",
    rating: 5,
    comment: "Mes cheveux étaient très abîmés après des années de défrisage. Après 3 séances de soins avec Fatou, ils ont retrouvé leur vitalité. Merci infiniment !",
    color: "from-emerald-500 to-teal-500",
    date: "Novembre 2025",
    location: "Ermont"
  },
  {
    id: 4,
    name: "Awa S.",
    initials: "AS",
    service: "Nattes collées",
    rating: 5,
    comment: "J'ai réservé via Halimah, c'était super simple ! Fatou est douce avec les enfants, ma fille de 8 ans était ravie de ses nattes pour la rentrée.",
    color: "from-violet-500 to-purple-500",
    date: "Septembre 2025",
    location: "Sannois"
  },
  {
    id: 5,
    name: "Christelle M.",
    initials: "CM",
    service: "Microlocks twist",
    rating: 5,
    comment: "25 ans d'expérience, ça se sent ! Fatou connaît parfaitement le cheveu afro. Ses conseils sont précieux et le résultat toujours au top.",
    color: "from-cyan-500 to-blue-500",
    date: "Octobre 2025",
    location: "Cergy"
  },
  {
    id: 6,
    name: "Bintou N.",
    initials: "BN",
    service: "Entretien locks",
    rating: 5,
    comment: "Cela fait 3 ans que Fatou entretient mes locks. Elle est toujours à l'écoute et donne de super conseils. Une professionnelle au grand cœur !",
    color: "from-amber-600 to-yellow-500",
    date: "Janvier 2026",
    location: "Saint-Denis"
  }
];

const gradientColors = [
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-emerald-500 to-teal-500",
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-amber-600 to-yellow-500",
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatReviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials);
  const [averageRating, setAverageRating] = useState("5/5");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    apiFetch('/api/reviews')
      .then(r => r.json())
      .then(data => {
        if (data.reviews && data.reviews.length > 0) {
          const mapped: Testimonial[] = data.reviews
            .filter((r: any) => r.comment)
            .map((r: any, i: number) => ({
              id: r.id,
              name: r.client_prenom,
              initials: getInitials(r.client_prenom),
              service: "",
              rating: r.rating,
              comment: r.comment,
              color: gradientColors[i % gradientColors.length],
              date: formatReviewDate(r.created_at),
              location: "",
            }));
          if (mapped.length > 0) {
            setTestimonials(mapped);
          }
          if (data.stats?.moyenne) {
            setAverageRating(`${data.stats.moyenne}/5`);
          }
        }
      })
      .catch(() => {});
  }, []);

  const stats = [
    { value: "500+", label: "Clientes satisfaites" },
    { value: "25", label: "Années d'expérience" },
    { value: averageRating, label: "Note moyenne" },
    { value: "98%", label: "Recommandent" }
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      handleNext();
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, currentIndex]);

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAutoPlaying(false);
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const goToSlide = (index: number) => {
    if (isAnimating || index === currentIndex) return;
    setIsAutoPlaying(false);
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="relative py-24 bg-zinc-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 african-pattern opacity-5" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

      {/* Floating icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] animate-float-slow opacity-10">
          <Quote className="h-20 w-20 text-amber-500" />
        </div>
        <div className="absolute top-40 right-[15%] animate-float-medium opacity-10">
          <Star className="h-16 w-16 text-amber-500" />
        </div>
        <div className="absolute bottom-32 left-[20%] animate-float-fast opacity-10">
          <Heart className="h-14 w-14 text-amber-500" />
        </div>
        <div className="absolute bottom-20 right-[10%] animate-float-slow opacity-10">
          <MessageCircle className="h-18 w-18 text-amber-500" />
        </div>
      </div>

      {/* Letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-amber-300 text-sm font-medium">Témoignages</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">Ce que disent nos </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
              clientes
            </span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Plus de 500 clientes satisfaites depuis 25 ans. Découvrez leurs avis.
          </p>
        </div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-4xl mx-auto">
          {/* Main Card */}
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 overflow-hidden">
            {/* Quote decoration */}
            <div className="absolute top-6 right-6 opacity-10">
              <Quote className="w-24 h-24 text-amber-500" />
            </div>

            {/* Content */}
            <div className={`flex flex-col items-center text-center transition-all duration-500 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
              {/* Avatar with initials */}
              <div className="relative mb-6">
                <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 to-orange-500/30 rounded-full blur-xl" />
                <div className={`relative w-20 h-20 bg-gradient-to-br ${currentTestimonial.color} rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20`}>
                  <span className="text-2xl font-bold text-white">{currentTestimonial.initials}</span>
                </div>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-6 h-6 transition-all duration-300 ${
                      i < currentTestimonial.rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-white/20'
                    }`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>

              {/* Comment */}
              <blockquote className="text-xl md:text-2xl text-white/90 leading-relaxed mb-8 font-light">
                "{currentTestimonial.comment}"
              </blockquote>

              {/* Author info */}
              <div>
                <p className="font-semibold text-white text-lg">{currentTestimonial.name}</p>
                {currentTestimonial.service && <p className="text-amber-400 text-sm font-medium">{currentTestimonial.service}</p>}
                <p className="text-white/40 text-xs mt-2">
                  {[currentTestimonial.location, currentTestimonial.date].filter(Boolean).join(' • ')}
                </p>
              </div>
            </div>

            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-amber-500/30 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-amber-500/30 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-amber-500/30 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-amber-500/30 rounded-br-lg" />
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={handlePrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-12 h-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300"
            aria-label="Témoignage précédent"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => { setIsAutoPlaying(false); handleNext(); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-12 h-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300"
            aria-label="Témoignage suivant"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  index === currentIndex
                    ? 'w-8 bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Aller au témoignage ${index + 1}`}
              />
            ))}
          </div>

          {/* Thumbnail preview */}
          <div className="hidden md:flex items-center justify-center gap-3 mt-8">
            {testimonials.map((testimonial, index) => (
              <button
                key={testimonial.id}
                onClick={() => goToSlide(index)}
                className={`relative w-10 h-10 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'scale-110 ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-950'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                <div className={`w-full h-full bg-gradient-to-br ${testimonial.color} rounded-full flex items-center justify-center`}>
                  <span className="text-xs font-bold text-white">{testimonial.initials}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500"
            >
              <p className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-2">
                {stat.value}
              </p>
              <p className="text-white/60 text-sm">{stat.label}</p>

              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
            </div>
          ))}
        </div>

        {/* Decorative bottom line */}
        <div className="mt-16 flex items-center justify-center gap-4">
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/50" />
          <Sparkles className="h-5 w-5 text-amber-500/50" />
          <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/50" />
        </div>
      </div>

      {/* Corner frames */}
      <div className="absolute top-10 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
      <div className="absolute top-10 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
      <div className="absolute bottom-10 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
      <div className="absolute bottom-10 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />
    </section>
  );
}
