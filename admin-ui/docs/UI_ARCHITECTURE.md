# NEXUS Admin UI - Architecture

## Vue d'ensemble

L'interface admin NEXUS est inspirée du design GitHub avec:
- **Menu hamburger global** pour la navigation principale
- **Tabs horizontaux** pour la navigation intra-service
- **Design system** cohérent avec dark mode support

## Structure des composants

```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # Layout principal avec header + hamburger
│   │   ├── GlobalMenu.tsx     # Menu slide-out navigation globale
│   │   └── ServiceLayout.tsx  # Layout pour pages service avec tabs
│   └── QuotaBar.tsx           # Barre de quota IA unifiée
├── pages/
│   ├── Home.tsx               # Dashboard avec modules + activité
│   ├── Subscription.tsx       # Page abonnement style ElevenLabs
│   ├── Reservations.tsx       # Exemple de page service avec tabs
│   └── ...
└── ...
```

## Layouts

### AppLayout

Layout racine utilisé par toutes les pages. Inclut:
- Header fixe avec hamburger, logo, recherche, notifications, avatar
- GlobalMenu (slide-out)
- Zone de contenu flexible

```tsx
<AppLayout>
  <Home />
</AppLayout>
```

### ServiceLayout

Layout pour les pages de service (Réservations, Clients, etc.). Inclut:
- Header avec icône + titre du service
- Zone actions (boutons)
- Tabs horizontaux pour navigation intra-service

```tsx
<ServiceLayout
  title="Réservations"
  icon={Calendar}
  tabs={[
    { label: 'Planning', path: '/reservations' },
    { label: 'Historique', path: '/reservations/historique' },
  ]}
  actions={<button>Nouveau RDV</button>}
>
  {/* Contenu de la page */}
</ServiceLayout>
```

## Navigation

### Menu Global (Hamburger)

Le menu slide-out contient:
1. **Home** - Dashboard principal
2. **Modules de base** - Réservations, Clients, Services
3. **Modules Pro** - Comptabilité, Stock, Marketing, RH (badge PRO)
4. **Modules Business** - Analytics (badge BUSINESS)
5. **Agent IA** - Configuration des agents
6. **Paramètres** - Mon abonnement, Paramètres

Les modules verrouillés affichent un badge (PRO/BUSINESS) et peuvent être grisés si non disponibles dans le plan actuel.

### Tabs Horizontaux (Services)

Chaque service a ses propres tabs pour naviguer entre les vues:
- **Réservations**: Planning | Historique | Paramètres
- **Clients**: Liste | Segments | Import
- **Services**: Catalogue | Catégories | Paramètres
- etc.

## Composants clés

### QuotaBar

Affiche la consommation globale des interactions IA (Web + WhatsApp + Téléphone combinés).

```tsx
<QuotaBar className="mb-6" />
```

Features:
- Progress bar avec couleurs dynamiques (cyan/amber/red)
- Compteur utilisé/limite
- Date de renouvellement
- Warnings à 75% et 90%
- Lien vers page abonnement

### Cards de stats

Pattern récurrent pour afficher des compteurs cliquables:

```tsx
<button className={`p-3 rounded-lg border transition-all ${
  isSelected ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200'
}`}>
  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
    Confirmé
  </span>
  <span className="text-xl font-bold">12</span>
</button>
```

## Design System

### Couleurs principales

| Usage | Light | Dark |
|-------|-------|------|
| Primary | `cyan-500/600` | `cyan-400` |
| Background | `white` | `gray-900/950` |
| Border | `gray-200` | `gray-800` |
| Text | `gray-900` | `white` |
| Text muted | `gray-500` | `gray-400` |

### Couleurs par statut

| Statut | Light | Dark |
|--------|-------|------|
| Confirmé | `blue-100/700` | `blue-900/400` |
| En attente | `amber-100/700` | `amber-900/400` |
| Terminé | `green-100/700` | `green-900/400` |
| Annulé | `red-100/700` | `red-900/400` |
| Demande | `gray-100/700` | `gray-800/300` |

### Couleurs par plan

| Plan | Color |
|------|-------|
| Starter | `gray` |
| Pro | `purple` |
| Business | `amber` |

## Pricing Philosophy

**IMPORTANT**: Tous les plans incluent TOUS les canaux IA:
- Agent Web (widget sur site)
- Agent WhatsApp
- Agent Téléphone

La différence entre les plans est:
1. **Quota d'interactions** (2000/10000/50000 par mois)
2. **Modules disponibles** (base/pro/business)
3. **Niveau de support** (email/prioritaire/dédié)

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERACTIONS IA                          │
│                                                             │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐                  │
│   │   Web   │ + │WhatsApp │ + │Téléphone│ = Quota mensuel  │
│   └─────────┘   └─────────┘   └─────────┘                  │
│                                                             │
│   Starter: 2 000 interactions/mois                          │
│   Pro:     10 000 interactions/mois                         │
│   Business: 50 000 interactions/mois                        │
└─────────────────────────────────────────────────────────────┘
```

## Responsive Design

- **Mobile** (<640px): Menu hamburger, colonnes empilées
- **Tablet** (640-1024px): Sidebar rétractable, grilles 2 colonnes
- **Desktop** (>1024px): Sidebar visible, grilles 3+ colonnes

## Dark Mode

Support complet via classes Tailwind `dark:`:
- Background: `bg-white dark:bg-gray-900`
- Text: `text-gray-900 dark:text-white`
- Borders: `border-gray-200 dark:border-gray-800`

Le toggle dark mode sera dans les paramètres utilisateur.

## Patterns de code

### Page Service Standard

```tsx
export default function ServicePage() {
  const tabs = [
    { label: 'Vue 1', path: '/service' },
    { label: 'Vue 2', path: '/service/vue2' },
  ];

  return (
    <ServiceLayout
      title="Mon Service"
      icon={ServiceIcon}
      tabs={tabs}
      actions={<Button>Action</Button>}
    >
      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        {/* ... */}
      </div>

      {/* Main content card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2>Titre section</h2>
        </div>
        <div className="p-4">
          {/* Content */}
        </div>
      </div>
    </ServiceLayout>
  );
}
```

### Boutons

```tsx
// Primary
<button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md">
  Action
</button>

// Secondary
<button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md">
  Secondary
</button>

// Ghost
<button className="px-4 py-2 text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
  Link
</button>
```

## Fichiers à créer pour nouvelles pages

1. Créer la page dans `src/pages/NomService.tsx`
2. Utiliser `ServiceLayout` avec tabs appropriés
3. Ajouter la route dans `App.tsx`
4. Ajouter l'entrée dans `GlobalMenu.tsx` (avec plan si nécessaire)
5. Ajouter le module dans `Home.tsx` si pertinent
