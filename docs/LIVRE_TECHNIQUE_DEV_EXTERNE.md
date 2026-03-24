# LIVRE TECHNIQUE — DÉVELOPPEUR EXTERNE

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                          NEXUS — GUIDE TECHNIQUE                             ║
║                         DÉVELOPPEUR EXTERNE v1.0                             ║
║                                                                              ║
║                     Classification : CONFIDENTIEL                            ║
║                     Date : Mars 2026                                         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Table des matières

1. [Avertissement & Confidentialité](#1-avertissement--confidentialité)
2. [Présentation NEXUS](#2-présentation-nexus)
3. [Architecture Globale](#3-architecture-globale)
4. [Arborescence du Projet](#4-arborescence-du-projet)
5. [Installation & Environnement](#5-installation--environnement)
6. [LOI FONDAMENTALE — TENANT SHIELD](#6-loi-fondamentale--tenant-shield)
7. [Chaîne de Middlewares](#7-chaîne-de-middlewares)
8. [Conventions de Code](#8-conventions-de-code)
9. [Structure d'une Route](#9-structure-dune-route)
10. [Structure d'un Service](#10-structure-dun-service)
11. [Frontend — Pages & Composants](#11-frontend--pages--composants)
12. [Base de Données](#12-base-de-données)
13. [Tests](#13-tests)
14. [Workflow Git](#14-workflow-git)
15. [Zones INTERDITES](#15-zones-interdites-)
16. [Zones de Travail AUTORISÉES](#16-zones-de-travail-autorisées-)
17. [Checklist avant PR](#17-checklist-avant-pr)
18. [Communication & Livrables](#18-communication--livrables)
19. [Contacts](#19-contacts)
20. [Annexe — Variables d'environnement](#20-annexe--variables-denvironnement)

---

## 1. Avertissement & Confidentialité

### Classification

Ce document est classifié **CONFIDENTIEL**. Sa diffusion est strictement limitée aux personnes autorisées par le fondateur de NEXUS.

### NDA obligatoire

**Aucun accès au code source ne sera accordé avant la signature d'un accord de non-divulgation (NDA).**

Le NDA couvre :
- Le code source et l'architecture technique
- Les algorithmes et logiques métier propriétaires
- Les stratégies commerciales et tarifaires
- Les données clients et les secrets d'infrastructure

### Obligations du développeur externe

- Ne **jamais** partager, copier ou reproduire le code en dehors du cadre de la mission
- Ne **jamais** publier, bloguer ou mentionner les détails techniques de NEXUS
- Ne **jamais** stocker le code source sur un dépôt personnel ou public
- Supprimer toute copie locale du code à la fin de la mission
- Signaler immédiatement toute fuite ou tentative d'accès non autorisé

### Sanctions

Toute violation du NDA expose le contrevenant à des poursuites judiciaires conformément aux clauses du contrat signé.

---

## 2. Présentation NEXUS

### Vue d'ensemble

NEXUS est une plateforme SaaS **multi-tenant** B2B destinée à la gestion complète d'entreprises de services. Chaque client (tenant) dispose de son propre espace isolé avec ses données, sa configuration et ses fonctionnalités.

### Secteurs d'activité supportés

| Secteur | Exemples |
|---------|----------|
| Salon | Coiffure, esthétique, barbier |
| Restaurant | Restauration traditionnelle, fast-food |
| Hôtel | Hôtellerie, chambres d'hôtes |
| Commerce | Boutiques, e-commerce |
| Sécurité | Gardiennage, surveillance |
| Service à domicile | Plomberie, ménage, livraison |

### Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend (Admin) | React 18 + Vite + TypeScript + Tailwind CSS |
| Frontend (Landing) | React + Vite + JSX |
| Backend | Express.js + Node.js |
| Base de données | Supabase (PostgreSQL + RLS) |
| Paiements | Stripe |
| Communications | Twilio (SMS, WhatsApp, Voix) + Resend (Email) |
| Files d'attente | BullMQ + Redis |
| Tests | Jest (backend) + Vitest (frontend) + Playwright (E2E) |

### Principe fondamental

> Chaque donnée appartient à UN tenant. Aucune donnée ne doit jamais fuiter entre tenants.

Ce principe est détaillé dans la [section 6 — TENANT SHIELD](#6-loi-fondamentale--tenant-shield).

---

## 3. Architecture Globale

### Schéma des applications

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└─────────────┬──────────────┬──────────────────┬─────────────────┘
              │              │                  │
              ▼              ▼                  ▼
┌─────────────────┐ ┌───────────────┐ ┌────────────────┐
│   admin-ui      │ │   landing     │ │   Webhooks     │
│   (React/TS)    │ │   (React/JSX) │ │   (Stripe,     │
│   Port 3001     │ │   Port 3000   │ │    Twilio...)  │
└────────┬────────┘ └───────┬───────┘ └───────┬────────┘
         │                  │                  │
         │   /api proxy     │   /api proxy     │
         ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────┐
│                    BACKEND                            │
│                Express.js — Port 5000                 │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Middleware │→ │ Routes   │→ │ Services │          │
│  │ Chain    │  │ (/api/*) │  │          │          │
│  └──────────┘  └──────────┘  └────┬─────┘          │
│                                    │                 │
└────────────────────────────────────┼─────────────────┘
                                     │
              ┌──────────────────────┼───────────────────┐
              │                      │                    │
              ▼                      ▼                    ▼
     ┌────────────────┐    ┌────────────────┐   ┌──────────────┐
     │   Supabase     │    │     Redis      │   │   Services   │
     │  (PostgreSQL)  │    │   (BullMQ)     │   │   externes   │
     │                │    │                │   │ (Stripe,     │
     └────────────────┘    └────────────────┘   │  Twilio...)  │
                                                └──────────────┘
```

### Flux d'une requête typique

```
1. Client (navigateur) envoie une requête
2. Vite proxy redirige /api/* vers Express (port 5000)
3. Express applique la chaîne de middlewares :
   a. Sécurité (Helmet, CORS, Rate Limit)
   b. Parsing (JSON, URL-encoded)
   c. Résolution du tenant (X-Tenant-ID header)
   d. Tenant Shield (validation isolation)
   e. Audit + RBAC (routes admin)
   f. Authentification JWT
4. Le handler de route exécute la logique métier
5. Le service interroge Supabase AVEC filtre tenant_id
6. La réponse JSON est renvoyée au client
```

### Ports

| Application | Port | Usage |
|-------------|------|-------|
| admin-ui | 3001 | Interface d'administration |
| landing | 3000 | Site vitrine |
| backend | 5000 | API REST |

---

## 4. Arborescence du Projet

```
nexus/
├── admin-ui/                  ✅ Frontend React/TS — Zone de travail
│   ├── src/
│   │   ├── components/        ✅ Composants réutilisables
│   │   ├── pages/             ✅ Pages (1 page = 1 route)
│   │   ├── hooks/             ✅ Custom hooks React
│   │   ├── contexts/          ✅ Contexts (Tenant, Profile)
│   │   ├── lib/               ✅ API client, utilitaires
│   │   ├── types/             ✅ Types TypeScript
│   │   └── __tests__/         ✅ Tests unitaires Vitest
│   ├── e2e/                   ⚠️  Tests E2E (ne pas modifier les existants)
│   ├── public/                ✅ Assets statiques
│   └── vite.config.ts         ⚠️  Config Vite (modifier avec précaution)
│
├── backend/
│   ├── src/
│   │   ├── routes/            ✅ Routes Express (selon mission)
│   │   ├── services/          ✅ Services métier (selon mission)
│   │   ├── middleware/        🔒 Middlewares (NE PAS MODIFIER)
│   │   ├── config/            🔒 Configuration (NE PAS MODIFIER)
│   │   ├── core/              🔒 Moteur propriétaire
│   │   ├── sentinel/          🔒 Monitoring propriétaire
│   │   ├── ai/                🔒 Intelligence artificielle
│   │   ├── prompts/           🔒 Prompts IA
│   │   ├── templates/         🔒 Templates métier
│   │   ├── tools/             🔒 Outils IA
│   │   ├── modules/           ⚠️  Modules (selon mission)
│   │   ├── jobs/              🔒 Tâches planifiées
│   │   ├── queues/            🔒 Files d'attente
│   │   ├── sql/               ⚠️  Migrations (avec validation)
│   │   ├── tests/             ✅ Tests Jest
│   │   └── utils/             ✅ Utilitaires
│   └── scripts/               🔒 Scripts d'administration
│
├── landing/                   ⚠️  Landing page (selon mission)
│
├── docs/                      🔒 Documentation interne
│   ├── business-plan/         🔒 Stratégie commerciale
│   └── legal/                 🔒 Documents juridiques
│
├── .husky/                    🔒 Git hooks (pre-commit automatique)
├── .env.example               📋 Template variables d'environnement
└── package.json               📋 Config monorepo
```

**Légende :**
- ✅ Zone de travail autorisée
- ⚠️ Modification possible avec validation du fondateur
- 🔒 Zone INTERDITE — ne pas modifier
- 📋 Lecture seule

---

## 5. Installation & Environnement

### Prérequis

- Node.js 18+ (LTS recommandé)
- npm 9+
- Git
- Redis (local ou distant)
- Un éditeur de code (VS Code recommandé)

### Installation

```bash
# 1. Cloner le dépôt (accès fourni par le fondateur)
git clone <url-fournie-par-le-fondateur>
cd nexus

# 2. Installer les dépendances
cd backend && npm install
cd ../admin-ui && npm install
cd ../landing && npm install

# 3. Configurer l'environnement
# Le fondateur vous fournira les fichiers .env pré-remplis
# Placer le .env dans /backend/.env
```

### Fichier `.env`

Le fondateur fournit le fichier `.env` pré-rempli. **Règles strictes :**

- **NE JAMAIS** commiter un fichier `.env`
- **NE JAMAIS** partager les valeurs des variables
- **NE JAMAIS** écrire les valeurs en dur dans le code
- **NE JAMAIS** copier le `.env` en dehors du projet
- Le `.gitignore` bloque déjà les fichiers `.env`

Pour la liste complète des variables (sans valeurs), voir [Annexe — Variables d'environnement](#20-annexe--variables-denvironnement).

### Démarrage

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend Admin
cd admin-ui
npm run dev

# Terminal 3 — Landing (si nécessaire)
cd landing
npm run dev
```

### Vérification

- Backend : http://localhost:5000/health → doit retourner `{ status: "ok" }`
- Admin-UI : http://localhost:3001 → page de login
- Landing : http://localhost:3000 → page d'accueil

---

## 6. LOI FONDAMENTALE — TENANT SHIELD

### Pourquoi c'est critique

NEXUS est **multi-tenant** : plusieurs entreprises partagent la même base de données. Un bug d'isolation = fuite de données entre clients = **catastrophe**.

### La règle absolue

> **CHAQUE requête vers Supabase DOIT inclure `.eq('tenant_id', tenantId)`**

Il n'y a **aucune exception** à cette règle pour les tables métier.

### Exemples

```javascript
// ❌ INTERDIT — Requête sans filtre tenant
const { data } = await supabase
  .from('clients')
  .select('*');

// ✅ OBLIGATOIRE — Toujours filtrer par tenant_id
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_id', tenantId);
```

```javascript
// ❌ INTERDIT — Fallback de tenant_id
const tenant = tenantId || 'default';

// ✅ OBLIGATOIRE — Erreur si pas de tenant
if (!tenantId) throw new Error('tenant_id requis');
```

```javascript
// ❌ INTERDIT — INSERT sans tenant_id
await supabase.from('clients').insert({ nom: 'Dupont' });

// ✅ OBLIGATOIRE — INSERT avec tenant_id
await supabase.from('clients').insert({
  nom: 'Dupont',
  tenant_id: tenantId
});
```

### Linter automatique

Un linter dédié (`npm run lint:tenant`) analyse **tout le code** et bloque les requêtes Supabase sans filtre `tenant_id`. Ce linter est exécuté automatiquement en pre-commit.

Si le linter échoue, le commit est **refusé**.

### Fonction helper

Dans les fonctions backend, `tenantId` est **toujours le premier paramètre** :

```javascript
async function getClients(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  return supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId);
}
```

---

## 7. Chaîne de Middlewares

### Ordre d'exécution

Chaque requête traverse ces middlewares dans l'ordre exact :

```
Requête HTTP
    │
    ▼
┌──────────────────────────────────────┐
│ 1. helmet()                          │ Sécurité HTTP (headers)
│ 2. compression()                     │ Compression GZIP
│ 3. cors()                           │ Contrôle des origines
│ 4. rateLimiter                       │ Protection anti-abus
├──────────────────────────────────────┤
│ 5. express.json()                    │ Parsing du body JSON
│ 6. express.urlencoded()              │ Parsing des formulaires
├──────────────────────────────────────┤
│ 7. resolveTenantByDomain()           │ Identifie le tenant (header X-Tenant-ID)
│ 8. tenantShield({ strict: true })    │ Valide l'isolation tenant
│ 9. validateBodyTenant()              │ Vérifie cohérence body.tenant_id
├──────────────────────────────────────┤
│ 10. auditLogMiddleware()             │ Journalise les mutations (POST/PUT/PATCH/DELETE)
│ 11. rbacMiddleware()                 │ Contrôle d'accès par rôle
├──────────────────────────────────────┤
│ 12. authenticateAdmin                │ Vérifie le JWT et extrait l'admin
│ 13. validate(schema)                 │ Validation Zod du body/query
│ 14. [Handler de route]               │ Logique métier
├──────────────────────────────────────┤
│ 15. 404 handler                      │ Route non trouvée
│ 16. Global error handler             │ Capture et log des erreurs
└──────────────────────────────────────┘
```

### Rôle de chaque middleware

| Middleware | Rôle |
|-----------|------|
| `helmet` | Ajoute des headers de sécurité HTTP (CSP, HSTS, X-Frame) |
| `compression` | Compresse les réponses GZIP (seuil 1024 bytes) |
| `cors` | Autorise uniquement les origines listées dans CORS_ORIGIN |
| `rateLimiter` | Limite le nombre de requêtes par IP par fenêtre de temps |
| `resolveTenantByDomain` | Extrait le tenant_id depuis le header, domaine ou sous-domaine |
| `tenantShield` | Bloque toute requête sans tenant_id valide |
| `validateBodyTenant` | Vérifie que body.tenant_id correspond au tenant de la session |
| `auditLogMiddleware` | Enregistre les opérations d'écriture dans la table historique_admin |
| `rbacMiddleware` | Vérifie le rôle (admin, manager, viewer) et les permissions |
| `authenticateAdmin` | Vérifie le token JWT et injecte req.admin |
| `validate` | Valide le body/query avec un schéma Zod |
| `checkPlan` | Vérifie que le module est inclus dans le plan du tenant |
| `quotas` | Vérifie que les quotas du plan ne sont pas dépassés |

### Comment le tenant_id arrive dans la requête

```
1. Le frontend envoie le header X-Tenant-ID avec chaque requête
2. resolveTenantByDomain() lit ce header et attache req.tenantId
3. tenantShield() vérifie que req.tenantId existe
4. authenticateAdmin() vérifie le JWT et extrait req.admin.tenant_id
5. Dans le handler, utiliser req.admin.tenant_id pour les requêtes DB
```

---

## 8. Conventions de Code

### Imports

```javascript
// 1. Services et config internes
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { validate } from '../middleware/validate.js';

// 2. Bibliothèques externes
import express from 'express';
import { z } from 'zod';
```

### Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Fonctions | camelCase | `getClientById()` |
| Variables | camelCase | `tenantId`, `clientData` |
| Colonnes DB | snake_case | `tenant_id`, `created_at` |
| Routes | kebab-case | `/api/admin/order-tracking` |
| Fichiers backend | camelCase | `adminClients.js` |
| Fichiers frontend | PascalCase (pages/composants) | `Dashboard.tsx` |
| Types TS | PascalCase | `ClientData`, `ReservationInput` |

### Fonctions backend

```javascript
// tenantId TOUJOURS en premier paramètre
async function getClients(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return data;
}
```

### Routes Express

```javascript
// req.admin.tenant_id est injecté par le middleware authenticateAdmin
router.get('/', authenticateAdmin, async (req, res) => {
  const tenantId = req.admin.tenant_id;
  // ... logique avec tenantId
});
```

### Règles strictes

- **Pas de `console.log`** en production — utiliser le logger Winston
- **Pas de TODO** dans le code — ouvrir une issue ou en parler
- **Pas de secrets en dur** — tout vient du `.env`
- **Pas de `any`** en TypeScript — typer toutes les variables
- **Pas de requête DB sans `tenant_id`** — jamais
- **Extension `.js`** dans les imports backend (ESM)

---

## 9. Structure d'une Route

### Template GET (lecture)

```javascript
import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// GET /api/admin/exemple
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('ma_table')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('GET /exemple error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

### Template POST (création)

```javascript
import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// Schéma de validation Zod
const createSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  description: z.string().optional(),
});

// POST /api/admin/exemple
router.post('/', authenticateAdmin, validate(createSchema), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('ma_table')
      .insert({
        ...req.body,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('POST /exemple error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

### Template PATCH (modification)

```javascript
// PATCH /api/admin/exemple/:id
router.patch('/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('ma_table')
      .update(req.body)
      .eq('id', id)
      .eq('tenant_id', tenantId) // TOUJOURS filtrer par tenant
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Non trouvé' });

    res.json(data);
  } catch (err) {
    console.error('PATCH /exemple error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

### Template DELETE (suppression)

```javascript
// DELETE /api/admin/exemple/:id
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('ma_table')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId); // TOUJOURS filtrer par tenant

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /exemple error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

### Enregistrement d'une route

Dans `/backend/src/index.js`, les routes sont montées ainsi :

```javascript
import exempleRoutes from './routes/adminExemple.js';

// Dans la section des routes admin
app.use('/api/admin/exemple', exempleRoutes);
```

**Important :** Demander au fondateur d'ajouter la route dans `index.js` si vous n'avez pas accès à ce fichier.

---

## 10. Structure d'un Service

### Template de service

```javascript
import { supabase } from '../config/supabase.js';

/**
 * Récupère les éléments d'un tenant avec filtres optionnels.
 */
export async function getElements(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  let query = supabase
    .from('ma_table')
    .select('*')
    .eq('tenant_id', tenantId);

  // Filtres optionnels
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.ilike('nom', `%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Crée un élément pour un tenant.
 */
export async function createElement(tenantId, payload) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('ma_table')
    .insert({
      ...payload,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Met à jour un élément (avec vérification tenant).
 */
export async function updateElement(tenantId, id, updates) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('ma_table')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Supprime un élément (avec vérification tenant).
 */
export async function deleteElement(tenantId, id) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('ma_table')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}
```

### Pattern standard

```
1. Vérifier tenantId (throw si absent)
2. Construire la requête Supabase avec .eq('tenant_id', tenantId)
3. Appliquer les filtres optionnels
4. Exécuter la requête
5. Gérer les erreurs (throw error)
6. Retourner les données
```

### Utilisation depuis une route

```javascript
import { getElements, createElement } from '../services/exempleService.js';

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const data = await getElements(req.admin.tenant_id, req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 11. Frontend — Pages & Composants

### Architecture

```
admin-ui/src/
├── pages/              # 1 fichier = 1 page/route de l'application
├── components/         # Composants réutilisables
│   ├── ui/            # Composants de base (Button, Card, Input, Modal...)
│   ├── layout/        # Layout (Sidebar, Header)
│   ├── forms/         # Composants de formulaires
│   └── modals/        # Modales réutilisables
├── hooks/             # Custom hooks React
├── contexts/          # React Contexts (Tenant, Profile)
├── lib/               # Client API, utilitaires
│   ├── api.ts        # Client HTTP principal
│   └── utils.ts      # Fonctions utilitaires
└── types/             # Types TypeScript
    ├── models.ts     # Modèles de données
    └── api.ts        # Types requêtes/réponses
```

### Créer une nouvelle page

1. Créer le fichier dans `admin-ui/src/pages/MaPage.tsx`
2. La route sera ajoutée dans `App.tsx` par le fondateur

```tsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function MaPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/admin/ma-route');
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ma Page</h1>
      {/* Contenu */}
    </div>
  );
}
```

### Client API (`lib/api.ts`)

Le fichier `api.ts` fournit un client HTTP pré-configuré qui :
- Ajoute automatiquement le header `Authorization` (JWT)
- Ajoute automatiquement le header `X-Tenant-ID`
- Gère les erreurs 401 (redirection login)

```typescript
// Exemples d'utilisation
import { api } from '../lib/api';

// GET
const { data } = await api.get('/admin/clients');

// POST
const { data } = await api.post('/admin/clients', {
  nom: 'Dupont',
  telephone: '0612345678',
});

// PATCH
await api.patch(`/admin/clients/${id}`, { nom: 'Durand' });

// DELETE
await api.delete(`/admin/clients/${id}`);
```

### Contexts importants

**TenantContext** — Fournit les informations du tenant courant :
```tsx
import { useTenant } from '../hooks/useTenant';

function MonComposant() {
  const { tenantId, tenantConfig } = useTenant();
  // tenantId est automatiquement envoyé avec chaque requête API
}
```

**ProfileContext** — Fournit le profil métier du tenant :
```tsx
import { useProfile } from '../contexts/ProfileContext';

function MonComposant() {
  const { profile } = useProfile();
  // profile contient la config spécifique au type de business
}
```

### Styling

- **Tailwind CSS** pour tout le styling (pas de CSS custom sauf exception)
- Composants UI de base dans `components/ui/` (inspirés shadcn/ui)
- Icônes via `lucide-react`

```tsx
// Exemple de composant avec Tailwind
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
  Enregistrer
</button>
```

---

## 12. Base de Données

### Technologie

Supabase = PostgreSQL managé avec :
- **RLS** (Row Level Security) — Sécurité au niveau des lignes
- **API auto-générée** — Client JS pour requêtes
- **Temps réel** — Subscriptions WebSocket (si nécessaire)

### Tables métier (avec `tenant_id`)

Toute table contenant des données client possède une colonne `tenant_id` (UUID) :

| Table | Description |
|-------|-------------|
| `clients` | Clients/contacts du tenant |
| `reservations` | Réservations/rendez-vous |
| `services` | Services proposés |
| `equipe` | Membres de l'équipe |
| `factures` | Factures |
| `devis` | Devis |
| `prestations` | Prestations réalisées |
| `stock` | Inventaire |
| `documents` | Documents uploadés |
| `notifications` | Notifications envoyées |
| `historique_admin` | Journal d'audit |
| `disponibilites` | Plages horaires |
| `campagnes_marketing` | Campagnes marketing |
| `workflows` | Automatisations |
| `pipeline_deals` | Deals commerciaux |
| `avis` | Avis clients |
| `fidelite` | Programme de fidélité |
| `depenses` | Dépenses comptables |

### Tables système (SANS `tenant_id`)

Ces tables sont globales et ne doivent **pas** être filtrées par tenant :

| Table | Description |
|-------|-------------|
| `tenants` | Liste des tenants |
| `plans` | Plans d'abonnement |
| `secteurs` | Types de business |
| `modules` | Modules disponibles |

### Créer une migration SQL

1. Créer un fichier dans `backend/src/sql/` avec un numéro séquentiel :
   ```
   backend/src/sql/094_ma_migration.sql
   ```
2. Format du fichier :
   ```sql
   -- 094: Description de la migration
   -- Date: 2026-XX-XX

   ALTER TABLE ma_table ADD COLUMN nouvelle_colonne TEXT;

   -- Si nouvelle table métier, TOUJOURS ajouter tenant_id :
   CREATE TABLE IF NOT EXISTS ma_nouvelle_table (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     nom TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
3. **Ne jamais exécuter une migration directement** — la soumettre dans la PR pour validation

---

## 13. Tests

### Stack de tests

| Outil | Scope | Commande |
|-------|-------|----------|
| Jest | Backend (services, routes) | `cd backend && npm test` |
| Vitest | Frontend (composants, hooks) | `cd admin-ui && npm test` |
| Playwright | E2E (parcours complets) | `cd admin-ui && npm run test:e2e` |

### Commandes essentielles

```bash
# Backend — Tous les tests
cd backend && npm test

# Backend — Tests d'isolation tenant (CRITIQUE)
cd backend && npm run test:tenant

# Backend — Shield complet (lint:syntax + lint:tenant)
cd backend && npm run shield

# Frontend — Tous les tests
cd admin-ui && npm test

# Frontend — Tests E2E
cd admin-ui && npm run test:e2e
```

### Écrire un test backend (Jest)

```javascript
// backend/src/tests/monService.test.js
import { getClients, createClient } from '../services/clientService.js';

describe('clientService', () => {
  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';

  test('getClients filtre par tenant_id', async () => {
    const clients = await getClients(TENANT_A);
    // Vérifier que tous les clients appartiennent au tenant A
    clients.forEach(c => {
      expect(c.tenant_id).toBe(TENANT_A);
    });
  });

  test('getClients refuse un tenantId vide', async () => {
    await expect(getClients(null)).rejects.toThrow('tenant_id requis');
  });

  test('isolation entre tenants', async () => {
    const clientsA = await getClients(TENANT_A);
    const clientsB = await getClients(TENANT_B);
    // Aucun client ne doit apparaître dans les deux listes
    const idsA = clientsA.map(c => c.id);
    const idsB = clientsB.map(c => c.id);
    idsA.forEach(id => expect(idsB).not.toContain(id));
  });
});
```

### Écrire un test frontend (Vitest)

```typescript
// admin-ui/src/__tests__/MonComposant.test.tsx
import { render, screen } from '@testing-library/react';
import MonComposant from '../components/MonComposant';

describe('MonComposant', () => {
  it('affiche le titre', () => {
    render(<MonComposant />);
    expect(screen.getByText('Mon Titre')).toBeInTheDocument();
  });
});
```

### Tests à NE PAS modifier

- `backend/src/services/logicTests/` — Tests PLTE automatisés (propriétaires)
- Tests existants dans `backend/src/tests/` — ne pas modifier sans accord
- Tests E2E existants dans `admin-ui/e2e/` — ne pas modifier sans accord

---

## 14. Workflow Git

### Branches

```
main                    ← Branche de production (PROTÉGÉE)
  └── feature/xxx       ← Nouvelle fonctionnalité
  └── fix/xxx           ← Correction de bug
  └── refactor/xxx      ← Refactoring
```

### Workflow

```
1. Créer une branche depuis main
   git checkout main
   git pull origin main
   git checkout -b feature/ma-feature

2. Développer et commiter
   git add fichier1.js fichier2.js
   git commit -m "feat: description courte"

3. Pousser la branche
   git push -u origin feature/ma-feature

4. Créer une Pull Request sur GitHub
   → Le fondateur review et merge
```

### Pre-commit hooks

Les hooks Husky s'exécutent **automatiquement** à chaque commit :

```
Pre-commit :
  1. npm run lint:syntax  → Vérifie la syntaxe JS/TS
  2. npm run lint:tenant  → Vérifie l'isolation tenant

Si un hook échoue → le commit est REFUSÉ.
```

### Convention de messages de commit

```
type: description courte en français

Types autorisés :
  feat:     Nouvelle fonctionnalité
  fix:      Correction de bug
  refactor: Refactoring (pas de changement fonctionnel)
  style:    Changement de style/CSS
  test:     Ajout ou modification de tests
  docs:     Documentation
  perf:     Amélioration de performance
  chore:    Tâches de maintenance
```

Exemples :
```
feat: ajouter la page de gestion des catégories
fix: corriger le tri des clients par date
refactor: extraire le composant ClientCard
test: ajouter les tests du service facture
```

### Règles strictes

- **JAMAIS** de push direct sur `main` — toujours passer par une PR
- **JAMAIS** de `git push --force` — risque de perte de données
- **JAMAIS** de merge sans review du fondateur
- **JAMAIS** de fichiers `.env` dans un commit

---

## 15. Zones INTERDITES 🔒

Les fichiers et dossiers suivants sont **strictement interdits** de modification par un développeur externe. Toute modification non autorisée sera rejetée en review.

| Zone | Raison |
|------|--------|
| `backend/src/core/` | Moteur de réservation propriétaire |
| `backend/src/sentinel/` | Système de monitoring propriétaire |
| `backend/src/ai/` | Intelligence artificielle propriétaire |
| `backend/src/prompts/` | Prompts IA (propriété intellectuelle) |
| `backend/src/templates/` | Templates métier propriétaires |
| `backend/src/tools/` | Outils IA (114 outils propriétaires) |
| `backend/src/profiles/` | Profils métier propriétaires |
| `backend/src/middleware/tenantShield.js` | Sécurité multi-tenant critique |
| `backend/src/middleware/auth.js` | Authentification JWT |
| `backend/src/middleware/rbac.js` | Contrôle d'accès par rôle |
| `backend/src/middleware/resolveTenant.js` | Résolution du tenant |
| `backend/src/middleware/checkPlan.js` | Vérification des plans |
| `backend/src/middleware/quotas.js` | Gestion des quotas |
| `backend/src/middleware/rateLimiter.js` | Protection anti-abus |
| `backend/src/middleware/auditLog.js` | Journalisation d'audit |
| `backend/src/services/stripeBillingService.js` | Facturation Stripe |
| `backend/src/services/paymentService.js` | Paiements |
| `backend/src/services/voiceAIService.js` | Agent vocal IA |
| `backend/src/services/notificationService.js` | Notifications (cascade Email→WA→SMS) |
| `backend/src/services/sentinelCollector.js` | Collecte monitoring |
| `backend/src/services/autopilot.js` | Pilotage automatique |
| `backend/src/services/halimahMemory.js` | Mémoire IA |
| `backend/src/services/clientRecognition.js` | Reconnaissance client IA |
| `backend/src/services/logicTests/` | Tests PLTE automatisés |
| `backend/src/routes/stripeWebhook.js` | Webhooks paiement |
| `backend/src/routes/signup.js` | Flux d'inscription |
| `backend/src/routes/billing.js` | Facturation |
| `backend/src/routes/nexusAuth.js` | Auth super-admin |
| `backend/src/routes/nexusAdmin.js` | Panel super-admin |
| `backend/src/routes/twilioWebhooks.js` | Webhooks Twilio |
| `backend/src/routes/voice.js` | API vocale |
| `backend/src/routes/sentinel.js` | API SENTINEL |
| `backend/src/config/` | Configuration (tout le dossier) |
| `backend/src/jobs/` | Tâches planifiées |
| `backend/src/queues/` | Files d'attente |
| `backend/src/workers/` | Workers background |
| `backend/scripts/` | Scripts d'administration |
| `backend/src/index.js` | Point d'entrée (chaîne de middlewares) |
| `docs/business-plan/` | Stratégie commerciale |
| `docs/PRICING_STRATEGY.md` | Stratégie tarifaire |
| `docs/NEXUS-SOURCE-VERITE.md` | Source de vérité interne |
| `.husky/` | Git hooks |
| `.github/` | Workflows CI/CD |
| Tout fichier `.env` | Secrets et credentials |
| `render.yaml` | Configuration déploiement |

### En cas de doute

> **Si un fichier n'apparaît pas dans la liste "Zones autorisées", demandez au fondateur avant de le modifier.**

---

## 16. Zones de Travail AUTORISÉES ✅

### Frontend (admin-ui)

| Zone | Ce que vous pouvez faire |
|------|--------------------------|
| `admin-ui/src/pages/` | Créer de nouvelles pages, modifier les pages assignées |
| `admin-ui/src/components/` | Créer de nouveaux composants UI |
| `admin-ui/src/components/ui/` | Ajouter des composants de base |
| `admin-ui/src/hooks/` | Créer des custom hooks |
| `admin-ui/src/types/` | Ajouter des types TypeScript |
| `admin-ui/src/lib/utils.ts` | Ajouter des fonctions utilitaires |
| `admin-ui/src/__tests__/` | Écrire des tests unitaires |
| `admin-ui/public/` | Ajouter des assets statiques |

### Backend

| Zone | Ce que vous pouvez faire |
|------|--------------------------|
| `backend/src/routes/` | Créer de nouvelles routes (selon mission assignée) |
| `backend/src/services/` | Créer de nouveaux services (selon mission assignée) |
| `backend/src/tests/` | Écrire des tests unitaires |
| `backend/src/utils/` | Ajouter des fonctions utilitaires |
| `backend/src/sql/` | Proposer des migrations SQL (review obligatoire) |

### Règles de la zone autorisée

1. **Toujours respecter le Tenant Shield** — `.eq('tenant_id', tenantId)` sur chaque requête
2. **Suivre les conventions** — imports, nommage, structure (cf. sections 8-10)
3. **Écrire des tests** — chaque nouvelle fonctionnalité doit avoir au minimum un test
4. **Ne pas modifier de fichiers existants** sans rapport avec la mission assignée
5. **Demander** si vous n'êtes pas sûr qu'un fichier est modifiable

---

## 17. Checklist avant PR

Avant de soumettre une Pull Request, vérifier **chaque point** :

```
□ npm run lint:tenant → 0 violation
□ npm run lint:syntax → 0 erreur
□ npm run shield → tout passe
□ npm test (backend) → tous les tests passent
□ npm test (admin-ui) → tous les tests passent
□ Pas de console.log dans le code
□ Pas de secret en dur (clé API, mot de passe, URL privée)
□ Pas de modification d'une zone interdite
□ Chaque requête Supabase a .eq('tenant_id', tenantId)
□ Chaque INSERT Supabase inclut tenant_id dans les données
□ Pas de fichier .env dans le commit
□ Message de commit clair (type: description)
□ La branche est à jour avec main (git rebase main)
□ Le code compile sans erreur TypeScript (frontend)
□ Les imports utilisent l'extension .js (backend ESM)
```

### Si un check échoue

- **lint:tenant échoue** → Vous avez une requête Supabase sans filtre `tenant_id`. Corrigez-la.
- **lint:syntax échoue** → Erreur de syntaxe JS/TS. Corrigez-la.
- **Tests échouent** → Votre code a introduit une régression. Investiguer et corriger.

---

## 18. Communication & Livrables

### Canal de communication

- **Email principal** : nexussentinelai@yahoo.com
- **Canal défini par le fondateur** pour les échanges quotidiens (Slack, Discord, WhatsApp, etc.)
- Répondre sous 24h aux questions du fondateur

### Format des livrables

1. **Pull Request sur GitHub** — Seul format accepté pour le code
2. Chaque PR doit contenir :
   - Un titre clair et concis
   - Une description de ce qui a été fait
   - Les tests associés
   - Pas de fichiers hors périmètre de la mission

### Signalement de sécurité

Si vous découvrez une faille de sécurité (même potentielle) :
1. **NE PAS** en parler publiquement (pas d'issue GitHub publique)
2. **Contacter immédiatement** le fondateur par email ou téléphone
3. Documenter le problème et les étapes pour le reproduire

### Timesheet

Si applicable (selon le contrat) :
- Format : heures travaillées par jour
- Envoi : selon la fréquence définie dans le contrat
- Détail : tâche réalisée + temps passé

---

## 19. Contacts

| Rôle | Contact |
|------|---------|
| Fondateur | nexussentinelai@yahoo.com |
| Téléphone | 07 60 53 76 94 |
| Urgence sécurité | nexussentinelai@yahoo.com + appel téléphonique |

### Heures de disponibilité

- Du lundi au vendredi
- Réponse sous 24h pour les emails
- Appel téléphonique pour les urgences uniquement

---

## 20. Annexe — Variables d'environnement

Liste complète des noms de variables utilisées par le backend. **Les valeurs sont fournies par le fondateur — ne jamais les partager.**

### Supabase & Base de données

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (serveur uniquement) |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |

### Authentification & Sécurité

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret de signature JWT (min. 32 caractères) |
| `ADMIN_PASSWORD` | Mot de passe admin portal |
| `NODE_ENV` | Environnement (development / production) |

### Serveur

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur (défaut : 5000) |
| `CORS_ORIGIN` | Origines autorisées (séparées par virgule) |
| `ADMIN_UI_URL` | URL de l'interface admin |
| `BACKEND_URL` | URL du backend |
| `WEBHOOK_BASE_URL` | URL de base pour les webhooks |

### Paiements (Stripe)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_PUBLIC_KEY` | Clé publique Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks |

### Communications (Twilio)

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Identifiant du compte |
| `TWILIO_AUTH_TOKEN` | Token d'authentification |
| `TWILIO_PHONE_NUMBER` | Numéro principal |
| `TWILIO_MESSAGING_SERVICE_SID` | Service SMS |

### IA & Services ML

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Claude (Anthropic) |
| `OPENAI_API_KEY` | Clé API OpenAI |
| `REPLICATE_API_TOKEN` | Token Replicate (génération d'images) |

### Email

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Clé API Resend (service email) |

### Infrastructure

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | URL de connexion Redis |
| `SENTRY_DSN` | DSN Sentry (monitoring d'erreurs) |

### Frontend (admin-ui)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL de l'API backend (défaut : `/api`) |

> **Rappel : Le fondateur fournit le fichier `.env` pré-rempli. Ne demandez jamais les valeurs individuellement. Ne les stockez jamais en dehors du fichier `.env` local.**

---

## Résumé des commandes essentielles

```bash
# Démarrage
cd backend && npm run dev          # Backend
cd admin-ui && npm run dev         # Frontend

# Qualité
cd backend && npm run shield       # Lint complet (syntaxe + tenant)
cd backend && npm run lint:tenant  # Lint tenant uniquement
cd backend && npm run lint:syntax  # Lint syntaxe uniquement

# Tests
cd backend && npm test             # Tests backend
cd admin-ui && npm test            # Tests frontend
cd backend && npm run test:tenant  # Tests d'isolation

# Git
git checkout -b feature/xxx       # Nouvelle branche
git add fichier1 fichier2         # Staging ciblé
git commit -m "feat: description" # Commit
git push -u origin feature/xxx    # Push + PR
```

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   Ce document est la propriété de NEXUS.                                    ║
║   Toute reproduction ou diffusion non autorisée est interdite.              ║
║                                                                              ║
║   Version : 1.0                                                              ║
║   Dernière mise à jour : Mars 2026                                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```
