# DECISION : CREATION TENANT TEST - 2026-02-12

## Contexte

Suite a l'audit de la structure tenants existante, ce document presente la decision pour la creation d'un tenant de test avant la commercialisation NEXUS.

---

## Decision

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         RECOMMANDATION : CREER TENANT TEST "nexus-test"       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Specification du Tenant Test

### Identite

| Propriete | Valeur |
|-----------|--------|
| **ID** | 3 |
| **Slug** | `nexus-test` |
| **Nom** | Test NEXUS Platform |
| **Status** | active |
| **Frozen** | **FALSE** |

### Technique

| Propriete | Valeur |
|-----------|--------|
| **Dossier** | `tenants/tenant-3/` |
| **Schema BDD** | `tenant_3_nexus-test` |
| **Domain** | test.nexus.dev |
| **Region** | eu-west-1 |

### Plan et Features

| Propriete | Valeur |
|-----------|--------|
| **Tier** | business |
| **Raison** | Test TOUTES les features avant commercialisation |

**Features a activer:**
- Reservations (tous canaux)
- SMS/Notifications
- AI Assistant complet
- Dashboard admin avance
- Multi-users + Roles
- Comptabilite
- Commerce (catalogue, stock, ventes)
- Marketing (campaigns, social)
- SEO (analysis, recommendations)
- RH (employees, planning, payroll)
- SENTINEL Client
- Integrations (Stripe, Calendar, etc.)

### Limites Test

| Ressource | Limite |
|-----------|--------|
| Reservations/jour | 1000 (illimite) |
| SMS/mois | 10000 |
| AI calls/jour | 1000 |
| Users | 20 |
| Storage | 100 GB |

---

## Plan de Creation

### Etape 1 : Structure Fichiers

```bash
# Creer dossier
mkdir -p tenants/tenant-3

# Creer config.json
# Creer features.json (toutes activees)
```

### Etape 2 : CLI

```bash
node backend/src/cli/create-tenant.js nexus-test "Test NEXUS Platform" --domain=test.nexus.dev
```

### Etape 3 : Registry

Ajouter dans `tenants/registry.json`:

```json
{
  "id": 3,
  "slug": "nexus-test",
  "name": "Test NEXUS Platform",
  "status": "active",
  "tier": "business",
  "frozen": false,
  "created": "2026-02-12T00:00:00Z"
}
```

### Etape 4 : Schema BDD

```sql
CREATE SCHEMA IF NOT EXISTS tenant_3_nexus-test;
-- Copier structure depuis template
```

### Etape 5 : Backend Config

Creer `backend/src/config/tenants/nexustest.js`:

```javascript
export default {
  id: 'nexus-test',
  name: 'Test NEXUS Platform',
  frozen: false,
  tier: 'business',
  features: { /* toutes activees */ }
};
```

---

## Risques et Mitigations

| Risque | Mitigation |
|--------|------------|
| Confusion avec production | Prefixe `test` dans nom et slug |
| Donnees test en prod | Schema BDD isole |
| Cout ressources | Limites elevees mais pas illimitees |
| Oubli de supprimer | Documenter date limite test |

---

## Validation

### Criteres de Succes

- [ ] Tenant cree dans registry.json
- [ ] Dossier tenant-3/ avec config.json et features.json
- [ ] Entry dans table tenants Supabase
- [ ] Schema BDD cree
- [ ] Admin user cree
- [ ] Accessible via X-Tenant-ID: nexus-test
- [ ] Toutes features business disponibles
- [ ] SENTINEL peut monitorer ce tenant

### Test Rapide

```bash
# Verification API
curl -H "X-Tenant-ID: nexus-test" http://localhost:3000/api/health

# Reponse attendue
{ "status": "ok", "tenant": "nexus-test", "tier": "business" }
```

---

## Timeline Test 1 Semaine

| Jour | Focus |
|------|-------|
| J1 | Creation tenant + config de base |
| J2 | Test reservations + SMS |
| J3 | Test AI Assistant |
| J4 | Test Commerce + Marketing |
| J5 | Test SEO + RH |
| J6 | Test SENTINEL integration |
| J7 | Rapport final + Decision GO/NO-GO commercialisation |

---

## Action Immediate

**Attente validation utilisateur avant execution.**

Commande a executer:

```bash
# 1. Creer structure
mkdir -p tenants/tenant-3

# 2. CLI creation
node backend/src/cli/create-tenant.js nexus-test "Test NEXUS Platform" --domain=test.nexus.dev

# 3. Verification
curl -H "X-Tenant-ID: nexus-test" http://localhost:3000/api/health
```

---

**Document prepare par:** Claude Code
**Date:** 2026-02-12
**Status:** EN ATTENTE VALIDATION
