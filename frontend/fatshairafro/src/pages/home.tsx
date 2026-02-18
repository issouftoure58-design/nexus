import { Link } from "wouter";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import Testimonials from "@/components/Testimonials";
import Gallery from "@/components/Gallery";
import ServiceArea from "@/components/ServiceArea";
import PricingTable from "@/components/PricingTable";
import HeroSpot from "@/components/HeroSpot";
import {
  Sparkles,
  Clock,
  Calendar,
  Star,
  MapPin,
  Phone,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Heart,
  Award,
  Home,
} from "lucide-react";

// Catégories de services (liens vers les sections tarifs)
const featuredServices = [
  {
    icon: "🔒",
    name: "Locks & Dreadlocks",
    description: "Création crochet, microlocks, entretien des racines",
    price: "À partir de 50€",
    gradient: "from-amber-500 to-orange-500",
    image: "/gallery/creation-locks.jpg",
    anchor: "locks", // Ancre vers la section tarifs
  },
  {
    icon: "✨",
    name: "Tresses & Braids",
    description: "Box braids, nattes collées avec ou sans rajouts",
    price: "À partir de 20€",
    gradient: "from-amber-600 to-amber-500",
    image: "/gallery/braids-service.jpg",
    anchor: "tresses",
  },
  {
    icon: "💧",
    name: "Soins Capillaires",
    description: "Soins complets et hydratants pour cheveux afro",
    price: "À partir de 40€",
    gradient: "from-emerald-500 to-teal-500",
    image: "/gallery/soin-complet.jpg",
    anchor: "soins",
  },
  {
    icon: "🎨",
    name: "Coloration & Coiffure",
    description: "Brushing afro, teinture naturelle, décoloration",
    price: "À partir de 20€",
    gradient: "from-violet-500 to-purple-500",
    image: "/gallery/coloration-naturelle.jpg",
    anchor: "coloration",
  },
];

const whyChooseUs = [
  {
    icon: <Award className="h-6 w-6" />,
    title: "25 ans d'expérience",
    description: "Fatou coiffe depuis l'âge de 12 ans. D'Abidjan à Paris, elle a perfectionné son art.",
  },
  {
    icon: <Home className="h-6 w-6" />,
    title: "Chez moi à Franconville",
    description: "Je vous reçois à mon domicile à Franconville. Reprise des déplacements dès que possible.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Horaires flexibles",
    description: "Disponible en soirée et le week-end. On s'adapte à votre emploi du temps.",
  },
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: "Halimah, votre assistante",
    description: "Réservez 24h/24. Frais de déplacement calculés automatiquement.",
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: "Respect du cheveu naturel",
    description: "Techniques douces, pas de défrisage. On sublime votre beauté naturelle.",
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    title: "Tarifs transparents",
    description: "Gratuit chez Fatou à Franconville. Frais de déplacement à venir quand les déplacements reprendront.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Spot Animé */}
      <HeroSpot />

      {/* Bandeau info temporaire - problème véhicule */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-7xl mx-auto mt-6 mb-2 rounded-r-lg">
        <p className="text-sm text-yellow-700">
          <strong>Info temporaire :</strong> En raison d'un problème de véhicule,
          je reçois actuellement à mon domicile à Franconville.
          Je reprendrai les déplacements dès que possible.
        </p>
      </div>

      {/* Featured Services */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
              Nos spécialités
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900">
              Des services <span className="text-amber-600">sur mesure</span>
            </h2>
            <p className="text-zinc-600 max-w-2xl mx-auto">
              Chaque chevelure est unique. Fatou adapte ses techniques à vos besoins.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredServices.map((service) => (
              <Link key={service.name} href={`/services#${service.anchor}`}>
                <div className="group relative bg-white rounded-2xl border border-amber-100 overflow-hidden hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-200 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                  {/* Image */}
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {/* Icon badge */}
                    <div className={`absolute bottom-3 left-3 w-10 h-10 bg-gradient-to-br ${service.gradient} rounded-xl flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {service.icon}
                    </div>
                    {/* Flèche au survol */}
                    <div className="absolute bottom-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ArrowRight className="h-4 w-4 text-amber-600" />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold mb-2 text-zinc-900 group-hover:text-amber-600 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-sm text-zinc-600 mb-3">
                      {service.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-amber-600">
                        {service.price}
                      </p>
                      <span className="text-xs text-zinc-400 group-hover:text-amber-500 transition-colors">
                        Voir les prestations →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <Button variant="outline" size="lg" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Voir tous les tarifs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us - Cinematic Style */}
      <section className="relative py-24 bg-zinc-950 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

        {/* Floating icons in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large floating icons */}
          <div className="absolute top-20 left-[10%] animate-float-slow opacity-10">
            <Award className="h-24 w-24 text-amber-500" />
          </div>
          <div className="absolute top-40 right-[15%] animate-float-medium opacity-10">
            <Heart className="h-20 w-20 text-amber-500" />
          </div>
          <div className="absolute bottom-32 left-[20%] animate-float-fast opacity-10">
            <Clock className="h-16 w-16 text-amber-500" />
          </div>
          <div className="absolute bottom-20 right-[10%] animate-float-slow opacity-10">
            <Home className="h-28 w-28 text-amber-500" />
          </div>
          <div className="absolute top-1/2 left-[5%] animate-float-medium opacity-10">
            <MessageCircle className="h-14 w-14 text-amber-500" />
          </div>
          <div className="absolute top-1/3 right-[8%] animate-float-fast opacity-10">
            <CheckCircle2 className="h-18 w-18 text-amber-500" />
          </div>
        </div>

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Pourquoi Fatou ?</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">L'excellence </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                africaine
              </span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto text-lg">
              Un savoir-faire authentique transmis de génération en génération
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, index) => (
              <div
                key={item.title}
                className="group relative"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Card */}
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500 hover:-translate-y-2">
                  {/* Floating icon */}
                  <div className="relative mb-6">
                    <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                      <div className="text-white group-hover:animate-pulse">
                        {item.icon}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-amber-400 transition-colors duration-300">
                    {item.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {item.description}
                  </p>

                  {/* Corner decoration */}
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/0 group-hover:border-amber-500/50 rounded-tr-lg transition-all duration-500" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/0 group-hover:border-amber-500/50 rounded-bl-lg transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>

          {/* Decorative bottom line */}
          <div className="mt-16 flex items-center justify-center gap-4">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/50" />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>
        </div>

        {/* Corner frames */}
        <div className="absolute top-10 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
        <div className="absolute top-10 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
        <div className="absolute bottom-10 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
        <div className="absolute bottom-10 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />
      </section>

      {/* Halimah CTA - Cinematic Style */}
      <section className="relative py-24 bg-zinc-950 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl" />

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10" />

        {/* Floating chat bubbles in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] animate-float-slow opacity-20">
            <MessageCircle className="h-16 w-16 text-amber-500" />
          </div>
          <div className="absolute top-32 right-[20%] animate-float-medium opacity-15">
            <Phone className="h-12 w-12 text-amber-500" />
          </div>
          <div className="absolute bottom-32 left-[25%] animate-float-fast opacity-20">
            <Calendar className="h-14 w-14 text-amber-500" />
          </div>
          <div className="absolute bottom-24 right-[15%] animate-float-slow opacity-15">
            <Star className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Avatar animé - Halimah qui fait coucou */}
            <div className="relative shrink-0 order-1 lg:order-2">
              {/* Glow effect behind avatar */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur-3xl opacity-30 scale-110" />

              {/* Main avatar container */}
              <div className="relative">
                {/* Outer ring - animated */}
                <div className="absolute -inset-4 rounded-full border-2 border-amber-500/30 animate-spin-slow" />
                <div className="absolute -inset-8 rounded-full border border-amber-500/20" />

                {/* Avatar circle */}
                <div className="relative w-48 h-48 md:w-56 md:h-56 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30">
                  {/* Inner glow */}
                  <div className="absolute inset-2 bg-gradient-to-br from-white/20 to-transparent rounded-full" />

                  {/* Character */}
                  <div className="relative flex flex-col items-center">
                    <span className="text-7xl md:text-8xl">👩🏾‍🦱</span>
                    {/* Waving hand */}
                    <div className="absolute -right-2 top-2 animate-wave origin-bottom-left">
                      <span className="text-4xl md:text-5xl">👋🏾</span>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900 border border-amber-500/50 rounded-full flex items-center gap-2 shadow-lg">
                  <span className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-white text-sm font-medium">En ligne</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center lg:text-left order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 text-sm font-medium">Assistante IA</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="text-white">Bonjour, je suis </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                  Halimah
                </span>
                <span className="inline-block animate-wave-text ml-2">👋</span>
              </h2>

              <p className="text-white/70 text-lg mb-8 max-w-xl">
                Votre assistante beauté disponible <span className="text-amber-400 font-semibold">24h/24</span>.
                Je connais tous les services, tarifs et disponibilités de Fatou.
                Discutons pour trouver votre créneau idéal !
              </p>

              {/* Features */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-8">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-white/80 text-sm">Réponse instantanée</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-white/80 text-sm">Calcul des frais automatique</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-white/80 text-sm">Confirmation SMS</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/reserver">
                  <Button
                    size="lg"
                    className="group relative px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-lg rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Discuter avec Halimah
                  </Button>
                </Link>
                <a href="https://wa.me/18302894929" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="px-8 py-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full text-lg"
                  >
                    <Phone className="mr-2 h-5 w-5" />
                    WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Corner frames */}
        <div className="absolute top-10 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
        <div className="absolute top-10 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
        <div className="absolute bottom-10 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
        <div className="absolute bottom-10 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Gallery Preview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
              Galerie
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900">
              Nos <span className="text-amber-600">réalisations</span>
            </h2>
            <p className="text-zinc-600 max-w-2xl mx-auto">
              Découvrez quelques-unes de nos créations. Chaque coiffure est unique et personnalisée.
            </p>
          </div>
          <Gallery maxImages={8} showFilters={false} showHeader={false} lightMode={true} />
          <div className="text-center mt-10">
            <Link href="/galerie">
              <Button size="lg" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Voir toutes nos réalisations
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <PricingTable />

      {/* Zone d'intervention */}
      <ServiceArea />

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-white to-amber-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
            Prête à vous sublimer ?
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900">
            Réservez votre <span className="text-amber-600">rendez-vous</span>
          </h2>
          <p className="text-zinc-600 mb-8 max-w-2xl mx-auto">
            Venez chez Fatou à Franconville.
            Chaque cliente est unique, chaque coiffure est une œuvre d'art.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/reserver">
              <Button size="lg" className="btn-african px-10">
                <Calendar className="mr-2 h-5 w-5" />
                Réserver maintenant
              </Button>
            </Link>
            <a href="tel:+33939240269">
              <Button size="lg" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <Phone className="mr-2 h-5 w-5" />
                09 39 24 02 69
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
