import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, Lock, Mail, User, Building, Phone,
  Check, ArrowLeft, ArrowRight, Search, MessageSquare, ShieldCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// DATA — Professions, catégories, plans
// ═══════════════════════════════════════════════════════════════

interface Profession {
  id: string;
  label: string;
  emoji: string;
  description: string;
  template: string;
  category: string;
}

const PROFESSIONS: Profession[] = [
  // Beauté & Coiffure
  { id: 'coiffeur', label: 'Coiffeur / Coiffeuse', emoji: '✂️', description: 'Salon de coiffure, coupes, colorations', template: 'salon_coiffure', category: 'beaute' },
  { id: 'barbier', label: 'Barbier / Barber Shop', emoji: '💈', description: 'Taille de barbe, rasage, soins homme', template: 'salon_coiffure', category: 'beaute' },
  { id: 'estheticienne', label: 'Esthéticienne', emoji: '💅', description: 'Soins visage, épilation, manucure', template: 'institut_beaute', category: 'beaute' },
  { id: 'prothesiste_ongulaire', label: 'Prothésiste ongulaire', emoji: '💅', description: 'Pose de gel, résine, nail art', template: 'institut_beaute', category: 'beaute' },
  { id: 'maquilleuse', label: 'Maquilleuse', emoji: '💄', description: 'Maquillage événementiel, mariées', template: 'institut_beaute', category: 'beaute' },
  { id: 'spa', label: 'Spa / Centre bien-être', emoji: '🧖', description: 'Massages, hammam, sauna', template: 'institut_beaute', category: 'beaute' },
  { id: 'tatoueur', label: 'Tatoueur / Pierceur', emoji: '🎨', description: 'Tatouages, piercings, dermographie', template: 'institut_beaute', category: 'beaute' },

  // Santé & Médical
  { id: 'medecin', label: 'Médecin généraliste', emoji: '🩺', description: 'Consultations médicales', template: 'medical', category: 'sante' },
  { id: 'dentiste', label: 'Dentiste', emoji: '🦷', description: 'Soins dentaires, orthodontie', template: 'medical', category: 'sante' },
  { id: 'kinesitherapeute', label: 'Kinésithérapeute', emoji: '💪', description: 'Rééducation, massages thérapeutiques', template: 'medical', category: 'sante' },
  { id: 'osteopathe', label: 'Ostéopathe', emoji: '🦴', description: 'Manipulations, douleurs articulaires', template: 'medical', category: 'sante' },
  { id: 'psychologue', label: 'Psychologue / Psy', emoji: '🧠', description: 'Consultations, thérapies', template: 'medical', category: 'sante' },
  { id: 'dermatologue', label: 'Dermatologue', emoji: '🔬', description: 'Soins de la peau, laser', template: 'medical', category: 'sante' },
  { id: 'ophtalmologue', label: 'Ophtalmologue', emoji: '👁️', description: 'Examens de vue, chirurgie', template: 'medical', category: 'sante' },
  { id: 'veterinaire', label: 'Vétérinaire', emoji: '🐾', description: 'Soins animaux, vaccination', template: 'medical', category: 'sante' },
  { id: 'infirmier', label: 'Infirmier(e)', emoji: '💉', description: 'Soins, injections, pansements', template: 'medical', category: 'sante' },
  { id: 'podologue', label: 'Podologue / Pédicure', emoji: '🦶', description: 'Soins des pieds, semelles', template: 'medical', category: 'sante' },
  { id: 'orthophoniste', label: 'Orthophoniste', emoji: '🗣️', description: 'Rééducation du langage', template: 'medical', category: 'sante' },
  { id: 'sage_femme', label: 'Sage-femme', emoji: '👶', description: 'Suivi grossesse, préparation', template: 'medical', category: 'sante' },
  { id: 'dieteticien', label: 'Diététicien(ne)', emoji: '🥗', description: 'Bilans nutritionnels, régimes', template: 'medical', category: 'sante' },
  { id: 'naturopathe', label: 'Naturopathe', emoji: '🌿', description: 'Médecine naturelle, phytothérapie', template: 'medical', category: 'sante' },
  { id: 'sophrologue', label: 'Sophrologue', emoji: '🧘', description: 'Relaxation, gestion du stress', template: 'medical', category: 'sante' },
  { id: 'chiropracteur', label: 'Chiropracteur', emoji: '🦴', description: 'Ajustements vertébraux', template: 'medical', category: 'sante' },

  // Restauration
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️', description: 'Restaurant traditionnel, gastronomique', template: 'restaurant', category: 'restauration' },
  { id: 'pizzeria', label: 'Pizzeria', emoji: '🍕', description: 'Pizza, cuisine italienne', template: 'restaurant', category: 'restauration' },
  { id: 'brasserie', label: 'Brasserie / Bistrot', emoji: '🍺', description: 'Cuisine de brasserie, plats du jour', template: 'restaurant', category: 'restauration' },
  { id: 'fast_food', label: 'Fast-food / Snack', emoji: '🍔', description: 'Restauration rapide', template: 'restaurant', category: 'restauration' },
  { id: 'food_truck', label: 'Food truck', emoji: '🚚', description: 'Cuisine ambulante, street food', template: 'restaurant', category: 'restauration' },
  { id: 'bar', label: 'Bar / Lounge', emoji: '🍸', description: 'Cocktails, soirées, tapas', template: 'restaurant', category: 'restauration' },
  { id: 'cafe', label: 'Café / Salon de thé', emoji: '☕', description: 'Boissons chaudes, pâtisseries', template: 'restaurant', category: 'restauration' },
  { id: 'traiteur', label: 'Traiteur', emoji: '🥘', description: 'Événements, buffets, plateaux-repas', template: 'artisan', category: 'restauration' },
  { id: 'boulangerie', label: 'Boulangerie / Pâtisserie', emoji: '🥐', description: 'Pain, viennoiseries, gâteaux', template: 'commerce', category: 'restauration' },
  { id: 'sushi', label: 'Restaurant japonais / Sushi', emoji: '🍣', description: 'Sushi, ramen, cuisine japonaise', template: 'restaurant', category: 'restauration' },

  // Hébergement
  { id: 'hotel', label: 'Hôtel', emoji: '🏨', description: 'Chambres, suites, séminaires', template: 'hotel', category: 'hebergement' },
  { id: 'chambre_hotes', label: "Chambre d'hôtes / B&B", emoji: '🏡', description: 'Accueil chaleureux, petit-déjeuner', template: 'hotel', category: 'hebergement' },
  { id: 'gite', label: 'Gîte / Location saisonnière', emoji: '🏠', description: 'Location courte durée, vacances', template: 'hotel', category: 'hebergement' },
  { id: 'auberge', label: 'Auberge / Hostel', emoji: '🛏️', description: 'Hébergement économique, dortoirs', template: 'hotel', category: 'hebergement' },
  { id: 'camping', label: 'Camping / Glamping', emoji: '⛺', description: 'Emplacements, mobil-homes', template: 'hotel', category: 'hebergement' },

  // Automobile
  { id: 'garage', label: 'Garage automobile', emoji: '🔧', description: 'Réparation, entretien, vidange', template: 'garage', category: 'automobile' },
  { id: 'carrossier', label: 'Carrossier', emoji: '🚗', description: 'Réparation carrosserie, peinture', template: 'garage', category: 'automobile' },
  { id: 'controle_technique', label: 'Contrôle technique', emoji: '✅', description: 'Contrôle réglementaire véhicules', template: 'garage', category: 'automobile' },
  { id: 'mecanicien_moto', label: 'Mécanicien moto / 2 roues', emoji: '🏍️', description: 'Réparation motos, scooters', template: 'garage', category: 'automobile' },
  { id: 'lavage_auto', label: 'Station de lavage', emoji: '🧽', description: 'Lavage, detailing, polissage', template: 'garage', category: 'automobile' },
  { id: 'auto_ecole', label: 'Auto-école', emoji: '🚘', description: 'Permis de conduire, leçons', template: 'autre', category: 'automobile' },

  // Commerce
  { id: 'boutique_vetements', label: 'Boutique de vêtements', emoji: '👗', description: 'Prêt-à-porter, mode', template: 'commerce', category: 'commerce' },
  { id: 'fleuriste', label: 'Fleuriste', emoji: '💐', description: 'Bouquets, compositions florales', template: 'commerce', category: 'commerce' },
  { id: 'bijouterie', label: 'Bijouterie / Horlogerie', emoji: '💍', description: 'Bijoux, montres, réparation', template: 'commerce', category: 'commerce' },
  { id: 'librairie', label: 'Librairie / Papeterie', emoji: '📚', description: 'Livres, fournitures', template: 'commerce', category: 'commerce' },
  { id: 'epicerie', label: 'Épicerie fine / Bio', emoji: '🛒', description: 'Produits locaux, bio, gourmet', template: 'commerce', category: 'commerce' },
  { id: 'opticien', label: 'Opticien', emoji: '👓', description: 'Lunettes, lentilles, examens', template: 'commerce', category: 'commerce' },
  { id: 'magasin_sport', label: 'Magasin de sport', emoji: '⚽', description: 'Équipements sportifs', template: 'commerce', category: 'commerce' },
  { id: 'animalerie', label: 'Animalerie', emoji: '🐶', description: 'Animaux, accessoires, alimentation', template: 'commerce', category: 'commerce' },
  { id: 'cave_vin', label: 'Cave à vin', emoji: '🍷', description: 'Vins, spiritueux, dégustations', template: 'commerce', category: 'commerce' },
  { id: 'pharmacie', label: 'Pharmacie / Parapharmacie', emoji: '💊', description: 'Médicaments, cosmétiques, conseil', template: 'commerce', category: 'commerce' },

  // Services à domicile
  { id: 'plombier', label: 'Plombier', emoji: '🔧', description: 'Plomberie, chauffage, dépannage', template: 'artisan', category: 'services' },
  { id: 'electricien', label: 'Électricien', emoji: '⚡', description: 'Installation, dépannage électrique', template: 'artisan', category: 'services' },
  { id: 'serrurier', label: 'Serrurier', emoji: '🔑', description: 'Ouverture de portes, serrures', template: 'artisan', category: 'services' },
  { id: 'peintre', label: 'Peintre en bâtiment', emoji: '🎨', description: 'Peinture intérieure/extérieure', template: 'artisan', category: 'services' },
  { id: 'jardinier', label: 'Jardinier / Paysagiste', emoji: '🌳', description: 'Entretien jardins, aménagement', template: 'artisan', category: 'services' },
  { id: 'livreur', label: 'Livreur / Coursier', emoji: '📦', description: 'Livraison, transport de colis', template: 'artisan', category: 'services' },
  { id: 'demenageur', label: 'Déménageur', emoji: '🚛', description: 'Déménagement, transport meubles', template: 'artisan', category: 'services' },
  { id: 'nettoyage', label: 'Nettoyage / Ménage', emoji: '🧹', description: 'Ménage, entretien locaux', template: 'artisan', category: 'services' },
  { id: 'reparateur_info', label: 'Réparateur informatique', emoji: '💻', description: 'Dépannage PC, réseaux', template: 'artisan', category: 'services' },
  { id: 'coach_sportif', label: 'Coach sportif', emoji: '🏋️', description: 'Coaching personnel, remise en forme', template: 'artisan', category: 'services' },
  { id: 'photographe', label: 'Photographe / Vidéaste', emoji: '📸', description: 'Shooting, événements, vidéo', template: 'artisan', category: 'services' },
  { id: 'prof_particulier', label: 'Professeur particulier', emoji: '📖', description: 'Cours à domicile, soutien scolaire', template: 'artisan', category: 'services' },
  { id: 'pet_sitter', label: 'Pet-sitter / Dog-walker', emoji: '🐕', description: "Garde d'animaux, promenades", template: 'artisan', category: 'services' },
  { id: 'aide_domicile', label: 'Aide à domicile', emoji: '🏠', description: 'Assistance personnes âgées', template: 'artisan', category: 'services' },
  { id: 'couturier', label: 'Couturier / Retouches', emoji: '🧵', description: 'Retouches vêtements, couture', template: 'artisan', category: 'services' },
  { id: 'menuisier', label: 'Menuisier / Ébéniste', emoji: '🪚', description: 'Meubles sur mesure, réparations bois', template: 'artisan', category: 'services' },
  { id: 'vitrier', label: 'Vitrier / Miroitier', emoji: '🪟', description: 'Vitrerie, double vitrage', template: 'artisan', category: 'services' },
  { id: 'climatisation', label: 'Climatisation / Chauffage', emoji: '❄️', description: 'Installation, entretien clim/chauffage', template: 'artisan', category: 'services' },

  // Sport & Loisirs
  { id: 'salle_sport', label: 'Salle de sport / Fitness', emoji: '🏋️', description: 'Abonnements, cours collectifs', template: 'autre', category: 'sport' },
  { id: 'yoga', label: 'Studio yoga / Pilates', emoji: '🧘', description: 'Cours de yoga, méditation', template: 'autre', category: 'sport' },
  { id: 'danse', label: 'École de danse', emoji: '💃', description: 'Cours de danse, stages', template: 'autre', category: 'sport' },
  { id: 'arts_martiaux', label: 'Arts martiaux / Boxe', emoji: '🥋', description: 'Karaté, judo, boxe, MMA', template: 'autre', category: 'sport' },
  { id: 'equitation', label: 'Centre équestre', emoji: '🐴', description: "Cours d'équitation, balades", template: 'autre', category: 'sport' },

  // Conseil & Services pro
  { id: 'consultant', label: 'Consultant / Coach', emoji: '💼', description: 'Conseil en entreprise, coaching', template: 'autre', category: 'conseil' },
  { id: 'avocat', label: 'Avocat / Cabinet juridique', emoji: '⚖️', description: 'Droit, contentieux, conseil juridique', template: 'autre', category: 'conseil' },
  { id: 'comptable', label: 'Expert-comptable', emoji: '📊', description: 'Comptabilité, fiscalité, paie', template: 'autre', category: 'conseil' },
  { id: 'agent_immobilier', label: 'Agent immobilier', emoji: '🏢', description: 'Vente, location, gestion locative', template: 'autre', category: 'conseil' },
  { id: 'architecte', label: 'Architecte / Designer', emoji: '📐', description: 'Plans, décoration, aménagement', template: 'autre', category: 'conseil' },
  { id: 'assurance', label: 'Courtier en assurance', emoji: '🛡️', description: 'Assurances, mutuelles, prévoyance', template: 'autre', category: 'conseil' },
  { id: 'agence_web', label: 'Agence web / Freelance IT', emoji: '🖥️', description: 'Sites web, applications, SEO', template: 'autre', category: 'conseil' },
  { id: 'formation', label: 'Organisme de formation', emoji: '🎓', description: 'Formations professionnelles, CPF', template: 'autre', category: 'conseil' },
  { id: 'evenementiel', label: 'Événementiel / Wedding planner', emoji: '🎉', description: "Organisation d'événements, mariages", template: 'autre', category: 'conseil' },

  // Autre
  { id: 'autre', label: 'Autre activité', emoji: '🏪', description: "Mon activité n'est pas listée", template: 'autre', category: 'autre' },
];

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  beaute: { label: 'Beauté & Coiffure', emoji: '💇' },
  sante: { label: 'Santé & Médical', emoji: '🩺' },
  restauration: { label: 'Restauration', emoji: '🍽️' },
  hebergement: { label: 'Hébergement', emoji: '🏨' },
  automobile: { label: 'Automobile', emoji: '🚗' },
  commerce: { label: 'Commerce', emoji: '🛍️' },
  services: { label: 'Services & Artisanat', emoji: '🔧' },
  sport: { label: 'Sport & Loisirs', emoji: '⚽' },
  conseil: { label: 'Conseil & Services pro', emoji: '💼' },
  autre: { label: 'Autre', emoji: '🏪' },
};

// Modele 2026 — revision finale 9 avril 2026 (voir memory/business-model-2026.md)
// Free freemium / Basic 29€ illimite non-IA + 1 000 credits IA / Business 149€ multi-sites + 10 000 credits IA
const PLANS = {
  free: {
    name: 'Free', price: 0, originalPrice: 0,
    features: ['10 réservations / mois', '10 factures / mois', '30 clients max', 'Tous les modules visibles', 'Support email'],
  },
  basic: {
    name: 'Basic', price: 29, originalPrice: 29, popular: true,
    features: ['Tout illimité (réservations, factures, clients)', 'CRM, Comptabilité, RH, Stock', 'Workflows, Pipeline, Devis, SEO', '1 000 crédits IA inclus / mois (valeur 15€)', 'Support email prioritaire'],
  },
  business: {
    name: 'Business', price: 149, originalPrice: 149,
    features: ['Tout Basic +', 'Multi-sites illimités', 'White-label + API + SSO', '10 000 crédits IA inclus / mois (valeur 150€)', 'Account Manager dédié'],
  },
};

// Template → suggested plan (modele 2026)
const TEMPLATE_SUGGESTED_PLAN: Record<string, keyof typeof PLANS> = {
  salon_coiffure: 'basic',
  institut_beaute: 'basic',
  restaurant: 'basic',
  medical: 'basic',
  garage: 'basic',
  artisan: 'basic',
  hotel: 'basic',
  commerce: 'basic',
  autre: 'free',
};

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            i + 1 < current ? 'bg-cyan-500 text-white' :
            i + 1 === current ? 'bg-cyan-500 text-white ring-4 ring-cyan-500/20' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i + 1 < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 ${i + 1 < current ? 'bg-cyan-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 1 — Quel est votre métier ?
// ═══════════════════════════════════════════════════════════════

function StepMetier({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return PROFESSIONS;
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PROFESSIONS.filter(p =>
      p.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
      p.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Profession[]> = {};
    for (const p of filtered) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Quel est votre métier ?</h2>
        <p className="text-gray-500 mt-1">Trouvez votre activité pour une configuration personnalisée</p>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher votre métier... (ex: coiffeur, plombier, restaurant)"
          className="pl-10"
          autoFocus
        />
      </div>

      {/* Grille de métiers */}
      <div className="max-h-[450px] overflow-y-auto space-y-4 pr-1">
        {Object.entries(grouped).map(([catKey, professions]) => {
          const cat = CATEGORIES[catKey];
          if (!cat) return null;
          const isExpanded = expandedCategory === catKey || !!search.trim();
          const displayProfessions = isExpanded ? professions : professions.slice(0, 4);
          const hasMore = !isExpanded && professions.length > 4;

          return (
            <div key={catKey}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {cat.emoji} {cat.label}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {displayProfessions.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                      selected === p.id
                        ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{p.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{p.label}</div>
                      <div className="text-xs text-gray-500 truncate">{p.description}</div>
                    </div>
                    {selected === p.id && (
                      <Check className="w-4 h-4 text-cyan-500 flex-shrink-0 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setExpandedCategory(catKey)}
                  className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  + {professions.length - 4} autres métiers
                </button>
              )}
            </div>
          );
        })}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun métier trouvé. Essayez un autre terme ou choisissez "Autre activité".</p>
            <button
              type="button"
              onClick={() => onSelect('autre')}
              className="mt-2 text-cyan-600 hover:text-cyan-700 font-medium"
            >
              Choisir "Autre activité"
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 2 — Votre entreprise
// ═══════════════════════════════════════════════════════════════

function StepEntreprise({
  data,
  onChange,
  smsState,
  onSendSms,
  onVerifySms,
}: {
  data: { entreprise: string; telephone: string; adresse: string; siret: string; sms_code: string; sms_verified_token: string };
  onChange: (field: string, value: string) => void;
  smsState: { sent: boolean; sending: boolean; verifying: boolean; error: string | null };
  onSendSms: () => void;
  onVerifySms: () => void;
}) {
  const phoneVerified = !!data.sms_verified_token;
  const phoneOk = /^[\d\s+\-.()]{10,}$/.test(data.telephone);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Votre entreprise</h2>
        <p className="text-gray-500 mt-1">Parlez-nous de votre activité</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={data.entreprise} onChange={e => onChange('entreprise', e.target.value)} placeholder="Mon Salon, Ma Clinique..." className="pl-10" required />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">SIRET (recommandé)</label>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={data.siret}
            onChange={e => onChange('siret', e.target.value.replace(/\D/g, '').slice(0, 14))}
            placeholder="14 chiffres"
            className="pl-10"
            inputMode="numeric"
            maxLength={14}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">Renseigner le SIRET valide votre statut professionnel et sécurise votre compte.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Téléphone mobile * {phoneVerified && <span className="text-green-600 font-normal">(verifié)</span>}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="tel"
              value={data.telephone}
              onChange={e => {
                onChange('telephone', e.target.value);
                if (phoneVerified) onChange('sms_verified_token', '');
              }}
              placeholder="06 12 34 56 78"
              className="pl-10"
              disabled={phoneVerified}
              required
            />
          </div>
          {!phoneVerified && (
            <Button
              type="button"
              onClick={onSendSms}
              disabled={!phoneOk || smsState.sending}
              variant="secondary"
              className="whitespace-nowrap"
            >
              {smsState.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (smsState.sent ? 'Renvoyer' : 'Envoyer code')}
            </Button>
          )}
        </div>

        {smsState.sent && !phoneVerified && (
          <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-sm text-cyan-900">
              <MessageSquare className="h-4 w-4" />
              <span>Code envoyé par SMS au {data.telephone}</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={data.sms_code}
                onChange={e => onChange('sms_code', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                className="text-center font-mono text-lg tracking-widest"
              />
              <Button
                type="button"
                onClick={onVerifySms}
                disabled={data.sms_code.length !== 6 || smsState.verifying}
              >
                {smsState.verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vérifier'}
              </Button>
            </div>
          </div>
        )}

        {phoneVerified && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
            <ShieldCheck className="h-4 w-4" />
            <span>Numéro vérifié avec succès</span>
          </div>
        )}

        {smsState.error && (
          <p className="mt-2 text-xs text-red-600">{smsState.error}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={data.adresse} onChange={e => onChange('adresse', e.target.value)} placeholder="12 rue de la Paix, 75001 Paris" className="pl-10" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 3 — Créez votre compte
// ═══════════════════════════════════════════════════════════════

function StepCompte({
  data,
  onChange,
}: {
  data: { nom: string; email: string; password: string; confirmPassword: string; accept_cgv: boolean };
  onChange: (field: string, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Créez votre compte</h2>
        <p className="text-gray-500 mt-1">Vos identifiants de connexion</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={data.nom} onChange={e => onChange('nom', e.target.value)} placeholder="Jean Dupont" className="pl-10" required />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="email@exemple.com" className="pl-10" required />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input type="password" value={data.password} onChange={e => onChange('password', e.target.value)} placeholder="Mot de passe sécurisé" className="pl-10" required minLength={12} />
        </div>
        <ul className="mt-1.5 text-xs text-gray-400 space-y-0.5">
          <li className={data.password.length >= 12 ? 'text-green-600' : ''}>
            {data.password.length >= 12 ? '✓' : '○'} 12 caractères minimum
          </li>
          <li className={/[A-Z]/.test(data.password) ? 'text-green-600' : ''}>
            {/[A-Z]/.test(data.password) ? '✓' : '○'} Une majuscule
          </li>
          <li className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(data.password) ? 'text-green-600' : ''}>
            {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(data.password) ? '✓' : '○'} Un symbole (!@#$%^&*...)
          </li>
        </ul>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input type="password" value={data.confirmPassword} onChange={e => onChange('confirmPassword', e.target.value)} placeholder="Confirmez votre mot de passe" className="pl-10" required />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="accept_cgv"
          checked={data.accept_cgv}
          onChange={e => onChange('accept_cgv', e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
        />
        <label htmlFor="accept_cgv" className="text-sm text-gray-600">
          J'accepte les{' '}
          <a href="/cgv" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline font-medium">
            Conditions Générales de Vente
          </a>
        </label>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 4 — Choisissez votre plan
// ═══════════════════════════════════════════════════════════════

function StepPlan({
  selected,
  suggested,
  onSelect,
}: {
  selected: keyof typeof PLANS;
  suggested: keyof typeof PLANS;
  onSelect: (plan: keyof typeof PLANS) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Choisissez votre plan</h2>
        <p className="text-gray-500 mt-1">Plan Free gratuit à vie, sans carte bancaire</p>
      </div>

      <div className="grid gap-4">
        {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => {
          const isSelected = selected === key;
          const isSuggested = suggested === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {isSuggested && (
                <span className="absolute -top-2.5 right-4 bg-cyan-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  Recommandé pour vous
                </span>
              )}
              {'popular' in plan && plan.popular && !isSuggested && (
                <span className="absolute -top-2.5 right-4 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  Populaire
                </span>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm line-through text-gray-400">{plan.originalPrice}€</span>
                    <span className="text-2xl font-bold text-gray-900">{plan.price}€</span>
                    <span className="text-gray-500 text-sm">/mois</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300'
                }`}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
              <ul className="mt-3 space-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                    <Check className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-gray-400">
        Offre de lancement — 100 premiers clients. Vous ne serez pas facturé pendant les 14 premiers jours.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Données du wizard
  const [professionId, setProfessionId] = useState('');
  const [formData, setFormData] = useState({
    entreprise: '',
    telephone: '',
    adresse: '',
    siret: '',
    sms_code: '',
    sms_verified_token: '',
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
    accept_cgv: false,
  });
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>('basic');
  const [smsState, setSmsState] = useState<{
    sent: boolean;
    sending: boolean;
    verifying: boolean;
    error: string | null;
  }>({ sent: false, sending: false, verifying: false, error: null });

  // Template technique déduit de la profession
  const selectedProfession = PROFESSIONS.find(p => p.id === professionId);
  const templateType = selectedProfession?.template || 'autre';
  const suggestedPlan = TEMPLATE_SUGGESTED_PLAN[templateType] || 'basic';

  // Quand on sélectionne un métier, pré-sélectionner le plan recommandé
  const handleSelectProfession = (id: string) => {
    setProfessionId(id);
    const prof = PROFESSIONS.find(p => p.id === id);
    if (prof) {
      const suggested = TEMPLATE_SUGGESTED_PLAN[prof.template] || 'basic';
      setSelectedPlan(suggested);
    }
  };

  const handleFieldChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSendSms = async () => {
    if (!formData.telephone) return;
    setSmsState(prev => ({ ...prev, sending: true, error: null }));
    try {
      const response = await fetch('/api/admin/auth/signup/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.telephone }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du code SMS");
      }
      setSmsState({ sent: true, sending: false, verifying: false, error: null });
    } catch (err) {
      setSmsState(prev => ({
        ...prev,
        sending: false,
        error: err instanceof Error ? err.message : "Erreur d'envoi du SMS",
      }));
    }
  };

  const handleVerifySms = async () => {
    if (!formData.telephone || formData.sms_code.length !== 6) return;
    setSmsState(prev => ({ ...prev, verifying: true, error: null }));
    try {
      const response = await fetch('/api/admin/auth/signup/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.telephone, code: formData.sms_code }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Code de vérification invalide');
      }
      setFormData(prev => ({ ...prev, sms_verified_token: data.token }));
      setSmsState({ sent: true, sending: false, verifying: false, error: null });
    } catch (err) {
      setSmsState(prev => ({
        ...prev,
        verifying: false,
        error: err instanceof Error ? err.message : 'Code invalide',
      }));
    }
  };

  const canGoNext = (): boolean => {
    switch (step) {
      case 1: return !!professionId;
      case 2: return !!formData.entreprise.trim() && !!formData.sms_verified_token;
      case 3:
        return !!formData.nom.trim() &&
          !!formData.email.trim() &&
          formData.password.length >= 12 &&
          /[A-Z]/.test(formData.password) &&
          /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password) &&
          formData.password === formData.confirmPassword &&
          formData.accept_cgv;
      case 4: return !!selectedPlan;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profession_id: professionId,
          template_type: templateType,
          entreprise: formData.entreprise,
          telephone: formData.telephone,
          adresse: formData.adresse,
          siret: formData.siret || undefined,
          sms_verified_token: formData.sms_verified_token,
          nom: formData.nom,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          accept_cgv: formData.accept_cgv,
          plan: selectedPlan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const details = data.details ? '\n• ' + data.details.join('\n• ') : '';
        throw new Error((data.error || 'Erreur lors de la création du compte') + details);
      }

      // Auto-login avec le token retourné
      if (data.token) {
        api.setToken(data.token);
        navigate('/configuration');
      } else {
        // Fallback: ancien flow sans auto-login
        navigate('/login?registered=true');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Bouton retour */}
      <button
        onClick={() => step > 1 ? setStep(step - 1) : window.location.href = 'https://nexus-ai-saas.com'}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">{step > 1 ? 'Retour' : 'Retour au site'}</span>
      </button>

      <div className="w-full max-w-2xl relative z-10">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-8">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">N</span>
              </div>
            </div>

            <StepIndicator current={step} total={4} />

            {/* Erreur */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            {/* Métier sélectionné (badge) */}
            {step > 1 && selectedProfession && (
              <div className="mb-4 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedProfession.emoji} {selectedProfession.label}
                </span>
              </div>
            )}

            {/* Steps */}
            {step === 1 && <StepMetier selected={professionId} onSelect={handleSelectProfession} />}
            {step === 2 && (
              <StepEntreprise
                data={formData}
                onChange={handleFieldChange}
                smsState={smsState}
                onSendSms={handleSendSms}
                onVerifySms={handleVerifySms}
              />
            )}
            {step === 3 && <StepCompte data={formData} onChange={handleFieldChange} />}
            {step === 4 && <StepPlan selected={selectedPlan} suggested={suggestedPlan} onSelect={setSelectedPlan} />}

            {/* Navigation */}
            <div className="mt-6 flex justify-between items-center">
              <div>
                {step > 1 && (
                  <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isLoading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Précédent
                  </Button>
                )}
              </div>
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || isLoading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 4 ? (
                  "Commencer l'essai gratuit (14 jours)"
                ) : (
                  <>Suivant <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>

            {/* Lien connexion */}
            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-sm text-gray-600">
                Déjà un compte ?{' '}
                <a href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">Se connecter</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
