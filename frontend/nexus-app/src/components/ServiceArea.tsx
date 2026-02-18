import { MapPin, Phone, Car, Home, Clock, CheckCircle2, Sparkles, Heart, Calendar, Navigation, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

// Villes couvertes par zone
const zones = [
  {
    name: "Zone 1",
    label: "Proche",
    cities: ["Franconville", "Sannois", "Ermont", "Saint-Gratien", "Eaubonne"],
    color: "from-green-500 to-emerald-500",
    textColor: "text-green-400",
    distance: "0-5 km",
  },
  {
    name: "Zone 2",
    label: "Intermédiaire",
    cities: ["Argenteuil", "Cergy", "Pontoise", "Taverny", "Montigny-lès-Cormeilles"],
    color: "from-amber-500 to-orange-500",
    textColor: "text-amber-400",
    distance: "5-15 km",
  },
  {
    name: "Zone 3",
    label: "Étendue",
    cities: ["Saint-Denis", "Colombes", "Nanterre", "Asnières", "Gennevilliers"],
    color: "from-orange-500 to-red-500",
    textColor: "text-orange-400",
    distance: "15-25 km",
  },
];

// Avantages du service à domicile
const advantages = [
  {
    icon: <Home className="h-6 w-6" />,
    title: "Confort de chez vous",
    description: "Restez confortablement à la maison",
  },
  {
    icon: <Car className="h-6 w-6" />,
    title: "Pas de transport",
    description: "J'apporte tout le matériel nécessaire",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Horaires flexibles",
    description: "Soir et week-end disponibles",
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: "Ambiance détendue",
    description: "Dans votre environnement familier",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Service personnalisé",
    description: "Une attention 100% pour vous",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Tarifs transparents",
    description: "Frais calculés à l'avance",
  },
];

export default function ServiceArea() {
  return (
    <section className="relative py-24 bg-zinc-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 african-pattern opacity-5" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

      {/* Floating icons in background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[5%] animate-float-slow opacity-10">
          <Home className="h-20 w-20 text-amber-500" />
        </div>
        <div className="absolute top-40 right-[10%] animate-float-medium opacity-10">
          <Car className="h-24 w-24 text-amber-500" />
        </div>
        <div className="absolute bottom-40 left-[15%] animate-float-fast opacity-10">
          <MapPin className="h-16 w-16 text-amber-500" />
        </div>
        <div className="absolute bottom-20 right-[20%] animate-float-slow opacity-10">
          <Navigation className="h-18 w-18 text-amber-500" />
        </div>
        <div className="absolute top-1/2 left-[8%] animate-float-medium opacity-10">
          <Clock className="h-14 w-14 text-amber-500" />
        </div>
        <div className="absolute top-1/3 right-[5%] animate-float-fast opacity-10">
          <Heart className="h-12 w-12 text-amber-500" />
        </div>
      </div>

      {/* Letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
            <Car className="h-4 w-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">Zone d'intervention</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">Chez vous ou </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
              chez moi
            </span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Venez me voir à Franconville (sans frais supplémentaire) ou je me déplace chez vous en Île-de-France.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Zone Map Visual */}
          <div className="relative">
            <div className="relative h-[450px] flex items-center justify-center">
              {/* Animated rings */}
              <div className="absolute w-[380px] h-[380px] rounded-full border border-orange-500/20 animate-pulse" />
              <div className="absolute w-[300px] h-[300px] rounded-full border border-amber-500/30" />
              <div className="absolute w-[220px] h-[220px] rounded-full border border-green-500/40" />

              {/* Zone 3 - Outer */}
              <div className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/5 backdrop-blur-sm flex items-center justify-center">
                {/* Zone 2 - Middle */}
                <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/10 flex items-center justify-center">
                  {/* Zone 1 - Center */}
                  <div className="w-[170px] h-[170px] rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-2xl shadow-amber-500/40 flex items-center justify-center relative overflow-hidden">
                    {/* Inner glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                    <div className="text-center text-white relative z-10">
                      <MapPin className="w-10 h-10 mx-auto mb-2 drop-shadow-lg" />
                      <span className="text-lg font-bold">Franconville</span>
                      <span className="block text-xs text-white/80">Chez Fatou</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* City labels with animations */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-orange-500/30 text-sm font-medium text-orange-400 animate-float-slow">
                Saint-Denis • Colombes
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-amber-500/30 text-sm font-medium text-amber-400 animate-float-medium">
                Cergy • Pontoise
              </div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 px-4 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-amber-500/30 text-sm font-medium text-amber-400 animate-float-fast">
                Argenteuil
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 px-4 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-green-500/30 text-sm font-medium text-green-400 animate-float-slow">
                Ermont • Sannois
              </div>
            </div>
          </div>

          {/* Zones Info */}
          <div className="space-y-6">
            {zones.map((zone, index) => (
              <div
                key={zone.name}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500"
              >
                <div className="flex items-start gap-4">
                  {/* Zone indicator */}
                  <div className={`w-14 h-14 bg-gradient-to-br ${zone.color} rounded-xl flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-white font-bold text-lg">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-semibold ${zone.textColor}`}>
                        {zone.name} - {zone.label}
                      </h4>
                      <span className="text-white/40 text-sm">{zone.distance}</span>
                    </div>
                    <p className="text-white/60 text-sm">
                      {zone.cities.join(" • ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Option chez Fatou */}
            <div className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <Home className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-400 mb-1">Ou venez chez moi</h4>
                  <p className="text-white/60 text-sm mb-2">
                    Possibilité de vous coiffer à Franconville pour les prestations longues.
                  </p>
                  <span className="inline-flex items-center gap-1 text-green-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Pas de frais de déplacement !
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advantages Section with floating icons */}
        <div className="mt-24 relative">
          {/* Floating advantage icons in this section */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-[5%] animate-float-medium opacity-20">
              <Sparkles className="h-10 w-10 text-amber-500" />
            </div>
            <div className="absolute top-20 right-[8%] animate-float-slow opacity-20">
              <Heart className="h-12 w-12 text-amber-500" />
            </div>
            <div className="absolute bottom-10 left-[10%] animate-float-fast opacity-20">
              <CheckCircle2 className="h-8 w-8 text-amber-500" />
            </div>
          </div>

          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">Les avantages du </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                service à domicile
              </span>
            </h3>
            <p className="text-white/60">
              Pourquoi mes clientes adorent être coiffées chez elles
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {advantages.map((advantage, index) => (
              <div
                key={advantage.title}
                className="group relative"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500 hover:-translate-y-2">
                  {/* Floating icon effect */}
                  <div className="relative mb-4">
                    <div className="absolute -inset-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 group-hover:scale-110 group-hover:-rotate-6 group-hover:animate-bounce-subtle transition-all duration-500">
                      <div className="text-white">
                        {advantage.icon}
                      </div>
                    </div>
                  </div>

                  <h4 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors duration-300 mb-2">
                    {advantage.title}
                  </h4>
                  <p className="text-white/60 text-sm">
                    {advantage.description}
                  </p>

                  {/* Corner decoration */}
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-amber-500/0 group-hover:border-amber-500/50 rounded-tr-lg transition-all duration-500" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-amber-500/0 group-hover:border-amber-500/50 rounded-bl-lg transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-2xl">
            <p className="text-white/70 mb-6">
              Les frais de déplacement sont calculés automatiquement par{" "}
              <span className="text-amber-400 font-semibold">Halimah</span> lors de la réservation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/reserver">
                <Button
                  size="lg"
                  className="group relative px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Calendar className="w-5 h-5 mr-2" />
                  Réserver avec Halimah
                </Button>
              </Link>
              <a href="tel:+33939240269">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  09 39 24 02 69
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Decorative bottom line */}
        <div className="mt-16 flex items-center justify-center gap-4">
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/50" />
          <MapPin className="h-5 w-5 text-amber-500/50" />
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
