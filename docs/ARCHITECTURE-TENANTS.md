# Architecture Multi-Tenant NEXUS

> **Date** : 9 Février 2026
> **Version** : 1.0

---

## Principe Fondamental

```
┌─────────────────────────────────────────────────────────────┐
│   RÈGLE ABSOLUE : UN TENANT = UN DOSSIER DISTINCT           │
│                                                              │
│   ✗ JAMAIS de fichiers d'un tenant dans le dossier d'un    │
│     autre tenant                                             │
│   ✗ JAMAIS de mélange de données                            │
│   ✓ Isolation totale garantie                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Structure Fichiers

```
backend/data/
├── fatshairafro/           ← Fat's Hair UNIQUEMENT
│   ├── uploads/            → Images, médias
│   ├── documents/          → Factures, exports
│   ├── temp/               → Fichiers temporaires
│   └── cache/              → Cache généré
├── nexus-test/             ← Tenant test UNIQUEMENT
│   ├── uploads/
│   ├── documents/
│   ├── temp/
│   └── cache/
└── {nouveau-tenant}/       ← Chaque nouveau tenant
    ├── uploads/
    ├── documents/
    ├── temp/
    └── cache/
```

---

## Isolation BDD

Toutes les tables métier ont une colonne `tenant_id` :

```sql
-- Exemple : table clients
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,  -- ← Isolation tenant
  nom VARCHAR(255),
  email VARCHAR(255),
  -- ...
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Index pour performance
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
```

### Règles SQL

1. **Toujours filtrer par tenant_id** dans les requêtes
2. **Jamais de SELECT * sans WHERE tenant_id**
3. **Le middleware injecte tenant_id automatiquement**

---

## Utilitaire tenantStorage.js

### Fonctions disponibles

| Fonction | Description |
|----------|-------------|
| `getTenantRoot(tenantId)` | Chemin absolu du dossier tenant |
| `getTenantPath(tenantId, 'uploads')` | Chemin d'un sous-dossier |
| `createTenantStructure(tenantId)` | Créer toute la structure |
| `checkTenantStructure(tenantId)` | Vérifier que la structure existe |
| `initTenant(tenantId)` | Créer si inexistant |
| `listTenants()` | Liste des tenants avec dossiers |
| `cleanTenantTemp(tenantId)` | Nettoyer fichiers temp >24h |
| `cleanTenantCache(tenantId)` | Nettoyer cache >7j |
| `getTenantStorageStats(tenantId)` | Taille par sous-dossier |
| `deleteTenantStorage(tenantId, true)` | Supprimer (avec confirmation) |

### Exemple utilisation

```javascript
import {
  getTenantPath,
  createTenantStructure,
  getTenantStorageStats
} from '../utils/tenantStorage.js';

// Créer structure pour nouveau tenant
createTenantStructure('nouveau-client');

// Upload fichier
const uploadPath = getTenantPath('fatshairafro', 'uploads');
const filePath = path.join(uploadPath, 'photo.jpg');
fs.writeFileSync(filePath, buffer);

// Stats
const stats = getTenantStorageStats('fatshairafro');
// { exists: true, total: 15728640, subdirs: { uploads: 10485760, ... } }
```

---

## Sécurité

### Protection path traversal

```javascript
export function getTenantRoot(tenantId) {
  // Sanitize : empêcher ../../../ ou caractères spéciaux
  const sanitized = tenantId.replace(/[^a-z0-9-_]/gi, '');
  if (sanitized !== tenantId) {
    throw new Error(`tenantId invalide: ${tenantId}`);
  }
  return path.join(DATA_ROOT, tenantId);
}
```

### Fichiers non versionnés

Le `.gitignore` dans `backend/data/` ignore tout le contenu :

```gitignore
*/uploads/*
*/documents/*
*/temp/*
*/cache/*

# Mais garde la structure
!*/.gitkeep
```

---

## Résumé

| Couche | Isolation |
|--------|-----------|
| **BDD** | Colonne `tenant_id` dans toutes les tables |
| **Fichiers** | Dossier `backend/data/{tenant-id}/` |
| **API** | Middleware injecte `tenant_id` depuis header/domaine |
| **Frontend** | Config `VITE_TENANT_ID` ou détection URL |

```
┌──────────────────────────────────────────────────────────────┐
│  NEXUS garantit l'isolation totale des données entre         │
│  tenants, aussi bien en base de données qu'en fichiers.      │
└──────────────────────────────────────────────────────────────┘
```
