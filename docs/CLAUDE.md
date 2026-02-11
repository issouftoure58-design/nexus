# CLAUDE.md - Documentation du projet NEXUS

---

## ⚠️ REGLE FONDAMENTALE N°1 — LIRE EN PREMIER ⚠️

### NEXUS ≠ TENANT. CE SONT DEUX ENTITES DISTINCTES.

**NEXUS** est une **plateforme SaaS universelle** (fournisseur de service).
Les **tenants** (ex: Fat's Hair-Afro) sont des **clients de NEXUS** (consommateurs du service).

```
┌─────────────────────────────────────────────────┐
│                    NEXUS                         │
│         Plateforme universelle SaaS              │
│    (son propre site, sa propre identité)         │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ Tenant A │  │ Tenant B │  │ Tenant C │     │
│   │ (client) │  │ (client) │  │ (client) │     │
│   │ Son site │  │ Son site │  │ Son site │     │
│   └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────┘
```

**Relation** : CLIENT ↔ FOURNISSEUR. Les tenants paient un service. Ils ne font PAS partie de NEXUS.

**Conséquences obligatoires** :
1. **NEXUS a son propre site internet** — vitrine, inscription, connexion, gestion
2. **Chaque tenant a son propre site** — généré et hébergé par NEXUS
3. **JAMAIS confondre le site NEXUS avec un site tenant**
4. **JAMAIS afficher les données business d'un tenant dans l'interface NEXUS** (revenus, clients, réservations = données confidentielles du tenant)
5. **Sentinel/monitoring NEXUS** = santé TECHNIQUE de la plateforme (uptime, latence, sécurité, performance). PAS de métriques business tenant.
6. **NEXUS peut s'adapter à TOUT secteur d'activité** — coiffure, restaurant, médecin, etc.

**Si tu lis ce fichier et que tu ne respectes pas cette règle, TOUT ce que tu fais est faux.**

---

## 1. Contexte Business

### Premier tenant : Fat's Hair-Afro
- **Nom** : Fat's Hair-Afro
- **Type** : Coiffure afro à domicile (pas de salon physique)
- **Zone** : Franconville et toute l'Île-de-France
- **Téléphone** : 07 82 23 50 20 / 09 39 24 02 69
- **Spécialité** : Coiffure afro (tresses, locks, soins hydratants, brushing afro)

### Mode de fonctionnement
- **Service à domicile** : Fatou se déplace chez les clients
- **Chez Fatou** : Possibilité de venir chez elle à Franconville (sur demande)
- **Horaires flexibles** : Disponible en soirée et le week-end
- **Frais de déplacement** : Calculés automatiquement par Halimah selon la zone

### Services proposés
- Tresses (diverses styles)
- Locks (création et entretien)
- Soins hydratants
- Brushing afro
- Shampoing
- **Note** : Pas de lissage

### L'assistante IA "Halimah"
- Chatbot francophone pour accueillir les clients
- Vouvoiement obligatoire
- Ton chaleureux et professionnel
- Peut renseigner sur les services et horaires
- Aide à la prise de rendez-vous

---

## 2. Architecture du projet

### Structure des dossiers
```
halimah-project/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/        # Composants React
│   │   │   ├── ui/            # Composants shadcn/ui
│   │   │   ├── chat-input.tsx
│   │   │   └── chat-message.tsx
│   │   ├── hooks/             # Hooks personnalisés
│   │   │   ├── use-chat.ts    # Logique du chat
│   │   │   └── use-toast.ts
│   │   ├── pages/             # Pages de l'application
│   │   │   └── chat.tsx       # Interface principale
│   │   └── lib/               # Utilitaires
│   └── index.html
├── server/                    # Backend Express
│   ├── index.ts               # Point d'entrée serveur
│   ├── routes.ts              # Endpoints API
│   ├── schema.ts              # Schéma DB (Drizzle)
│   ├── db.ts                  # Configuration base de données
│   ├── storage.ts             # Stockage des messages
│   └── supabase.ts            # Client Supabase
├── shared/                    # Code partagé
│   ├── schema.ts              # Schéma des messages
│   └── routes.ts              # Définitions des routes API
├── script/
│   └── build.ts               # Script de build production
└── dist/                      # Build de production
```

### Stack technique
| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express, Node.js 20, Drizzle ORM |
| Base de données | PostgreSQL (Supabase) |
| IA | Anthropic Claude Sonnet 4 |
| Validation | Zod |

### Endpoints API

#### Chat
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/chat` | Envoyer un message à l'IA |

#### Rendez-vous
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/rendez-vous` | Lister tous les RDV (avec infos client) |
| GET | `/api/rendez-vous?date=YYYY-MM-DD` | Lister les RDV d'une date |
| GET | `/api/rendez-vous/:id` | Récupérer un RDV spécifique |
| POST | `/api/rendez-vous` | Créer un rendez-vous |
| PATCH | `/api/rendez-vous/:id/statut` | Modifier le statut d'un RDV |
| DELETE | `/api/rendez-vous/:id` | Supprimer un rendez-vous |

#### Administration (authentification requise)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/admin/login` | Connexion admin (body: `{password}`) |
| POST | `/api/admin/logout` | Déconnexion admin |
| GET | `/api/admin/verify` | Vérifier le token |
| GET | `/api/admin/rdv/aujourdhui` | RDV du jour (protégé) |

#### Utilitaires
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/test-db` | Tester la connexion DB |

### Pages Frontend
| Route | Description |
|-------|-------------|
| `/` | Interface de chat avec Halimah |
| `/admin` | Dashboard d'administration |

### Outils IA (Tool Use)
L'assistante Halimah dispose d'outils pour gérer les rendez-vous en temps réel :

| Outil | Description |
|-------|-------------|
| `list_services` | Liste les services avec prix et durées |
| `check_availability` | Vérifie si un créneau est disponible |
| `get_available_slots` | Retourne tous les créneaux libres d'une date |
| `create_appointment` | Crée un RDV en base de données |

**Fichier** : `server/ai-tools.ts`

### Schéma de la base de données
- **clients** : id, nom, prenom, telephone (unique), email, created_at
- **services** : id, nom, description, duree (minutes), prix (centimes)
- **rendezvous** : id, client_id, service_id, service_name, date, heure, statut, notes, timestamps
- **messages** : id, role, content, timestamp

---

## 3. Commandes importantes

### Développement
```bash
# Lancer le serveur de développement (frontend + backend)
npm run dev

# Vérification TypeScript
npm run check

# Lancer uniquement le serveur backend
npx tsx server/index.ts
```

### Base de données
```bash
# Pousser le schéma vers la base de données
npm run db:push

# Générer les migrations
npx drizzle-kit generate

# Ouvrir Drizzle Studio (interface DB)
npx drizzle-kit studio
```

### Production
```bash
# Build complet (client + serveur)
npm run build

# Démarrer en production
npm run start
# ou
NODE_ENV=production node dist/index.cjs
```

### Dépendances
```bash
# Installer les dépendances
npm install

# Ajouter un composant shadcn/ui
npx shadcn@latest add [nom-composant]
```

---

## 4. Standards de code

### Langue
- **Code** : Anglais (noms de variables, fonctions, commentaires techniques)
- **Contenu utilisateur** : Français (messages, labels, textes affichés)
- **Documentation** : Français

### TypeScript
- Mode strict activé (`strict: true`)
- Pas de `any` implicite
- Typage explicite des paramètres de fonctions
- Utiliser les interfaces pour les objets complexes

```typescript
// Bon
interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

function getClient(id: number): Promise<Client | null> {
  // ...
}

// Mauvais
function getClient(id): any {
  // ...
}
```

### Gestion des erreurs
- Toujours utiliser try/catch pour les appels async
- Logger les erreurs côté serveur
- Retourner des messages d'erreur clairs côté client
- Ne jamais exposer les détails techniques aux utilisateurs

```typescript
// Bon
try {
  const result = await apiCall();
  return { success: true, data: result };
} catch (error) {
  console.error('Erreur API:', error);
  return { success: false, message: 'Une erreur est survenue' };
}

// Mauvais
const result = await apiCall(); // Pas de gestion d'erreur
```

### Validation
- Utiliser Zod pour valider les entrées utilisateur
- Valider côté client ET côté serveur
- Définir les schémas dans `shared/` pour les réutiliser

```typescript
import { z } from 'zod';

const rendezVousSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  telephone: z.string().regex(/^0[1-9][0-9]{8}$/, 'Numéro invalide'),
  date: z.string(),
  heure: z.string(),
});
```

### Conventions de nommage
- **Composants React** : PascalCase (`ChatMessage.tsx`)
- **Hooks** : camelCase avec préfixe `use` (`useChat.ts`)
- **Fichiers utilitaires** : kebab-case (`db-functions.ts`)
- **Variables/fonctions** : camelCase
- **Constantes** : SCREAMING_SNAKE_CASE

### Structure des composants React
```typescript
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// 2. Types/Interfaces
interface Props {
  message: string;
  onSend: () => void;
}

// 3. Composant
export function ChatInput({ message, onSend }: Props) {
  // États
  const [value, setValue] = useState('');

  // Handlers
  const handleSubmit = () => {
    onSend();
  };

  // Rendu
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

---

## 5. Règles de sécurité

### Variables d'environnement
Les clés sensibles doivent TOUJOURS être dans des variables d'environnement :

```bash
# .env (NE JAMAIS COMMITER)
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Fichiers à ne jamais commiter
Le `.gitignore` doit inclure :
```
.env
.env.local
.env.production
*.pem
*.key
credentials.json
```

### Règles strictes
1. **JAMAIS de clés API dans le code source**
2. **JAMAIS de clés API dans les logs**
3. **JAMAIS de clés API côté client**
4. **JAMAIS commiter le fichier .env**

### Validation des entrées
- Toujours valider les entrées utilisateur (Zod)
- Échapper les données avant insertion SQL (Drizzle le fait automatiquement)
- Limiter la taille des entrées (messages, fichiers)

### Protection des routes
```typescript
// Vérifier que les variables d'environnement existent
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY manquante');
}

// Ne jamais exposer les erreurs techniques
app.use((err, req, res, next) => {
  console.error(err); // Log interne
  res.status(500).json({ message: 'Erreur serveur' }); // Message générique
});
```

### CORS
- Configurer CORS pour n'accepter que les origines autorisées en production
- Ne pas utiliser `cors({ origin: '*' })` en production

### Données sensibles des clients
- Chiffrer les données sensibles (emails, téléphones) si stockage long terme
- Respecter le RGPD (droit à l'oubli, export des données)
- Ne pas logger les informations personnelles

---

## Variables d'environnement requises

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL | Oui |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude) | Oui |
| `SUPABASE_URL` | URL du projet Supabase | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase | Oui |
| `ADMIN_PASSWORD` | Mot de passe admin (défaut: halimah2024) | Non |
| `PORT` | Port du serveur (défaut: 5000) | Non |
| `NODE_ENV` | Environnement (development/production) | Non |

**Important** : En production, changez le mot de passe admin par défaut !

---

## Ressources

- [Documentation React](https://react.dev)
- [Documentation Drizzle ORM](https://orm.drizzle.team)
- [Documentation shadcn/ui](https://ui.shadcn.com)
- [Documentation Anthropic](https://docs.anthropic.com)
- [Documentation Supabase](https://supabase.com/docs)
