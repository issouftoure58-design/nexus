# NEXUS

Plateforme SaaS multi-tenant tout-en-un qui automatise la gestion des entreprises de services et commerces grace a l'intelligence artificielle.

## Le probleme

Les petites entreprises (salons, restaurants, artisans, independants) perdent des heures chaque jour sur des taches repetitives : repondre au telephone, gerer les rendez-vous, relancer les clients, faire la comptabilite. Elles ratent des clients quand elles ne peuvent pas decrocher.

## La solution

NEXUS centralise tout dans une seule plateforme intelligente.

### IA Multicanale

Un assistant IA repond au telephone 24h/24, sur WhatsApp et en chat web. Il prend les rendez-vous, repond aux questions, et transfere vers l'humain si necessaire. 105 outils IA integres pour l'administration (CRM, comptabilite, marketing, RH, SEO — pilotables en langage naturel).

### 6 types d'activites

L'interface, la terminologie et les outils s'adaptent automatiquement :

| Type | Exemples |
|------|----------|
| Services a domicile | Coiffure, plomberie, electricite, coaching |
| Salons et instituts | Coiffure, spa, barbier, esthetique |
| Restaurants et bars | Gestion tables, couverts, carte, allergenes |
| Hotels et hebergements | Chambres, check-in/out, extras, tarifs saisonniers |
| Commerces | Click & collect, livraison, stock, commandes |
| Securite et mise a disposition | Devis, planning multi-site, staff allocation |

### Modules integres

- **Agenda intelligent** — creneaux, rappels SMS/email, Google Calendar
- **CRM** — segmentation automatique (VIP, fideles, inactifs), pipeline commercial
- **Comptabilite** — journaux, rapprochement bancaire, export FEC, normes francaises
- **RH** — fiches de paie, DSN automatisee, conges, planning equipes
- **Marketing** — campagnes SMS/email, avis Google, SEO
- **Gestion de stock** — inventaire temps reel, alertes, fournisseurs
- **Devis et facturation** — templates par metier, relances automatiques

## Stack technique

```
Backend     Node.js / Express / 74 routes / 78 services / 87 migrations SQL
Frontend    React / Vite / TypeScript (admin-ui: 43 pages, 49 composants)
Database    PostgreSQL (Supabase) avec RLS multi-tenant
IA          Claude (Anthropic) + OpenAI TTS
Telephonie  Twilio (WhatsApp + Voice + SMS)
Paiements   Stripe (mode live, webhooks idempotents)
Monitoring  SENTINEL (error tracking + monitoring maison)
CI/CD       GitHub Actions (5 workflows)
Deploy      Render.com
Domaine     nexus-ai-saas.com
```

## Structure du projet

```
nexus/
├── backend/        API Node.js/Express
├── admin-ui/       Dashboard admin officiel (React/Vite/TS)
├── frontend/       App publique tenants (reservations, chat)
├── landing/        Page vitrine marketing (JSX + Spline 3D)
├── sentinel/       Module monitoring
├── .github/        CI/CD workflows
└── docs/           Documentation et archives
```

## Securite

**Tenant Shield** — isolation stricte des donnees par tenant a chaque requete Supabase. Linter statique pre-commit + CI GitHub + middleware runtime. Aucun fallback tenant autorise.

- RLS sur toutes les tables avec `get_current_tenant()`
- Rate limiting (6 limiteurs : API, login, paiement, notification, signup, check)
- Validation Zod sur les routes critiques
- CSP/Helmet headers stricts
- RGPD compliant (consentement, export, droit a l'oubli, suppression planifiee)
- Stripe webhooks idempotents (deduplication par event_id)

## Plans tarifaires

| Plan | Prix | Cible |
|------|------|-------|
| **Starter** | 99 EUR/mois | Independants, auto-entrepreneurs |
| **Pro** | 249 EUR/mois | Salons, restaurants, commerces, PME |
| **Business** | 499 EUR/mois | Franchises, groupes, multi-sites |

Essai gratuit 14 jours sans carte bancaire.

## Clients

| Client | Activite | Statut |
|--------|----------|--------|
| **Fat's Hair-Afro** | Coiffure afro a domicile (Ile-de-France) | Production |
| **Patwinsserie** | Formation cake design (Qualiopi) | Beta / Onboarding |

## Commandes

```bash
# Developpement
./start-dev.sh              # Lance backend (5000) + frontend (3001)
./stop-dev.sh               # Arrete tous les processus dev

# Verification
npm run lint:tenant          # Verifier isolation tenant
npm run shield               # Lint + tests tenant

# Base de donnees
cd backend && node src/index.js   # Lancer le backend

# Admin-ui
cd admin-ui && npx vite           # Lancer le frontend
```

## Documentation

| Fichier | Description |
|---------|-------------|
| `CLAUDE.md` | Directives developpeur et regles Tenant Shield |
| `PROGRESS.md` | Suivi d'avancement (source de verite) |
| `SYSTEM.md` | Architecture technique complete |
| `NEXUS_KNOWLEDGE.md` | Base de connaissance persistante |
| `TENANT_SHIELD.md` | Documentation securite multi-tenant |

## Liens

- **Production** : https://app.nexus-ai-saas.com
- **Vitrine** : https://nexus-ai-saas.com
- **GitHub** : https://github.com/issouftoure58-design/nexus

---

Version 3.24.0
