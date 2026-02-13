# AUDIT STRUCTURE TENANTS - 2026-02-12

## Resume Executif

| Metrique | Valeur |
|----------|--------|
| Tenants enregistres | 2 |
| Tenants actifs | 1 (fatshairafro) |
| Tenants pending | 1 (decoevent) |
| Tenant de test | **AUCUN** |
| Convention nommage | `tenant-{id}` / `tenant_{id}_{slug}` |

---

## 1. Structure Fichiers

```
nexus-backend-dev/
├── tenants/
│   ├── registry.json          # Registre central
│   ├── template/              # Template nouveaux tenants
│   │   └── config.json
│   ├── tenant-1/              # Fat's Hair-Afro (PRODUCTION)
│   │   ├── config.json
│   │   └── features.json
│   └── tenant-2/              # Deco Event (PENDING)
│       ├── config.json
│       └── features.json
│
├── backend/src/config/tenants/
│   ├── index.js               # Tenant loader (identification)
│   ├── tenantCache.js         # Cache in-memory
│   ├── fatshairafro.js        # Config statique fallback
│   ├── decoevent.js           # Config statique fallback
│   └── template.js            # Template config
│
├── backend/src/cli/
│   └── create-tenant.js       # CLI creation tenant
│
└── shared/database/migrations/
    └── 001-create-tenant-schema.sql  # Schema BDD tenant
```

---

## 2. Tenants Enregistres

### 2.1 Fat's Hair-Afro (ID: 1)

| Propriete | Valeur |
|-----------|--------|
| ID | 1 |
| Slug | `fatshairafro` |
| Status | **ACTIVE** |
| Frozen | **TRUE** (production protegee) |
| Tier | starter |
| Domain | fatshairafro.fr |
| Schema BDD | `tenant_1_fatshairafro` |
| Owner | Fatou (contact@fatshairafro.fr) |

**Features activees:**
- Reservations (web, telephone, chat, whatsapp, admin)
- Services variables et domicile
- SMS (confirmation, rappel J-1, remerciement)
- AI Assistant (telephone, chat, voice synthesis)
- Dashboard admin

**Features desactivees:**
- Multi-users, roles/permissions
- Comptabilite, Commerce, Marketing, SEO, RH
- Integrations externes

### 2.2 Deco Event (ID: 2)

| Propriete | Valeur |
|-----------|--------|
| ID | 2 |
| Slug | `decoevent` |
| Status | **PENDING** |
| Frozen | FALSE |
| Tier | pro |
| Domain | decoevent.fr |
| Schema BDD | `tenant_2_decoevent` |

---

## 3. Conventions de Nommage

### 3.1 Identifiants

| Type | Pattern | Exemple |
|------|---------|---------|
| Slug | lowercase alphanumeric + hyphens | `fatshairafro`, `deco-event` |
| ID numerique | Auto-increment | 1, 2, 3... |
| Dossier | `tenant-{id}` | `tenant-1`, `tenant-2` |
| Schema BDD | `tenant_{id}_{slug}` | `tenant_1_fatshairafro` |

### 3.2 Fichiers Config

| Fichier | Role |
|---------|------|
| `config.json` | Configuration generale (owner, billing, limits) |
| `features.json` | Feature flags par module |

### 3.3 Identification Tenant (Runtime)

Ordre de priorite (index.js):
1. Header `X-Tenant-ID`
2. Query param `?tenant=`
3. Domain lookup (cache BDD)
4. Domain fallback statique
5. `null` = contexte NEXUS

---

## 4. Mecanisme de Protection

### 4.1 Frozen Flag

```javascript
// config.json
{
  "frozen": true  // Production protegee
}

// Verification
export function isFrozen(tenantId) {
  const config = getTenantConfig(tenantId);
  return config?.frozen === true;
}

export function canModify(tenantId, reason = '') {
  if (isFrozen(tenantId)) {
    console.warn(`[TENANT ${tenantId}] FROZEN - Modification refusee`);
    return false;
  }
  return true;
}
```

### 4.2 Tenant Actuel Protege

**Fat's Hair-Afro est FROZEN** - Toute modification est bloquee au niveau backend.

---

## 5. CLI Creation Tenant

```bash
# Usage
node backend/src/cli/create-tenant.js <tenant_id> <business_name> [--domain=example.com]

# Exemple
node backend/src/cli/create-tenant.js test-nexus "Test NEXUS" --domain=test.nexus.dev
```

**Actions effectuees:**
1. Verification unicite du tenant_id
2. Insert dans table `tenants` Supabase
3. Creation admin user avec email `admin@{domain}`
4. Password par defaut: `changeme2026`

**Validation:**
- `tenant_id` doit etre lowercase alphanumeric avec tirets/underscores

---

## 6. Base de Donnees

### 6.1 Table `tenants` (Supabase)

```sql
-- Structure inferee du CLI
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}'
);
```

### 6.2 Schemas Tenant

Chaque tenant a son propre schema PostgreSQL:

```sql
CREATE SCHEMA IF NOT EXISTS tenant_1_fatshairafro;
-- Tables: clients, services, reservations, reviews
-- Indexes: idx_reservations_date, idx_reservations_client, idx_reservations_statut
```

---

## 7. Conclusions

### 7.1 Points Forts

- Architecture multi-tenant bien structuree
- Isolation par schema PostgreSQL
- Protection des tenants production (frozen)
- Convention de nommage coherente
- CLI de creation disponible

### 7.2 Points d'Attention

- Aucun tenant de test existant
- Registry.json et BDD peuvent diverger (double source)
- Pas de migration automatique des features.json

### 7.3 Tenant Test Recommande

| Propriete | Valeur Recommandee |
|-----------|-------------------|
| ID | 3 |
| Slug | `nexus-test` |
| Dossier | `tenant-3` |
| Schema BDD | `tenant_3_nexus-test` |
| Domain | test.nexus.dev |
| Status | active |
| Frozen | **FALSE** (modifiable) |
| Tier | business (toutes features) |

---

## 8. Checklist Pre-Creation

- [x] Registry.json analyse
- [x] Structure dossiers identifiee
- [x] Convention nommage documentee
- [x] CLI create-tenant.js verifie
- [x] Tenant production protege (frozen=true)
- [x] Aucun conflit avec ID existants
- [ ] Creer tenant test (DECISION-TENANT-TEST.md)

---

**Audit realise par:** Claude Code
**Date:** 2026-02-12
**Duree:** ~15 minutes
