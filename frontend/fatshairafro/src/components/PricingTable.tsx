import { useState, useEffect } from 'react';
import { Clock, Info, ShoppingBag, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { QuantityModal } from '@/components/QuantityModal';
import { PriceTag } from '@/components/PriceDisplay';

interface Service {
  id: number;
  nom: string;
  description: string;
  duree: number; // minutes
  prix: number; // centimes
  categorie: string;
  populaire: boolean;
  prix_variable?: boolean;
  prix_min?: number;
  prix_max?: number;
}

interface Category {
  name: string;
  anchor: string;
  icon: string;
  color: string;
  image: string;
  services: Service[];
}

// Mapping des services vers leurs infos (catégorie, populaire)
const serviceMapping: Record<string, { categorie: string; populaire: boolean }> = {
  // Locks & Dreadlocks
  "Création crochet locks": { categorie: "Locks", populaire: true },
  "Création microlocks crochet": { categorie: "Locks", populaire: false },
  "Création microlocks twist": { categorie: "Locks", populaire: false },
  "Reprise racines locks": { categorie: "Locks", populaire: false },
  "Reprise racines microlocks": { categorie: "Locks", populaire: false },
  "Décapage locks": { categorie: "Locks", populaire: false },

  // Tresses & Braids
  "Braids (Box braids)": { categorie: "Tresses", populaire: true },
  "Nattes collées sans rajout": { categorie: "Tresses", populaire: false },
  "Nattes collées avec rajout": { categorie: "Tresses", populaire: false },

  // Soins
  "Soin complet": { categorie: "Soins", populaire: true },
  "Soin hydratant": { categorie: "Soins", populaire: false },
  "Shampoing": { categorie: "Soins", populaire: false },

  // Coiffure & Coloration
  "Brushing afro": { categorie: "Coiffure", populaire: false },
  "Teinture sans ammoniaque": { categorie: "Coloration", populaire: false },
  "Décoloration": { categorie: "Coloration", populaire: false },
};

// Mapping des services multi-jours (blocksDays)
const serviceBlocksDays: Record<string, number> = {
  "Création crochet locks": 1,
  "Création microlocks crochet": 2, // 2 jours consécutifs
  "Création microlocks twist": 1,
};

// Configuration des catégories
const categoryConfig: Record<string, { icon: string; color: string; image: string }> = {
  "Locks": {
    icon: "🔒",
    color: "from-amber-500 to-orange-500",
    image: "/gallery/creation-locks.jpg"
  },
  "Tresses": {
    icon: "✨",
    color: "from-pink-500 to-rose-500",
    image: "/gallery/braids-service.jpg"
  },
  "Soins": {
    icon: "💧",
    color: "from-emerald-500 to-teal-500",
    image: "/gallery/soin-complet.jpg"
  },
  "Coiffure": {
    icon: "💨",
    color: "from-violet-500 to-purple-500",
    image: "/gallery/brushing-01.jpg"
  },
  "Coloration": {
    icon: "🎨",
    color: "from-violet-600 to-purple-500",
    image: "/gallery/coloration-naturelle.jpg"
  },
  "default": {
    icon: "💇🏾‍♀️",
    color: "from-amber-500 to-orange-500",
    image: "/gallery/creation-locks.jpg"
  }
};

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

export default function PricingTable() {
  const [categories, setCategories] = useState<Category[]>([]);
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

      // Enrichir les services avec le mapping (catégorie, populaire)
      const enrichedServices = (data.services || []).map((s: Service) => {
        const mapping = serviceMapping[s.nom];
        if (mapping) {
          return { ...s, categorie: mapping.categorie, populaire: mapping.populaire };
        }
        return s;
      });

      // Grouper les services par catégorie
      const servicesByCategory: Record<string, Service[]> = {};
      enrichedServices.forEach((service: Service) => {
        const cat = service.categorie || 'Autre';
        if (!servicesByCategory[cat]) {
          servicesByCategory[cat] = [];
        }
        servicesByCategory[cat].push(service);
      });

      // Convertir en tableau de catégories
      const categoriesArray: Category[] = Object.entries(servicesByCategory).map(([name, services]) => {
        const config = categoryConfig[name] || categoryConfig["default"];
        return {
          name,
          anchor: name.toLowerCase().replace(/\s+/g, '-'),
          icon: config.icon,
          color: config.color,
          image: config.image,
          services
        };
      });

      setCategories(categoriesArray);
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

  if (loading) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
            <span className="ml-3 text-zinc-600">Chargement des services...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">Erreur: {error}</p>
            <Button onClick={fetchServices} variant="outline">
              Réessayer
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
            Tarifs
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            Nos <span className="text-amber-600">services & tarifs</span>
          </h2>
          <p className="text-zinc-600 max-w-2xl mx-auto">
            Des prestations professionnelles adaptées à tous les types de cheveux afro.
            Tarifs à domicile : frais de déplacement en supplément selon la distance.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.name} id={category.anchor} className="scroll-mt-24">
              {/* Category header with image */}
              <div className="relative overflow-hidden rounded-2xl mb-6">
                <div className="absolute inset-0">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
                </div>
                <div className="relative flex items-center gap-4 p-6">
                  <div className={`w-14 h-14 bg-gradient-to-br ${category.color} rounded-xl flex items-center justify-center shadow-lg text-2xl`}>
                    {category.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white">{category.name}</h3>
                </div>
              </div>

              {/* Services grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.services.map((service) => {
                  const inCart = isInCart(service.nom);
                  return (
                    <div
                      key={service.id}
                      className={`relative bg-white rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                        service.populaire
                          ? 'border-amber-300 shadow-md'
                          : 'border-zinc-200 hover:border-amber-200'
                      }`}
                    >
                      {/* Popular badge */}
                      {service.populaire && (
                        <div className="absolute -top-3 left-4">
                          <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                            Populaire
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-zinc-900 pr-4">{service.nom}</h4>
                        <PriceTag
                          prix={service.prix}
                          prixVariable={service.prix_variable}
                          prixMin={service.prix_min}
                        />
                      </div>

                      <p className="text-sm text-zinc-600 mb-3">
                        {service.description || "Service de coiffure professionnel"}
                      </p>

                      <div className="flex items-center gap-1 text-xs text-zinc-500 mb-4">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Durée : {formatDuration(service.duree)}</span>
                      </div>

                      {/* Boutons d'action */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={inCart ? "secondary" : "default"}
                          className={`flex-1 ${
                            inCart
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-amber-500 hover:bg-amber-600'
                          }`}
                          onClick={() => handleAddToCart(service)}
                          disabled={inCart}
                        >
                          {inCart ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Ajouté
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-4 w-4 mr-1" />
                              Panier
                            </>
                          )}
                        </Button>
                        <Link href="/reserver">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            RDV
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {categories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">Aucun service disponible pour le moment.</p>
          </div>
        )}

        {/* Info box */}
        <div className="mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-xl shrink-0">
            <Info className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-900 mb-2">À savoir</h4>
            <ul className="text-sm text-zinc-600 space-y-1">
              <li>• Les tarifs sont indicatifs, un devis personnalisé peut être établi selon vos besoins</li>
              <li>• Service à domicile : frais de déplacement calculés selon la distance</li>
              <li>• Les extensions et rajouts ne sont pas inclus dans les tarifs</li>
              <li>• Annulation gratuite jusqu'à 24h avant le rendez-vous</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-zinc-600 mb-4">Un doute sur le service adapté à vos besoins ?</p>
          <Link href="/reserver">
            <Button
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30"
            >
              Demander conseil à Halimah
            </Button>
          </Link>
        </div>
      </div>

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
    </section>
  );
}
