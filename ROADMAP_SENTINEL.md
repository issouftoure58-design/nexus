# ROADMAP SENTINEL + SUPER-ADMIN UI → 100%

**Date:** 2 mars 2026
**Objectif:** SENTINEL 100% fonctionnel + Super-Admin UI operationnelle + Verification manuelle pre-launch

---

## ETAT ACTUEL — AUDIT COMPLET

### Super-Admin UI (NEXUS Operator Panel)
**Location:** `frontend/nexus-app/src/pages/nexus/`
**6 pages:** NexusLogin, NexusDashboard, NexusTenants, NexusSentinel (9 tabs), NexusSettings, NexusBilling
**Route guard:** NexusProtectedRoute (role === 'super_admin')
**Composants sentinel:** 6 sous-composants (Overview, Costs, Security, Intelligence, Autopilot, Backups)

**PROBLEME CRITIQUE:** Les pages appellent `/api/nexus/*` qui N'EXISTE PAS dans le backend → 404 partout
- `GET /api/nexus/dashboard` — NexusDashboard.tsx
- `GET /api/nexus/tenants` — NexusTenants.tsx, NexusBilling.tsx
- `GET /api/nexus/sentinel/status` — NexusSettings.tsx
- `GET /api/admin/sentinel-intelligence/health-score` — NexusDashboard.tsx

### SENTINEL Backend
**22 fichiers, 148 KB** dans `backend/src/sentinel/`
**Modules:** healthMonitor, costMonitor, securityShield, quotas, tenantCostTracker, alerter, autoHeal, persistence, uptimeMonitor, backupService
**Routes:** 18 endpoints dans `routes/sentinel.js` (Business plan only)
**Services:** sentinelCollector.js, sentinelInsights.js

**PROBLEMES:**
1. **sentinel.init() jamais appele au demarrage** — les health checks ne tournent pas
2. **Aucun job scheduler pour SENTINEL** — snapshots et insights manuels seulement
3. **Email alerting non implemente** (TODO dans alerter.js)
4. **Pas de plan check sur dismiss/implement insights**

### Modules & Business Profiles
**27 modules** avec controle d'acces par plan (Starter/Pro/Business)
**4 types business:** service_domicile, salon, restaurant, hotel
**Templates:** 5 templates pre-configures (salon_coiffure, institut_beaute, restaurant, hotel, autre)
**Onboarding:** 5 etapes (info, horaires, services, personnalisation, complete)

**PROBLEMES:**
- Application partielle des templates au signup
- Validation champs par business_type non enforced en middleware
- Incohérence flags plan (ancien) vs modules_actifs (nouveau)

---

## PHASE 1 — SENTINEL BACKEND ACTIVATION [PRIORITE HAUTE]

### 1.1 Initialiser SENTINEL au demarrage
**Fichier:** `backend/src/index.js`
- Importer et appeler `sentinel.init()` apres le demarrage du serveur
- Ajouter au health check: sentinel status

### 1.2 Ajouter jobs SENTINEL dans le scheduler
**Fichier:** `backend/src/jobs/scheduler.js`
- 00:30 quotidien: `sentinelCollector.collectDailySnapshot()` pour tous les tenants Business
- 09:00 lundi: `sentinelInsights.generateInsights()` pour tous les tenants Business
- Toutes les 5 min: `sentinel.runHealthCheck()` (leger, memoire/DB/APIs)

### 1.3 Implementer email alerting
**Fichier:** `backend/src/sentinel/actions/alerter.js`
- Connecter Resend pour les alertes URGENT (deja configure en prod)
- Garder SMS pour CRITICAL, email pour URGENT, file pour WARNING

### 1.4 Corriger plan checks sur insights
**Fichier:** `backend/src/routes/sentinel.js`
- Ajouter `requireAdminPlan('business')` sur PATCH dismiss et implement

---

## PHASE 2 — API SUPER-ADMIN (NEXUS Operator) [PRIORITE HAUTE]

### 2.1 Creer `backend/src/routes/nexusAdmin.js`
Endpoints a implementer:

| Endpoint | Donnees | Source |
|----------|---------|--------|
| `GET /api/nexus/dashboard` | MRR, tenants actifs, health score, alertes recentes | tenants + sentinel |
| `GET /api/nexus/tenants` | Liste tenants avec plan, usage, couts, statut | tenants + sentinel_usage |
| `GET /api/nexus/tenants/:id` | Detail tenant (config, modules, couts, activite) | tenants + modules |
| `PATCH /api/nexus/tenants/:id` | Modifier plan, statut, frozen | tenants |
| `GET /api/nexus/sentinel/status` | Statut global: health, couts, securite, alertes | sentinel monitors |
| `GET /api/nexus/billing` | MRR/ARR, repartition par plan, revenue forecast | tenants + plans |

### 2.2 Proteger avec requireSuperAdmin
- Middleware existant dans `adminAuth.js`
- Toutes les routes `/api/nexus/*` doivent etre protegees

### 2.3 Enregistrer dans index.js
- `app.use('/api/nexus', requireSuperAdmin, nexusAdminRoutes)`

---

## PHASE 3 — SUPER-ADMIN UI VERIFICATION [PRIORITE MOYENNE]

### 3.1 NexusDashboard — connecter aux vrais endpoints
- Verifier que les cartes KPI affichent les bonnes donnees
- Verifier le health score SENTINEL

### 3.2 NexusTenants — liste et detail
- Verifier la liste des tenants (plan, statut, derniere activite)
- Verifier les actions (freeze, changer plan)

### 3.3 NexusSentinel — 9 onglets
- Overview: health monitors
- Live: logs temps reel
- Costs: couts par service
- Security: alertes securite
- Intelligence: insights IA
- Autopilot: actions automatiques
- Backups: etat des backups

### 3.4 NexusBilling — revenus
- MRR/ARR calcules correctement
- Repartition par plan

### 3.5 NexusSettings — configuration
- Status SENTINEL
- Configuration pricing

### 3.6 Nettoyer import inutilise SuperAdminRoute dans App.tsx

---

## PHASE 4 — CHECKLIST PRE-LAUNCH [PRIORITE MOYENNE]

- [ ] Activer PITR Supabase (Dashboard > Database > Backups)
- [ ] Valider CGV avec juriste
- [ ] Inviter 2-3 clients beta via /api/signup
- [ ] Monitorer Sentry 48h
- [ ] Configurer STRIPE_WEBHOOK_SECRET sur Render
- [ ] Tester webhook Stripe (paiement test → event recu)

---

## PHASE 5 — VERIFICATION MANUELLE PARCOURS [PRIORITE MOYENNE]

### 5.1 Parcours Onboarding (par type de business)
Pour chaque type (service_domicile, salon, restaurant, hotel):
- [ ] Signup avec template correct
- [ ] 5 etapes onboarding completes
- [ ] Services par defaut crees
- [ ] Horaires par defaut configures
- [ ] IA configuree avec le bon ton

### 5.2 Parcours Modules
- [ ] Activation module WhatsApp (Pro required)
- [ ] Activation module Telephone (Pro required)
- [ ] Activation module SENTINEL (Business required)
- [ ] Verification dependances (telephone requiert agent_ia_web)
- [ ] Verification pricing (cout mensuel calcule correctement)
- [ ] Desactivation module → cleanup correct

### 5.3 Parcours Reservation (par type)
- [ ] Service a domicile: adresse client + frais deplacement
- [ ] Salon: choix employe + creneau
- [ ] Restaurant: nombre de couverts + table
- [ ] Hotel: dates arrivee/depart + chambre + extras

### 5.4 Parcours Admin
- [ ] Dashboard: CA, RDV, clients, graphiques
- [ ] Clients: CRUD, historique, segmentation
- [ ] Reservations: liste, filtres, statuts
- [ ] Factures: generation, envoi
- [ ] Parametres: horaires, services, branding

---

## FICHIERS A CREER/MODIFIER

| Fichier | Action | Phase |
|---------|--------|-------|
| `backend/src/routes/nexusAdmin.js` | NOUVEAU — API super-admin | 2 |
| `backend/src/index.js` | Ajouter sentinel.init() + routes nexus | 1, 2 |
| `backend/src/jobs/scheduler.js` | Ajouter 3 jobs SENTINEL | 1 |
| `backend/src/sentinel/actions/alerter.js` | Implementer email Resend | 1 |
| `backend/src/routes/sentinel.js` | Plan checks sur dismiss/implement | 1 |
| `frontend/nexus-app/src/App.tsx` | Supprimer import SuperAdminRoute | 3 |

---

## CRITERES DE SUCCES

1. **SENTINEL actif 24/7** — health checks toutes les 5 min, snapshots quotidiens, insights hebdo
2. **Super-Admin UI fonctionnelle** — toutes les pages chargent sans erreur 404
3. **Alertes operationnelles** — SMS critiques + email urgents + logs warnings
4. **4 types business verifies** — chaque parcours onboarding → reservation → facturation
5. **27 modules verifies** — activation/desactivation/dependances/pricing
