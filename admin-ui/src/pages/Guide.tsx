/**
 * Page Guide / Mode d'emploi — Documentation intégrée à la plateforme
 * Accessible depuis le menu latéral, pas besoin de quitter l'app
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Search, Calendar, Users, Scissors, CreditCard, BarChart3,
  Bot, Shield, Star, ListChecks, FileText, Package, UserCog,
  Megaphone, Settings, ChevronDown, ChevronRight
} from 'lucide-react';

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  content: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'demarrage',
    icon: BookOpen,
    title: 'Premiers pas',
    content: [
      "Bienvenue sur NEXUS ! Après votre inscription, vous accédez à l'assistant d'onboarding qui configure votre espace selon votre type d'activité (salon, restaurant, hôtel, services à domicile).",
      "Votre tableau de bord affiche vos KPI essentiels : chiffre d'affaires, réservations du jour, taux de no-show et prochains rendez-vous.",
      "Commencez par ajouter vos services dans la section 'Services', puis vos premiers clients. Vous êtes prêt à recevoir des réservations !"
    ]
  },
  {
    id: 'agenda',
    icon: Calendar,
    title: 'Agenda & Réservations',
    content: [
      "L'agenda affiche vos rendez-vous au jour, à la semaine ou au mois. Cliquez sur un créneau vide pour créer une réservation rapide.",
      "Chaque réservation passe par les statuts : En attente → Confirmée → Terminée (ou Annulée). Terminer une prestation génère automatiquement la facture.",
      "Configurez vos horaires d'ouverture et périodes de fermeture dans 'Disponibilités'. Les créneaux indisponibles sont automatiquement bloqués.",
      "Pour les restaurants : gérez vos tables via le Plan de salle. Chaque table est une ressource avec sa capacité (nombre de places) et sa zone (intérieur, terrasse, salon privé). Quand toutes les tables sont réservées sur un créneau, le restaurant est automatiquement marqué comme complet.",
      "Pour les hôtels : le Calendrier des chambres affiche l'occupation en temps réel avec les arrivées et départs. Les réservations fonctionnent par nuitées (date d'arrivée → date de départ). Quand toutes les chambres sont occupées sur une période, l'hôtel est complet."
    ]
  },
  {
    id: 'clients',
    icon: Users,
    title: 'Gestion des clients',
    content: [
      "Le fichier clients centralise toutes les informations : coordonnées, historique des prestations, CA total, fréquence de visite et points de fidélité.",
      "Importez vos clients existants via CSV (bouton 'Importer CSV'). Le système détecte automatiquement les doublons par email.",
      "Les tags (VIP, PRO) permettent de segmenter rapidement. Cliquez sur un client pour voir son détail complet avec statistiques."
    ]
  },
  {
    id: 'services',
    icon: Scissors,
    title: 'Services & Prestations',
    content: [
      "Définissez vos services avec nom, durée, prix et catégorie. Les services sont utilisés pour les réservations et la facturation.",
      "Pour les restaurants : chaque table est un service. Créez un service par table avec le nombre de places (capacité), la zone (intérieur, terrasse, salon privé) et la disponibilité (midi, soir, midi et soir). La capacité totale de votre restaurant correspond à la somme des places de toutes vos tables actives.",
      "Exemple : 7 tables (Table 1: 2 places terrasse, Table 2: 4 places intérieur, Salon: 20 places privé) = 26 couverts. Quand un client réserve pour 4 personnes, le système attribue automatiquement la plus petite table disponible qui convient (ici, la table de 4 places).",
      "Activez/désactivez une table pour refléter des changements permanents (terrasse fermée en hiver, table en réparation). L'occupation par réservation est gérée automatiquement.",
      "Pour les hôtels : chaque chambre est un service avec son type (simple, double, suite, familiale), étage, vue, capacité maximale et équipements (WiFi, TV, climatisation, minibar...). Les Tarifs Saisonniers permettent de varier les prix selon les périodes (haute saison, basse saison, événements). Le prix affiché aux clients tient compte automatiquement de la saison.",
      "Exemple hôtel : Chambre Confort (double, 2 pers, 2e étage, vue jardin, 99€/nuit) — Suite Prestige (suite, 4 pers, 5e étage, vue mer, 249€/nuit). La disponibilité est calculée automatiquement : si une chambre est réservée du 15 au 18 mars, elle n'apparaît plus comme disponible sur ces dates.",
      "Le module Menu (restaurant uniquement) gère les catégories de plats, prix, allergènes et le menu du jour."
    ]
  },
  {
    id: 'fidelite',
    icon: Star,
    title: 'Programme Fidélité',
    content: [
      "Le programme de fidélité attribue automatiquement des points quand une prestation est terminée (par défaut : 1 point par euro).",
      "Configurez les règles dans Fidélité > Configuration : ratio points/euro, bonus inscription, validité, minimum d'utilisation.",
      "Le classement affiche vos meilleurs clients par points. Vous pouvez ajuster manuellement les points (geste commercial, correction).",
      "Les clients peuvent utiliser leurs points pour obtenir une remise sur leur prochaine prestation."
    ]
  },
  {
    id: 'waitlist',
    icon: ListChecks,
    title: 'Liste d\'attente',
    content: [
      "Quand un créneau est complet, ajoutez le client en liste d'attente avec sa date et son créneau souhaités.",
      "Si une annulation libère un créneau, le système notifie automatiquement le prochain client en attente.",
      "Vous pouvez notifier manuellement un client et convertir son attente en réservation confirmée.",
      "Priorisez les entrées (Normal, Haute, Urgente) pour gérer l'ordre de notification."
    ]
  },
  {
    id: 'facturation',
    icon: FileText,
    title: 'Facturation',
    content: [
      "Les factures sont générées automatiquement quand une prestation est terminée. Suivez leur statut (générée, envoyée, payée, en retard).",
      "Créez des factures manuelles, envoyez-les par email et suivez les paiements. Le module est accessible dès le plan Starter."
    ]
  },
  {
    id: 'comptabilite',
    icon: CreditCard,
    title: 'Comptabilité',
    badge: 'Pro',
    content: [
      "Le module Comptabilité regroupe 5 onglets : Compte de Résultat, Bilan, Rapprochement bancaire, Comptes Auxiliaires et Espace Expert-comptable.",
      "Le Compte de résultat affiche votre P&L (chiffre d'affaires, charges, résultat net) sur la période sélectionnée.",
      "Le Rapprochement bancaire permet de matcher vos écritures comptables avec vos relevés bancaires.",
      "Les Comptes Auxiliaires détaillent les comptes clients et fournisseurs.",
      "L'espace Expert-comptable donne accès aux journaux, grand livre et balance pour votre comptable."
    ]
  },
  {
    id: 'marketing',
    icon: Megaphone,
    title: 'Marketing & CRM',
    badge: 'Business',
    content: [
      "Segmentez vos clients avec le CRM : par CA, fréquence, ancienneté ou tags personnalisés.",
      "Les Workflows automatisent vos relances : email de bienvenue, relance après X jours sans visite, anniversaire client.",
      "Le Pipeline commercial suit vos opportunités de vente (devis → négociation → gagné/perdu).",
      "Les Campagnes permettent d'envoyer des emails/SMS ciblés avec A/B testing et analytics."
    ]
  },
  {
    id: 'stock',
    icon: Package,
    title: 'Stock & Inventaire',
    badge: 'Pro',
    content: [
      "Gérez vos produits avec suivi des quantités, alertes de stock bas et historique des mouvements.",
      "Créez des inventaires périodiques et suivez les écarts entre stock théorique et réel.",
      "Les produits peuvent être liés aux services pour un suivi automatique de la consommation."
    ]
  },
  {
    id: 'rh',
    icon: UserCog,
    title: 'RH & Planning',
    badge: 'Business',
    content: [
      "Gérez votre équipe : fiches employés, planning, congés et absences.",
      "L'organigramme visualise votre structure d'équipe. Le module Onboarding guide l'intégration des nouveaux arrivants.",
      "Les évaluations de performance permettent un suivi régulier avec objectifs et commentaires.",
      "Invitez des membres d'équipe via email — chacun a son rôle (admin, manager, viewer) avec permissions granulaires."
    ]
  },
  {
    id: 'ia',
    icon: Bot,
    title: 'Agents IA',
    badge: 'Pro',
    content: [
      "L'Agent IA Web est un chatbot 24/7 intégré à votre site. Il répond aux questions et prend les rendez-vous automatiquement.",
      "L'Agent IA Téléphone gère vos appels entrants : prise de RDV, informations, transfert vers un humain si nécessaire.",
      "L'Agent IA WhatsApp répond à vos clients sur WhatsApp avec les mêmes capacités que le chat web.",
      "Tous les agents sont entraînés sur vos données (services, horaires, FAQ) et respectent votre ton de communication.",
      "Pour les restaurants : l'IA connaît la capacité de chaque table, vérifie la disponibilité en temps réel et attribue automatiquement la meilleure table selon le nombre de convives. Si le restaurant est complet, elle propose un autre créneau (midi/soir) ou un autre jour.",
      "L'IA restaurant peut aussi renseigner vos clients sur la carte : plats disponibles, prix, menu du jour, suggestions du chef, allergènes et régimes alimentaires (végétarien, vegan, halal, sans gluten...). Pour cela, renseignez votre carte dans le module Menu.",
      "Pour les hôtels : l'IA connaît toutes vos chambres (type, capacité, étage, vue, équipements, prix avec tarifs saisonniers). Elle vérifie la disponibilité en temps réel pour des dates données, calcule le prix total du séjour et propose les chambres adaptées au nombre de personnes.",
      "L'IA hôtel peut aussi renseigner vos clients sur votre établissement : services, politique d'annulation, petit-déjeuner, parking, accès PMR, animaux, horaires check-in/check-out, etc. Pour cela, renseignez la section 'Informations hôtel' dans Paramètres > Activité."
    ]
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics & SEO',
    badge: 'Business',
    content: [
      "L'Analytics affiche votre rentabilité par service, marges et seuil de rentabilité.",
      "L'Anti-Churn identifie les clients à risque de départ et suggère des actions de rétention.",
      "Le SEO génère des articles optimisés pour votre référencement et gère votre fiche Google My Business."
    ]
  },
  {
    id: 'sentinel',
    icon: Shield,
    title: 'SENTINEL — Monitoring',
    badge: 'Business',
    content: [
      "SENTINEL est votre centre de contrôle : monitoring temps réel, alertes, métriques de performance.",
      "Suivez vos KPI business et techniques dans un seul dashboard avec historique 30 jours.",
      "Les alertes automatiques vous préviennent en cas d'anomalie (erreurs, performance, utilisation anormale)."
    ]
  },
  {
    id: 'parametres',
    icon: Settings,
    title: 'Paramètres & Abonnement',
    content: [
      "Gérez votre profil, mot de passe et authentification à deux facteurs (2FA) dans les Paramètres.",
      "La section Équipe permet d'inviter des collaborateurs avec des rôles et permissions personnalisés.",
      "Consultez et gérez votre abonnement (Starter, Pro, Business) dans 'Mon abonnement'. L'essai gratuit dure 14 jours.",
      "L'Audit Log enregistre toutes les actions effectuées sur la plateforme pour la traçabilité."
    ]
  }
];

export default function Guide() {
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('demarrage');

  const filteredSections = search
    ? GUIDE_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.content.some(c => c.toLowerCase().includes(search.toLowerCase()))
      )
    : GUIDE_SECTIONS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-cyan-500" />
          Mode d'emploi
        </h1>
        <p className="text-gray-500 mt-1">Guide complet d'utilisation de NEXUS</p>
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
        {filteredSections.map(section => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <Card key={section.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <span className="font-medium text-gray-900 flex-1">{section.title}</span>
                {section.badge && (
                  <Badge variant="secondary" className="text-xs">{section.badge}</Badge>
                )}
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />
                }
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 px-4 border-t">
                  <div className="space-y-3 mt-3">
                    {section.content.map((paragraph, i) => (
                      <p key={i} className="text-sm text-gray-600 leading-relaxed">
                        {search ? highlightText(paragraph, search) : paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun résultat pour "{search}"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 pt-4">
        <p>NEXUS v3.20.0 — Pour toute question, contactez support@nexus-ai-saas.com</p>
      </div>
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  );
}
