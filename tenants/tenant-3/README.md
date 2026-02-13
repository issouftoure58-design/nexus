# Tenant Test - NEXUS Platform

**ID:** 3
**Slug:** nexus-test
**Plan:** Business (toutes fonctionnalites)
**Status:** Test (modifiable - frozen: false)

---

## Configuration

- Toutes les fonctionnalites activees (plan Business)
- Donnees de test generees automatiquement
- Non protege (frozen: false) - modifications autorisees
- Environnement isole pour tests

---

## Identifiants Admin

| Champ | Valeur |
|-------|--------|
| Email | admin@nexus-test.com |
| Mot de passe | Test123! |
| URL Admin | https://test.nexus.dev/admin |

---

## Donnees Test Generees

| Type | Quantite |
|------|----------|
| Clients | 50 (segments varies) |
| RDV | 200 (6 mois) |
| Factures | 30 |
| Services | 10 |
| Produits | 10 |
| Membres equipe | 5 |
| Workflows marketing | Actifs |
| Pipeline commercial | Actif |
| Articles SEO | 5 |
| Depenses comptables | 20 |

---

## Segments Clients

- 10 nouveaux clients (new)
- 15 clients actifs (active)
- 10 clients fideles (loyal)
- 5 VIP
- 7 a risque (at_risk)
- 3 perdus (lost)

---

## Modules Actifs

- Socle (reservations, services)
- Agent IA (web, whatsapp, telephone)
- Site vitrine
- Paiements (Stripe)
- Comptabilite
- Marketing (campaigns, workflows, segments)
- SEO (keywords, articles, recommendations)
- Commercial (pipeline, leads, devis)
- Stock (produits, alertes)
- RH (equipe, planning, conges, paie)
- Analytics (predictions, churn, forecast)

---

## Utilisation

Ce tenant est dedie aux tests exhaustifs de la plateforme NEXUS.
Toutes les modifications sont autorisees.

### Reinitialiser les donnees

```bash
node backend/scripts/reset-tenant-data.js 3
```

### Repeupler les donnees

```bash
node backend/scripts/populate-tenant-test.js
```

### Supprimer le tenant

```bash
node backend/scripts/delete-tenant.js 3
```

---

## Header API

Pour acceder a ce tenant via l'API:

```bash
curl -H "X-Tenant-ID: nexus-test" http://localhost:3000/api/health
```

---

**Cree le:** 2026-02-12
**Par:** Claude Code
**Usage:** Test pre-commercialisation NEXUS
