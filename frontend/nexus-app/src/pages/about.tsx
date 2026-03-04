import { Link } from "wouter";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import ServiceArea from "@/components/ServiceArea";
import Testimonials from "@/components/Testimonials";
import {
  Heart,
  Award,
  Users,
  Sparkles,
  MapPin,
  Calendar,
  Star,
  Phone,
  MessageCircle,
  Quote,
  Clock,
  Scissors,
  Crown,
  Gem,
  CheckCircle2,
} from "lucide-react";

const values = [
  {
    icon: <Heart className="h-6 w-6" />,
    title: "Passion",
    description: "La coiffure afro est ma passion depuis toujours. Chaque cliente est unique et mérite une attention particulière.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: <Award className="h-6 w-6" />,
    title: "Excellence",
    description: "Je me forme continuellement aux nouvelles techniques pour vous offrir le meilleur service possible.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Écoute",
    description: "Votre satisfaction est ma priorité. Je prends le temps d'écouter vos envies et de vous conseiller.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Qualité",
    description: "J'utilise exclusivement des produits professionnels de haute qualité, adaptés aux cheveux afro.",
    color: "from-violet-500 to-purple-500",
  },
];

const milestones = [
  { year: "1999", event: "Premiers pas dans la coiffure à Abidjan, Côte d'Ivoire", icon: "🌍" },
  { year: "2010", event: "Arrivée à Paris et travail dans les salons afro d'Île-de-France", icon: "🗼" },
  { year: "2015", event: "Lancement de l'activité à domicile à Franconville", icon: "🏠" },
  { year: "2024", event: "Introduction de Halimah, assistante IA pour la réservation", icon: "🤖" },
];

const specialties = [
  { icon: "🔒", name: "Locks", desc: "Création & entretien" },
  { icon: "✨", name: "Tresses", desc: "Box braids & cornrows" },
  { icon: "💧", name: "Soins", desc: "Hydratation profonde" },
  { icon: "💨", name: "Brushing", desc: "Mise en forme" },
  { icon: "🎀", name: "Nattes", desc: "Avec ou sans rajout" },
  { icon: "🎨", name: "Coloration", desc: "Sans ammoniaque" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation />

      {/* ============================================
          HERO SECTION - Cinematic Style
          ============================================ */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        {/* Background Image Collage */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 grid grid-cols-3 opacity-20">
            <div className="relative overflow-hidden">
              <img src="/locks-entretien.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="relative overflow-hidden">
              <img src="/tresses-africaines.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="relative overflow-hidden">
              <img src="/soin-hydratant.jpg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-zinc-950" />
        </div>

        {/* African pattern overlay */}
        <div className="absolute inset-0 african-pattern opacity-5" />

        {/* Floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-32 left-[10%] animate-float-slow opacity-10">
            <Heart className="h-16 w-16 text-amber-500" />
          </div>
          <div className="absolute top-48 right-[15%] animate-float-medium opacity-10">
            <Award className="h-20 w-20 text-amber-500" />
          </div>
          <div className="absolute bottom-32 left-[20%] animate-float-fast opacity-10">
            <Sparkles className="h-14 w-14 text-amber-500" />
          </div>
          <div className="absolute bottom-48 right-[10%] animate-float-slow opacity-10">
            <Crown className="h-18 w-18 text-amber-500" />
          </div>
        </div>

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-black z-10" />

        {/* Corner frames */}
        <div className="absolute top-8 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
        <div className="absolute top-8 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pt-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Notre histoire</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="text-white">L'histoire de </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                Fatou
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              25 ans de passion pour sublimer les cheveux afro, d'Abidjan à Franconville.
              Une coiffeuse qui respecte et célèbre votre beauté naturelle.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          STORY SECTION - Mon Histoire
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 african-pattern opacity-5" />

        {/* Glow effects */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Photo */}
            <div className="lg:w-1/3 shrink-0">
              <div className="relative">
                {/* Animated ring */}
                <div className="absolute -inset-4 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-3xl animate-pulse" />
                <div className="absolute -inset-6 border-2 border-amber-500/20 rounded-3xl animate-spin-slow" />

                {/* Photo container */}
                <div className="relative w-72 h-72 lg:w-80 lg:h-80 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/20 border-2 border-amber-500/30">
                  <img
                    src="/fatou-portrait.jpg"
                    alt="Fatou - Coiffeuse afro"
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
                </div>

                {/* Badge */}
                <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-amber-500/30 font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  25 ans d'expérience
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="lg:w-2/3 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-4">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-300 text-sm font-medium">Mon parcours</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <span className="text-white">Fatou, </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    coiffeuse passionnée
                  </span>
                </h2>
              </div>

              <div className="text-white/70 space-y-4 text-lg">
                <p>
                  <strong className="text-amber-400">Passionnée depuis l'âge de 12 ans</strong>, j'ai grandi à Abidjan, en Côte d'Ivoire, où j'ai appris l'art de la coiffure africaine auprès des femmes de mon quartier.
                </p>

                <p>
                  Rapidement remarquée pour mon talent, j'ai travaillé dans plusieurs salons de la capitale ivoirienne avant de m'installer en <strong className="text-amber-400">France en 2010</strong>. J'ai exercé dans différents salons de coiffure afro de Paris et d'Île-de-France.
                </p>

                <p>
                  Aujourd'hui, j'ai la chance d'avoir des <strong className="text-amber-400">clients fidèles</strong> qui me font confiance depuis des années. Je vous accueille chez moi à Franconville ou je me déplace chez vous en Île-de-France pour sublimer vos cheveux.
                </p>
              </div>

              {/* Quote */}
              <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <Quote className="absolute top-4 left-4 h-8 w-8 text-amber-500/30" />
                <p className="text-amber-200/90 font-medium italic pl-8">
                  Je refuse de pratiquer le défrisage car je le considère nocif pour la santé des cheveux afro. Je privilégie des techniques qui respectent et mettent en valeur votre beauté naturelle.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6">
                {[
                  { value: "25", label: "ans d'expérience" },
                  { value: "500+", label: "clientes satisfaites" },
                  { value: "IDF", label: "zone couverte" },
                ].map((stat, index) => (
                  <div key={index} className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <span className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                      {stat.value}
                    </span>
                    <p className="text-sm text-white/50 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          VALUES SECTION - Cinematic Cards
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-black" />
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-black" />

        {/* Floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[5%] animate-float-slow opacity-10">
            <Gem className="h-12 w-12 text-amber-500" />
          </div>
          <div className="absolute bottom-20 right-[8%] animate-float-medium opacity-10">
            <Star className="h-14 w-14 text-amber-500" />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Heart className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Ma philosophie</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">Mes </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                valeurs
              </span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Ce qui me guide au quotidien dans mon métier de coiffeuse
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div
                key={value.title}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500 hover:-translate-y-2"
              >
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${value.color} rounded-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <div className="text-white">{value.icon}</div>
                </div>

                <h3 className="text-lg font-semibold mb-2 text-white">
                  {value.title}
                </h3>
                <p className="text-sm text-white/60">
                  {value.description}
                </p>

                {/* Corner accents */}
                <div className="absolute top-3 right-3 w-6 h-6 border-t border-r border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-bl-lg" />

                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-orange-500/0 group-hover:from-amber-500/5 group-hover:to-orange-500/5 transition-all duration-500 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          TIMELINE SECTION - Cinematic
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 african-pattern opacity-5" />

        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Mon chemin</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">Mon </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                parcours
              </span>
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/50 via-amber-500 to-amber-500/50 transform md:-translate-x-1/2" />

            {/* Timeline items */}
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`relative flex items-center ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-6 md:left-1/2 w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center transform -translate-x-1/2 shadow-lg shadow-amber-500/30 z-10 border-4 border-zinc-950">
                    <span className="text-xl">{milestone.icon}</span>
                  </div>

                  {/* Content */}
                  <div className={`ml-20 md:ml-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-16' : 'md:pl-16'}`}>
                    <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300">
                      <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-bold rounded-full mb-3">
                        {milestone.year}
                      </span>
                      <p className="text-white/80">
                        {milestone.event}
                      </p>

                      {/* Corner accents on hover */}
                      <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-tr" />
                      <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-bl" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          SPECIALTIES SECTION - Cinematic Grid
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 african-pattern opacity-5" />

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-black" />
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-black" />

        {/* Glow effects */}
        <div className="absolute top-1/3 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

        {/* Floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-24 right-[12%] animate-float-slow opacity-10">
            <Scissors className="h-16 w-16 text-amber-500" />
          </div>
          <div className="absolute bottom-24 left-[8%] animate-float-medium opacity-10">
            <Sparkles className="h-14 w-14 text-amber-500" />
          </div>
        </div>

        {/* Corner frames */}
        <div className="absolute top-8 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
        <div className="absolute top-8 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
        <div className="absolute bottom-8 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
        <div className="absolute bottom-8 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Scissors className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Expertise</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">Mes </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                spécialités
              </span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Des techniques maîtrisées pour sublimer tous les types de cheveux afro
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specialties.map((specialty, index) => (
              <div
                key={specialty.name}
                className="group bg-white/5 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-2"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-3xl group-hover:scale-110 group-hover:from-amber-500/30 group-hover:to-orange-500/30 transition-all duration-300 border border-amber-500/20">
                  {specialty.icon}
                </div>
                <p className="font-semibold text-white mb-1">{specialty.name}</p>
                <p className="text-xs text-white/50">{specialty.desc}</p>

                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-orange-500/0 group-hover:from-amber-500/5 group-hover:to-orange-500/5 transition-all duration-500 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Already cinematic */}
      <Testimonials />

      {/* Zone d'intervention - Already cinematic */}
      <ServiceArea />

      {/* ============================================
          CTA SECTION - Cinematic
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-500/10 rounded-full blur-3xl" />

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black" />

        {/* Corner frames */}
        <div className="absolute top-10 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
        <div className="absolute top-10 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
        <div className="absolute bottom-10 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
        <div className="absolute bottom-10 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6">
          {/* Glass card */}
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-amber-500/50 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-amber-500/50 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-amber-500/50 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-amber-500/50 rounded-br-lg" />

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Prête à me rencontrer ?</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="text-white">Réservez votre </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                premier rendez-vous
              </span>
            </h2>

            <p className="text-white/70 mb-8 max-w-xl mx-auto text-lg">
              Discutez avec Halimah, mon assistante virtuelle, pour trouver le créneau idéal.
              Je serai ravie de sublimer vos cheveux !
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/reserver">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30 px-8 h-12"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Discuter avec Halimah
                </Button>
              </Link>
              <a href="tel:+33939240269">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-amber-500/30 h-12"
                >
                  <Phone className="mr-2 h-5 w-5" />
                  09 39 24 02 69
                </Button>
              </a>
            </div>
          </div>

          {/* Decorative bottom line */}
          <div className="mt-12 flex items-center justify-center gap-4">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/50" />
            <Sparkles className="h-5 w-5 text-amber-500/50" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
