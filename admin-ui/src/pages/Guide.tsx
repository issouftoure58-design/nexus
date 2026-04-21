/**
 * Page Guide / Mode d'emploi — Documentation integree a la plateforme
 * v3.25.0 — Contenu dynamique adapte au business type du tenant
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/contexts/TenantContext';
import { useProfile, useBusinessTypeChecks } from '@/contexts/ProfileContext';
import {
  BookOpen, Search, Calendar, Users, Scissors, CreditCard,
  Bot, Shield, Star, ListChecks, FileText, Package, UserCog,
  Megaphone, Settings, ChevronDown, ChevronRight, ExternalLink,
  Lightbulb, LayoutDashboard, Clock, MessageSquare, ShoppingCart,
  UtensilsCrossed, BedDouble, TrendingUp, Share2, PieChart,

} from 'lucide-react';

// ---------------------------------------------------------------------------
// Terminologie adaptative par business type
// ---------------------------------------------------------------------------
const TERMINOLOGY: Record<string, { booking: string; client: string; staff: string; action: string; example: string }> = {
  service_domicile: { booking: 'intervention', client: 'client', staff: 'prestataire', action: 'intervenir', example: 'ex : coiffure a domicile, menage, jardinage' },
  salon: { booking: 'rendez-vous', client: 'client', staff: 'collaborateur', action: 'accueillir', example: 'ex : shampooing-coupe, coloration, soin visage' },
  restaurant: { booking: 'reservation', client: 'client', staff: 'serveur', action: 'servir', example: 'ex : reservation pour 4 personnes, service du soir' },
  hotel: { booking: 'reservation', client: 'hote', staff: 'receptionniste', action: 'heberger', example: 'ex : sejour 3 nuits, chambre double vue mer' },
  commerce: { booking: 'commande', client: 'client', staff: 'equipe', action: 'preparer', example: 'ex : commande Click & Collect, livraison' },
  security: { booking: 'mission', client: 'client', staff: 'agent', action: 'securiser', example: 'ex : mission surveillance, garde evenement' },
  service: { booking: 'rendez-vous', client: 'client', staff: 'collaborateur', action: 'accompagner', example: 'ex : consultation, seance de formation, coaching' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  path?: string;
  badge?: 'Starter' | 'Pro' | 'Business';
  condition: (checks: ReturnType<typeof useBusinessTypeChecks>) => boolean;
  content: (term: typeof TERMINOLOGY[string]) => string[];
  tip?: (term: typeof TERMINOLOGY[string]) => string;
}

// ---------------------------------------------------------------------------
// Quick links par business type
// ---------------------------------------------------------------------------
function getQuickLinks(businessType: string): { label: string; path: string; icon: React.ElementType }[] {
  const common = [
    { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
    { label: 'Clients', path: '/clients', icon: Users },
    { label: 'Parametres', path: '/parametres', icon: Settings },
  ];

  switch (businessType) {
    case 'restaurant':
      return [
        { label: 'Agenda', path: '/agenda', icon: Calendar },
        { label: 'Menu & Carte', path: '/menu', icon: UtensilsCrossed },
        { label: 'Plan de Salle', path: '/salle', icon: LayoutDashboard },
        ...common,
      ];
    case 'hotel':
      return [
        { label: 'Agenda', path: '/agenda', icon: Calendar },
        { label: 'Chambres', path: '/chambres', icon: BedDouble },
        ...common,
      ];
    case 'commerce':
      return [
        { label: 'Commandes', path: '/commandes', icon: ShoppingCart },
        { label: 'Stock', path: '/stock', icon: Package },
        ...common,
      ];
    default:
      return [
        { label: 'Agenda', path: '/agenda', icon: Calendar },
        { label: 'Services', path: '/services', icon: Scissors },
        ...common,
      ];
  }
}

// ---------------------------------------------------------------------------
// Badge couleur plan
// ---------------------------------------------------------------------------
function PlanBadge({ plan }: { plan: string }) {
  // Modele 2026 : free / starter / pro / business + aliases retro-compat
  const normalized = plan === 'basic' ? 'starter' : plan;
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    starter: 'bg-cyan-100 text-cyan-700',
    pro: 'bg-blue-100 text-blue-700',
    business: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[normalized] || colors.free}`}>
      {normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Free'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sections du guide (25 sections)
// ---------------------------------------------------------------------------
const always = () => true;
const notCommerce = (c: ReturnType<typeof useBusinessTypeChecks>) => !c.isCommerce;
const onlyRestaurant = (c: ReturnType<typeof useBusinessTypeChecks>) => !!c.isRestaurant;
const onlyHotel = (c: ReturnType<typeof useBusinessTypeChecks>) => !!c.isHotel;
const onlyCommerce = (c: ReturnType<typeof useBusinessTypeChecks>) => !!c.isCommerce;

const GUIDE_SECTIONS: GuideSection[] = [
  // 1. Premiers pas
  {
    id: 'demarrage',
    icon: BookOpen,
    title: 'Premiers pas',
    condition: always,
    content: (t) => [
      `Bienvenue sur NEXUS ! Apres votre inscription, l'assistant d'onboarding configure votre espace selon votre activite.`,
      `Votre tableau de bord affiche vos KPI essentiels : chiffre d'affaires, ${t.booking}s du jour, taux de no-show et prochains ${t.booking}s.`,
      `Commencez par ajouter vos services, puis vos premiers ${t.client}s. Vous etes pret a recevoir des ${t.booking}s !`,
    ],
    tip: (t) => `Astuce : completez votre profil dans Parametres > Activite pour que l'IA puisse renseigner vos ${t.client}s automatiquement.`,
  },
  // 2. Tableau de bord
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Tableau de bord',
    path: '/',
    condition: always,
    content: (t) => [
      `Le tableau de bord est votre vue d'ensemble quotidienne. Il affiche le CA du jour/semaine/mois, les ${t.booking}s a venir et les alertes.`,
      `Les widgets s'adaptent a votre activite : taux d'occupation, ${t.booking}s en attente, ${t.client}s recents, performances de l'equipe.`,
      `Cliquez sur n'importe quel KPI pour acceder au detail dans la page dediee.`,
    ],
  },
  // 3. Agenda & Reservations
  {
    id: 'agenda',
    icon: Calendar,
    title: 'Agenda & Reservations',
    path: '/agenda',
    condition: notCommerce,
    content: (t) => [
      `L'agenda affiche vos ${t.booking}s au jour, a la semaine ou au mois. Cliquez sur un creneau vide pour creer un(e) ${t.booking} rapide.`,
      `Chaque ${t.booking} passe par les statuts : En attente → Confirmee → Terminee (ou Annulee). Terminer genere automatiquement la facture.`,
      `Configurez vos horaires et periodes de fermeture dans Disponibilites. Les creneaux indisponibles sont automatiquement bloques.`,
    ],
    tip: (t) => `Astuce : glissez-deposez un(e) ${t.booking} pour le/la deplacer rapidement dans l'agenda.`,
  },
  // 4. Commandes (commerce)
  {
    id: 'commandes',
    icon: ShoppingCart,
    title: 'Commandes',
    path: '/commandes',
    condition: onlyCommerce,
    content: () => [
      `Gerez vos commandes Click & Collect et livraison depuis un seul ecran. Chaque commande affiche le detail, le statut et le mode de retrait.`,
      `Les statuts de commande : Nouvelle → En preparation → Prete → Livree (ou Annulee). Mettez a jour le statut en un clic.`,
      `Activez les notifications automatiques pour prevenir vos clients quand leur commande est prete.`,
    ],
    tip: () => `Astuce : utilisez le filtre par statut pour voir uniquement les commandes en preparation.`,
  },
  // 5. Clients
  {
    id: 'clients',
    icon: Users,
    title: 'Clients',
    path: '/clients',
    condition: always,
    content: (t) => [
      `Le fichier ${t.client}s centralise coordonnees, historique des ${t.booking}s, CA total, frequence et points de fidelite.`,
      `Importez vos ${t.client}s existants via CSV (bouton Importer CSV). Le systeme detecte les doublons par email.`,
      `Les tags (VIP, PRO) permettent de segmenter rapidement. Cliquez sur un ${t.client} pour voir son detail complet.`,
    ],
  },
  // 6. Services & Prestations
  {
    id: 'services',
    icon: Scissors,
    title: 'Services & Prestations',
    path: '/services',
    condition: notCommerce,
    content: (t) => [
      `Definissez vos services avec nom, duree, prix et categorie. Les services sont utilises pour les ${t.booking}s et la facturation.`,
      `Organisez par categories pour une meilleure lisibilite. Activez/desactivez un service sans le supprimer.`,
      `${t.example}.`,
    ],
  },
  // 7. Menu & Carte (restaurant)
  {
    id: 'menu',
    icon: UtensilsCrossed,
    title: 'Menu & Carte',
    path: '/menu',
    condition: onlyRestaurant,
    content: () => [
      `Gerez votre carte par categories (entrees, plats, desserts, boissons). Chaque plat a un nom, prix, description et allergenes.`,
      `Le Menu du jour est un espace special mis a jour quotidiennement. L'IA peut le communiquer a vos clients automatiquement.`,
      `Renseignez les allergenes (gluten, lactose, fruits a coque...) pour que l'IA puisse repondre aux questions dietetiques.`,
    ],
    tip: () => `Astuce : completez bien les allergenes — l'IA les utilise pour conseiller les clients vegetariens, vegan, sans gluten, etc.`,
  },
  // 8. Plan de Salle (restaurant)
  {
    id: 'salle',
    icon: LayoutDashboard,
    title: 'Plan de Salle',
    path: '/salle',
    condition: onlyRestaurant,
    content: () => [
      `Chaque table est un service avec sa capacite (nombre de places), sa zone (interieur, terrasse, salon prive) et sa disponibilite (midi, soir, les deux).`,
      `Exemple : 7 tables (Table 1: 2 places terrasse, Table 2: 4 places interieur, Salon: 20 places prive) = 26 couverts au total.`,
      `Quand un client reserve pour 4 personnes, le systeme attribue la plus petite table suffisante. Si toutes les tables sont prises, le creneau est marque complet.`,
      `Activez/desactivez une table pour les changements permanents (terrasse fermee en hiver, table en reparation).`,
    ],
  },
  // 9. Chambres & Tarifs (hotel)
  {
    id: 'chambres',
    icon: BedDouble,
    title: 'Chambres & Tarifs',
    path: '/chambres',
    condition: onlyHotel,
    content: () => [
      `Chaque chambre est definie par son type (simple, double, suite, familiale), etage, vue, capacite et equipements (WiFi, TV, climatisation, minibar).`,
      `Les Tarifs Saisonniers permettent de varier les prix selon les periodes (haute/basse saison, evenements). Le prix affiche tient compte automatiquement de la saison.`,
      `La disponibilite est calculee en temps reel : si une chambre est reservee du 15 au 18 mars, elle n'apparait plus sur ces dates.`,
      `Le Calendrier des chambres affiche l'occupation avec les arrivees et departs.`,
    ],
  },
  // 10. Disponibilites
  {
    id: 'disponibilites',
    icon: Clock,
    title: 'Disponibilites',
    path: '/disponibilites',
    condition: always,
    content: (t) => [
      `Configurez vos horaires d'ouverture jour par jour (lundi-dimanche) et vos periodes de fermeture exceptionnelles (conges, jours feries).`,
      `Les creneaux hors horaires sont automatiquement bloques dans l'agenda et pour l'IA.`,
      `Vos ${t.client}s et l'agent IA ne pourront pas prendre de ${t.booking} en dehors des creneaux definis.`,
    ],
  },
  // 11. Programme Fidelite
  {
    id: 'fidelite',
    icon: Star,
    title: 'Programme Fidelite',
    path: '/fidelite',
    condition: always,
    content: (t) => [
      `Le programme attribue automatiquement des points quand un(e) ${t.booking} est terminee (par defaut : 1 point par euro).`,
      `Configurez les regles : ratio points/euro, bonus inscription, validite, minimum d'utilisation.`,
      `Le classement affiche vos meilleurs ${t.client}s par points. Ajustez manuellement si besoin (geste commercial).`,
    ],
  },
  // 12. Liste d'attente
  {
    id: 'waitlist',
    icon: ListChecks,
    title: "Liste d'attente",
    path: '/waitlist',
    condition: notCommerce,
    content: (t) => [
      `Quand un creneau est complet, ajoutez le ${t.client} en liste d'attente avec sa date et son creneau souhaites.`,
      `Si une annulation libere un creneau, le systeme notifie automatiquement le prochain ${t.client} en attente.`,
      `Priorisez les entrees (Normal, Haute, Urgente) pour gerer l'ordre de notification.`,
    ],
  },
  // 13. Avis Clients
  {
    id: 'avis',
    icon: MessageSquare,
    title: 'Avis Clients',
    path: '/avis-clients',
    condition: always,
    content: (t) => [
      `Consultez et gerez les avis laisses par vos ${t.client}s. Repondez directement depuis la plateforme.`,
      `Les avis positifs renforcent votre reputation en ligne. Les avis negatifs vous permettent d'ameliorer votre service.`,
      `Activez les demandes d'avis automatiques apres chaque ${t.booking} terminee.`,
    ],
  },
  // 14. Facturation
  {
    id: 'facturation',
    icon: FileText,
    title: 'Facturation',
    path: '/facturation',
    condition: always,
    content: (t) => [
      `Les factures sont generees automatiquement a la fin d'un(e) ${t.booking}. Suivez leur statut : generee, envoyee, payee, en retard.`,
      `Creez des factures manuelles, envoyez-les par email et suivez les paiements.`,
    ],
  },
  // 15. Devis
  {
    id: 'devis',
    icon: FileText,
    title: 'Devis',
    path: '/devis',
    badge: 'Starter',
    condition: always,
    content: (t) => [
      `Creez des devis professionnels pour vos ${t.client}s. Chaque devis peut etre converti en facture en un clic.`,
      `Suivez le statut : brouillon, envoye, accepte, refuse. Les devis acceptes alimentent votre pipeline commercial.`,
    ],
  },
  // 16. Comptabilite
  {
    id: 'comptabilite',
    icon: CreditCard,
    title: 'Comptabilite',
    path: '/comptabilite',
    badge: 'Business',
    condition: always,
    content: () => [
      `5 onglets : Compte de Resultat, Bilan, Rapprochement bancaire, Comptes Auxiliaires et Espace Expert-comptable.`,
      `Le Compte de resultat affiche votre P&L (CA, charges, resultat net) sur la periode selectionnee.`,
      `Le Rapprochement bancaire matche vos ecritures avec vos releves. L'espace Expert-comptable donne acces aux journaux, grand livre et balance.`,
    ],
  },
  // 17. Stock & Inventaire
  {
    id: 'stock',
    icon: Package,
    title: 'Stock & Inventaire',
    path: '/stock',
    badge: 'Starter',
    condition: always,
    content: () => [
      `Gerez vos produits avec suivi des quantites, alertes de stock bas et historique des mouvements.`,
      `Creez des inventaires periodiques et suivez les ecarts entre stock theorique et reel.`,
      `Les produits peuvent etre lies aux services pour un suivi automatique de la consommation.`,
    ],
  },
  // 18. Agents IA
  {
    id: 'ia',
    icon: Bot,
    title: 'Agents IA',
    path: '/ia-admin',
    condition: always,
    content: (t) => [
      `L'Agent IA Web est un chatbot 24/7 integre a votre site. Il repond aux questions et prend les ${t.booking}s automatiquement.`,
      `L'Agent IA Telephone (Starter) gere vos appels entrants : prise de ${t.booking}, informations, transfert vers un humain. Consomme des credits IA a l'usage.`,
      `L'Agent IA WhatsApp (Starter) repond a vos ${t.client}s sur WhatsApp avec les memes capacites. Consomme des credits IA a l'usage.`,
      `Tous les agents sont entraines sur vos donnees (services, horaires, FAQ) et respectent votre ton de communication.`,
    ],
    tip: (t) => `Astuce : renseignez bien vos services et horaires — plus l'IA a d'informations, mieux elle repond a vos ${t.client}s.`,
  },
  // 19. Marketing & CRM
  {
    id: 'marketing',
    icon: Megaphone,
    title: 'Marketing & CRM',
    path: '/segments',
    badge: 'Starter',
    condition: always,
    content: (t) => [
      `Segmentez vos ${t.client}s avec le CRM : par CA, frequence, anciennete ou tags personnalises.`,
      `Les Workflows automatisent vos relances : email de bienvenue, relance apres X jours, anniversaire ${t.client}.`,
      `Les Campagnes permettent d'envoyer des emails/SMS cibles avec A/B testing et analytics.`,
    ],
  },
  // 20. Pipeline Commercial
  {
    id: 'pipeline',
    icon: TrendingUp,
    title: 'Pipeline Commercial',
    path: '/pipeline',
    badge: 'Starter',
    condition: always,
    content: () => [
      `Suivez vos opportunites de vente avec un pipeline visuel : prospection → contact → devis → negociation → gagne/perdu.`,
      `Chaque opportunite est liee a un client et un montant estime. Suivez votre taux de conversion et previsionnel.`,
    ],
  },
  // 21. Reseaux Sociaux
  {
    id: 'reseaux',
    icon: Share2,
    title: 'Reseaux Sociaux',
    path: '/reseaux-sociaux',
    badge: 'Starter',
    condition: always,
    content: () => [
      `Planifiez et publiez vos posts sur vos reseaux sociaux directement depuis NEXUS.`,
      `L'IA peut generer des suggestions de posts adaptes a votre activite avec hashtags pertinents.`,
    ],
  },
  // 22. RH & Planning
  {
    id: 'rh',
    icon: UserCog,
    title: 'RH & Planning',
    path: '/rh',
    badge: 'Business',
    condition: always,
    content: (t) => [
      `Gerez votre equipe : fiches ${t.staff}s, planning, conges et absences.`,
      `L'organigramme visualise votre structure. Le module Onboarding guide l'integration des nouveaux arrivants.`,
      `Invitez des membres via email — chacun a son role (admin, manager, viewer) avec permissions granulaires.`,
    ],
  },
  // 23. Analytics & SEO
  {
    id: 'analytics',
    icon: PieChart,
    title: 'Analytics & SEO',
    path: '/seo',
    badge: 'Starter',
    condition: always,
    content: () => [
      `L'Analytics affiche votre rentabilite par service, marges et seuil de rentabilite.`,
      `L'Anti-Churn identifie les clients a risque de depart et suggere des actions de retention.`,
      `Le SEO genere des articles optimises pour votre referencement et gere votre fiche Google My Business.`,
    ],
  },
  // 24. SENTINEL
  {
    id: 'sentinel',
    icon: Shield,
    title: 'SENTINEL — Monitoring',
    path: '/sentinel',
    badge: 'Business',
    condition: always,
    content: () => [
      `SENTINEL est votre centre de controle : monitoring temps reel, alertes, metriques de performance.`,
      `Suivez vos KPI business et techniques dans un seul dashboard avec historique 30 jours.`,
      `Les alertes automatiques vous previennent en cas d'anomalie (erreurs, performance, utilisation anormale).`,
    ],
  },
  // 25. Parametres & Abonnement
  {
    id: 'parametres',
    icon: Settings,
    title: 'Parametres & Abonnement',
    path: '/parametres',
    condition: always,
    content: (t) => [
      `Gerez votre profil, mot de passe et authentification a deux facteurs (2FA).`,
      `La section Equipe permet d'inviter des ${t.staff}s avec des roles et permissions personnalises.`,
      `Consultez et gerez votre abonnement (Free, Starter 69€/mois avec 1 000 credits IA inclus, Pro 199€/mois avec 5 000 credits, Business 599€/mois avec 20 000 credits) dans "Mon abonnement". L'essai Starter gratuit dure 14 jours puis votre compte bascule sur Free sans frais.`,
      `La section Activite permet de decrire votre etablissement — ces informations sont utilisees par l'IA pour renseigner vos ${t.client}s.`,
    ],
  },
];

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
export default function Guide() {
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('demarrage');
  const navigate = useNavigate();

  const { name, plan } = useTenantContext();
  const { businessType } = useProfile();
  const checks = useBusinessTypeChecks();

  const term = TERMINOLOGY[businessType] || TERMINOLOGY.salon;

  // Filtrage : condition business type + recherche texte
  const visibleSections = useMemo(() => {
    const filtered = GUIDE_SECTIONS.filter(s => s.condition(checks));
    if (!search) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content(term).some(c => c.toLowerCase().includes(q))
    );
  }, [checks, search, term]);

  const quickLinks = useMemo(() => getQuickLinks(businessType), [businessType]);

  const badgeColor: Record<string, string> = {
    Starter: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    Pro: 'bg-blue-100 text-blue-700 border-blue-200',
    Business: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-6">
      {/* Header personnalise */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-cyan-500" />
          Guide de {name || 'votre entreprise'}
        </h1>
        <p className="text-gray-500 mt-1 flex items-center gap-2">
          Mode d'emploi complet de NEXUS
          <PlanBadge plan={plan} />
        </p>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        {quickLinks.map(link => {
          const Icon = link.icon;
          return (
            <Button
              key={link.path}
              variant="outline"
              size="sm"
              onClick={() => navigate(link.path)}
              className="gap-1.5"
            >
              <Icon className="w-3.5 h-3.5" />
              {link.label}
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher dans le guide..."
          className="pl-10"
        />
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {visibleSections.map(section => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;
          const paragraphs = section.content(term);

          return (
            <Card key={section.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <span className="font-medium text-gray-900 flex-1">{section.title}</span>
                {section.badge && (
                  <Badge variant="secondary" className={`text-xs border ${badgeColor[section.badge] || ''}`}>
                    {section.badge}
                  </Badge>
                )}
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />
                }
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 px-4 border-t">
                  <div className="space-y-3 mt-3">
                    {paragraphs.map((paragraph, i) => (
                      <p key={i} className="text-sm text-gray-600 leading-relaxed">
                        {search ? highlightText(paragraph, search) : paragraph}
                      </p>
                    ))}

                    {/* Astuce */}
                    {section.tip && (
                      <div className="flex gap-2 p-3 bg-cyan-50 rounded-lg mt-2">
                        <Lightbulb className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-cyan-800">{section.tip(term)}</p>
                      </div>
                    )}

                    {/* Bouton Acceder */}
                    {section.path && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(section.path!)}
                          className="gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Acceder
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {visibleSections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun resultat pour "{search}"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 pt-4">
        <p>NEXUS v3.25.0 — Pour toute question, contactez contact@nexus-ai-saas.com</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlight recherche
// ---------------------------------------------------------------------------
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  );
}
