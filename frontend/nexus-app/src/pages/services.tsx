import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { QuantityModal } from "@/components/QuantityModal";
import { Clock, Calendar, Sparkles, Info, Phone, MessageCircle, CheckCircle2, Home, Star, ShoppingBag, Check, Loader2 } from "lucide-react";

interface Service {
  id: number;
  nom: string;
  description: string;
  duree: number; // minutes
  prix: number; // centimes
  categorie: string;
  image: string | null;
  populaire: boolean;
}

// Mapping des services vers leurs infos visuelles (image, catégorie, populaire)
const serviceMapping: Record<string, { image: string; categorie: string; populaire: boolean }> = {
  // Locks & Dreadlocks
  "Création crochet locks": { image: "/gallery/creation-locks.jpg", categorie: "Locks", populaire: true },
  "Création microlocks crochet": { image: "/gallery/microlocks-service.jpg", categorie: "Locks", populaire: false },
  "Création microlocks twist": { image: "/gallery/creation-locks.jpg", categorie: "Locks", populaire: false },
  "Reprise racines locks": { image: "/gallery/entretien-locks.jpg", categorie: "Locks", populaire: false },
  "Reprise racines microlocks": { image: "/gallery/entretien-locks.jpg", categorie: "Locks", populaire: false },
  "Décapage locks": { image: "/gallery/entretien-locks.jpg", categorie: "Locks", populaire: false },

  // Tresses & Braids
  "Braids (Box braids)": { image: "/gallery/braids-service.jpg", categorie: "Tresses", populaire: true },
  "Nattes collées sans rajout": { image: "/gallery/nattes-service.jpg", categorie: "Tresses", populaire: false },
  "Nattes collées avec rajout": { image: "/gallery/nattes-service.jpg", categorie: "Tresses", populaire: false },

  // Soins
  "Soin complet": { image: "/gallery/soin-complet.jpg", categorie: "Soins", populaire: true },
  "Soin hydratant": { image: "/gallery/soin-complet.jpg", categorie: "Soins", populaire: false },
  "Shampoing": { image: "/gallery/soin-complet.jpg", categorie: "Soins", populaire: false },

  // Coiffure & Coloration
  "Brushing afro": { image: "/gallery/brushing-01.jpg", categorie: "Coiffure", populaire: false },
  "Teinture sans ammoniaque": { image: "/gallery/coloration-naturelle.jpg", categorie: "Coloration", populaire: false },
  "Décoloration": { image: "/gallery/coloration-naturelle.jpg", categorie: "Coloration", populaire: false },
};

// Mapping des services multi-jours (blocksDays)
// Par défaut = 1 jour, sauf pour les créations de locks qui prennent plusieurs jours
const serviceBlocksDays: Record<string, number> = {
  "Création crochet locks": 1,
  "Création microlocks crochet": 2, // 2 jours consécutifs
  "Création microlocks twist": 1,
};

// Images par défaut selon la catégorie
const categoryImages: Record<string, string> = {
  "Locks": "/gallery/creation-locks.jpg",
  "Tresses": "/gallery/braids-service.jpg",
  "Soins": "/gallery/soin-complet.jpg",
  "Coiffure": "/gallery/brushing-01.jpg",
  "Coloration": "/gallery/coloration-naturelle.jpg",
  "default": "/gallery/creation-locks.jpg"
};

// Icônes par catégorie
const categoryIcons: Record<string, string> = {
  "Locks": "🔒",
  "Tresses": "✨",
  "Soins": "💧",
  "Coiffure": "💨",
  "Coloration": "🎨",
  "default": "💇🏾‍♀️"
};

// Gradients par catégorie
const categoryGradients: Record<string, string> = {
  "Locks": "from-amber-500 to-orange-500",
  "Tresses": "from-pink-500 to-rose-500",
  "Soins": "from-emerald-500 to-teal-500",
  "Coiffure": "from-violet-500 to-purple-500",
  "Coloration": "from-violet-600 to-purple-500",
  "default": "from-amber-500 to-orange-500"
};

const infoItems = [
  "Les tarifs peuvent varier selon la longueur et l'épaisseur des cheveux",
  "Un supplément peut s'appliquer pour les mèches et extensions",
  "Nous vous recommandons de prendre rendez-vous à l'avance",
  "Annulation gratuite jusqu'à 24h avant le rendez-vous",
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${remainingMinutes}`;
}

function formatPrice(centimes: number): string {
  return `${(centimes / 100).toFixed(0)}€`;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem, isInCart } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // État pour le modal quantité (services par unité)
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Services facturés par unité
  const unitServices: Record<string, { unitName: string; pricePerUnit: number; durationPerUnit: number }> = {
    'Réparation Locks': { unitName: 'lock', pricePerUnit: 10, durationPerUnit: 30 },
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services');
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Enrichir les services avec le mapping local (images, catégories, populaire)
      const enrichedServices = (data.services || []).map((s: Service) => {
        const mapping = serviceMapping[s.nom];
        if (mapping) {
          return {
            ...s,
            image: mapping.image,
            categorie: mapping.categorie,
            populaire: mapping.populaire
          };
        }
        return s;
      });

      setServices(enrichedServices);
    } catch (err: any) {
      console.error('Erreur chargement services:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (service: Service) => {
    if (isInCart(service.nom)) {
      toast({
        title: "Déjà dans le panier",
        description: `${service.nom} est déjà dans votre panier.`,
      });
      return;
    }

    // Vérifier si c'est un service facturé par unité
    if (unitServices[service.nom]) {
      setSelectedService(service);
      setQuantityModalOpen(true);
      return;
    }

    // Ajout normal au panier
    addItem({
      serviceNom: service.nom,
      description: service.description,
      duree: service.duree,
      prix: service.prix / 100, // Convertir centimes en euros
      blocksDays: serviceBlocksDays[service.nom] || 1, // Jours pour prestations multi-jours
    });

    toast({
      title: "Ajouté au panier !",
      description: `${service.nom} a été ajouté à votre panier.`,
      action: (
        <ToastAction altText="Voir le panier" onClick={() => setLocation('/panier')}>
          Voir mon panier
        </ToastAction>
      ),
    });
  };

  // Callback du modal quantité
  const handleQuantityConfirm = (quantity: number, totalPrice: number, totalDuration: number) => {
    if (!selectedService) return;

    const unitInfo = unitServices[selectedService.nom];

    addItem({
      serviceNom: selectedService.nom,
      description: `${quantity} ${unitInfo.unitName}(s) à réparer - ${selectedService.description}`,
      duree: totalDuration,
      prix: totalPrice,
      blocksDays: 1,
    });

    toast({
      title: "Ajouté au panier !",
      description: `${selectedService.nom} (${quantity} ${unitInfo.unitName}s) ajouté.`,
      action: (
        <ToastAction altText="Voir le panier" onClick={() => setLocation('/panier')}>
          Voir mon panier
        </ToastAction>
      ),
    });

    setSelectedService(null);
  };

  const getServiceImage = (service: Service): string => {
    // Utiliser l'image du service (déjà enrichi par le mapping)
    if (service.image) return service.image;
    // Fallback sur la catégorie
    return categoryImages[service.categorie] || categoryImages["default"];
  };

  const getServiceIcon = (service: Service): string => {
    return categoryIcons[service.categorie] || categoryIcons["default"];
  };

  const getServiceGradient = (service: Service): string => {
    return categoryGradients[service.categorie] || categoryGradients["default"];
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation />

      {/* Hero Section - Cinematic */}
      <section className="relative pt-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 grid grid-cols-4 opacity-30">
            {services.slice(0, 4).map((service) => (
              <div key={service.id} className="relative overflow-hidden">
                <img
                  src={getServiceImage(service)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/90 to-zinc-950" />
        </div>

        {/* Letterbox */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-20" />

        {/* Floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-32 left-[10%] animate-float-slow opacity-10">
            <Sparkles className="h-20 w-20 text-amber-500" />
          </div>
          <div className="absolute top-48 right-[15%] animate-float-medium opacity-10">
            <Star className="h-16 w-16 text-amber-500" />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Nos prestations</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="text-white">Services & </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                Tarifs
              </span>
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Découvrez notre gamme complète de services de coiffure afro.
              Chaque prestation est réalisée avec soin et passion par Fatou.
            </p>
          </div>
        </div>

        {/* Corner frames */}
        <div className="absolute top-20 left-6 w-16 h-16 border-l-2 border-t-2 border-amber-500/30 z-10" />
        <div className="absolute top-20 right-6 w-16 h-16 border-r-2 border-t-2 border-amber-500/30 z-10" />
      </section>

      {/* Services Grid - Cinematic */}
      <section className="relative py-20">
        <div className="absolute inset-0 african-pattern opacity-5" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">Nos </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                spécialités
              </span>
            </h2>
            <p className="text-white/50">Cliquez sur un service pour réserver</p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              <span className="ml-3 text-white/60">Chargement des services...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-20">
              <p className="text-red-400 mb-4">Erreur: {error}</p>
              <Button onClick={fetchServices} variant="outline" className="text-amber-400 border-amber-500">
                Réessayer
              </Button>
            </div>
          )}

          {/* Services grid */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-amber-500/30 transition-all duration-500 hover:-translate-y-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={getServiceImage(service)}
                      alt={service.nom}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

                    {/* Icon badge */}
                    <div className={`absolute bottom-3 left-3 w-12 h-12 bg-gradient-to-br ${getServiceGradient(service)} rounded-xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300`}>
                      {getServiceIcon(service)}
                    </div>

                    {/* Popular badge */}
                    {service.populaire && (
                      <div className="absolute top-3 right-3 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold rounded-full shadow-lg">
                        Populaire
                      </div>
                    )}

                    {/* Corner accents on hover */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-amber-400 transition-colors">
                      {service.nom}
                    </h3>
                    <p className="text-sm text-white/50 mb-4 line-clamp-2">
                      {service.description || "Service de coiffure professionnel"}
                    </p>

                    {/* Details */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span>{formatDuration(service.duree)}</span>
                      </div>
                      <span className="text-2xl font-bold text-amber-500">
                        {formatPrice(service.prix)}
                      </span>
                    </div>

                    {/* CTA */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAddToCart(service)}
                        variant="outline"
                        className={`flex-1 rounded-xl border-amber-500/50 ${
                          isInCart(service.nom)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                            : 'text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        {isInCart(service.nom) ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Ajouté
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            Panier
                          </>
                        )}
                      </Button>
                      <Link href="/reserver" className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl">
                          <Calendar className="mr-2 h-4 w-4" />
                          RDV
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && services.length === 0 && (
            <div className="text-center py-20">
              <p className="text-white/60">Aucun service disponible pour le moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Info Section - Cinematic */}
      <section className="relative py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Important Info */}
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/30 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/30 rounded-bl-lg" />

              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl shrink-0">
                  <Info className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    Informations importantes
                  </h3>
                  <ul className="space-y-3">
                    {infoItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-white/60 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                    <li className="flex items-start gap-3 text-red-400/80 text-sm">
                      <span className="text-red-400 mt-0.5">✗</span>
                      Nous n'effectuons pas de défrisage
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Deux options */}
            <div className="relative bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/50 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/50 rounded-bl-lg" />

              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500 rounded-xl shrink-0">
                  <Home className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-amber-400">
                    Deux options pour vous
                  </h3>
                  <p className="text-white/70 text-sm mb-4">
                    Venez chez Fatou à Franconville (sans frais supplémentaire) ou recevez-la chez vous en Île-de-France.
                  </p>
                  <ul className="space-y-2 text-sm text-white/70">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      Chez Fatou : 8 rue des Monts Rouges, Franconville
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      À domicile : frais de déplacement selon la distance
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      Horaires flexibles (soir & week-end)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-zinc-900" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 text-center">
          <div className="inline-block bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full border border-amber-500/30 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Prête à vous sublimer ?</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Réservez votre <span className="text-amber-500">rendez-vous</span>
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Discutez avec Halimah, notre assistante virtuelle disponible 24h/24,
              pour trouver le créneau parfait.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/reserver">
                <Button
                  size="lg"
                  className="group relative px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Réserver avec Halimah
                </Button>
              </Link>
              <a href="tel:+33939240269">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full"
                >
                  <Phone className="mr-2 h-5 w-5" />
                  09 39 24 02 69
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Corner frames */}
        <div className="absolute bottom-16 left-6 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
        <div className="absolute bottom-16 right-6 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />
      </section>

      {/* Modal pour services facturés par unité */}
      {selectedService && unitServices[selectedService.nom] && (
        <QuantityModal
          isOpen={quantityModalOpen}
          onClose={() => {
            setQuantityModalOpen(false);
            setSelectedService(null);
          }}
          onConfirm={handleQuantityConfirm}
          serviceName={selectedService.nom}
          pricePerUnit={unitServices[selectedService.nom].pricePerUnit}
          durationPerUnit={unitServices[selectedService.nom].durationPerUnit}
          unitName={unitServices[selectedService.nom].unitName}
        />
      )}

      <Footer />
    </div>
  );
}
