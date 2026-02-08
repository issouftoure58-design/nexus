# Stockage Données Tenants

Ce dossier contient les fichiers de tous les tenants NEXUS.

## Structure

```
data/
├── {tenant-id}/              ← Un dossier par tenant
│   ├── uploads/              → Images, médias uploadés
│   ├── documents/            → Factures, devis, exports PDF
│   ├── temp/                 → Fichiers temporaires (purge auto 24h)
│   └── cache/                → Cache généré (purge auto 7j)
├── .gitignore
└── README.md
```

## Règles

1. **UN TENANT = UN DOSSIER DISTINCT**
   - Jamais de fichiers d'un tenant dans le dossier d'un autre
   - Le tenant_id est le nom du dossier

2. **Les fichiers ne sont PAS versionnés**
   - Le .gitignore ignore tout le contenu
   - Seule la structure est préservée (.gitkeep)

3. **Création automatique**
   - La structure est créée automatiquement à l'inscription
   - Utiliser `tenantStorage.createTenantStructure(tenantId)`

## Utilisation

```javascript
import {
  getTenantRoot,
  getTenantPath,
  createTenantStructure
} from '../src/utils/tenantStorage.js';

// Obtenir le dossier uploads d'un tenant
const uploadsPath = getTenantPath('fatshairafro', 'uploads');

// Créer la structure pour un nouveau tenant
createTenantStructure('nouveau-tenant');
```

## Tenants existants

- `fatshairafro` - Fat's Hair-Afro (premier client)
- `nexus-test` - Tenant de test
