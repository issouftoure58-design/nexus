# ROADMAP NEXUS → 100/100

**Date:** 2 mars 2026
**Regle absolue:** On termine chaque phase AVANT de passer a la suivante. Zero exception.

**Score actuel: 65/100**

---

## PHASE 1 — SECURITE (65 → 72)
> Rien ne sert de construire sur des fondations trouees.

- [ ] 1.1 Ajouter `authenticateAdmin` sur `queueRoutes.js` (POST /clean = danger)
- [ ] 1.2 Ajouter `authenticateAdmin` sur `quotas.js`
- [ ] 1.3 Audit: verifier que TOUTES les routes montees dans index.js ont une auth appropriee
- [ ] 1.4 Supprimer le commit debug Twilio (info debug dans les 403)
- [ ] 1.5 Verifier que Sentry est actif et capture les erreurs en production

**Critere de sortie:** Zero route exposee sans auth. Sentry actif.

---

## PHASE 2 — CI/CD (72 → 78)
> Plus jamais un push direct en prod sans filet.

- [ ] 2.1 Creer `.github/workflows/ci.yml` : lint:tenant + lint:syntax + tests
- [ ] 2.2 Proteger la branche `main` (require PR, require CI pass)
- [ ] 2.3 Creer branche `develop` pour le travail quotidien
- [ ] 2.4 Configurer Render pour deployer depuis `main` uniquement (deja le cas)
- [ ] 2.5 Ajouter `npm run build` des 3 frontends dans le CI

**Critere de sortie:** Impossible de merger dans main sans CI vert.

---

## PHASE 3 — NETTOYAGE (78 → 83)
> Supprimer le bruit pour voir clair.

- [ ] 3.1 Supprimer les 10 routes orphelines (agentIA, analytics, clientAuth, clientDashboard, contact, contentCreator, googleAuth, optimization, places, sentinelRoutes)
- [ ] 3.2 Consolider les migrations dans `backend/migrations/` uniquement
- [ ] 3.3 Fixer les 3 collisions de migration (037, 038, 042) — renumeroter
- [ ] 3.4 Supprimer doublon bcrypt (garder bcryptjs)
- [ ] 3.5 Supprimer doublon bull (garder bullmq)
- [ ] 3.6 Deplacer `notificationService.mock.js` dans tests/
- [ ] 3.7 Supprimer le dossier `shared/` (quasi-vide, inutilise)
- [ ] 3.8 **DECISION CRITIQUE:** Choisir UNE app admin (admin-ui OU nexus-app) et archiver l'autre
      - Recommandation: garder **nexus-app** (plus complete: 55 pages, shadcn/ui, operator panel)
      - admin-ui → archive dans branch `archive/admin-ui-legacy`

**Critere de sortie:** Zero code mort. 1 seule app admin. 1 seul repertoire migrations.

---

## PHASE 4 — QUALITE FRONTEND (83 → 88)
> Le code doit compiler sans erreur.

- [ ] 4.1 Fixer les 17 erreurs TypeScript dans nexus-app
- [ ] 4.2 Ajouter `tsc --noEmit` au build script de nexus-app
- [ ] 4.3 Refactorer Comptabilite.tsx (5280 lignes → 5-8 sous-composants)
- [ ] 4.4 Refactorer Activites.tsx (3141 lignes → sous-composants)
- [ ] 4.5 Refactorer Devis.tsx (2510 lignes → sous-composants)
- [ ] 4.6 Landing: migrer App.jsx en TypeScript + decouper en composants
- [ ] 4.7 Verifier que les 3 apps build proprement (zero warning, zero erreur)

**Critere de sortie:** `tsc --noEmit` passe sur toutes les apps. Aucun fichier > 1000 lignes.

---

## PHASE 5 — TESTS (88 → 93)
> Ce qui n'est pas teste est casse. On ne le sait pas encore.

- [ ] 5.1 Tests unitaires services critiques:
  - [ ] bookingService (reservations)
  - [ ] whatsappService (messages)
  - [ ] notificationService + cascadeService
  - [ ] twilioProvisioningService
  - [ ] stripeService (billing)
  - [ ] dispoService (disponibilites)
- [ ] 5.2 Tests integration routes critiques:
  - [ ] POST /api/admin/auth/login + logout
  - [ ] POST /api/provisioning/whatsapp
  - [ ] POST /api/billing/webhook (Stripe)
  - [ ] POST /api/whatsapp/webhook (Twilio)
  - [ ] GET /api/services (public)
  - [ ] POST /api/chat (public)
- [ ] 5.3 Tests tenant isolation:
  - [ ] Verifier que chaque service filtre par tenant_id
  - [ ] Test cross-tenant bloque
- [ ] 5.4 Ajouter `npm run test:coverage` avec seuil minimum 60%
- [ ] 5.5 Integrer la couverture dans le CI (fail si < 60%)

**Critere de sortie:** Couverture > 60%. CI bloque si tests echouent.

---

## PHASE 6 — E2E FLOWS (93 → 96)
> Tester le produit comme un vrai client.

- [ ] 6.1 Flow Signup: landing → signup → creation tenant → onboarding → premier service cree
- [ ] 6.2 Flow Reservation: client ouvre site → chat IA → reserve → confirmation SMS
- [ ] 6.3 Flow WhatsApp: client envoie message → Halimah repond → reservation creee
- [ ] 6.4 Flow Voice: client appelle → IA decroche → reservation creee
- [ ] 6.5 Flow Paiement: upgrade Starter → Pro → modules Pro accessibles
- [ ] 6.6 Flow Admin: login admin → dashboard → voir stats → gerer clients → gerer reservations
- [ ] 6.7 Flow Provisioning: activer module WhatsApp → numero dedie attribue → message recu

Chaque flow teste sur un tenant test (nexus-test, test-security, etc.). JAMAIS sur fatshairafro.

**Critere de sortie:** Les 7 flows passent de bout en bout sans erreur.

---

## PHASE 7 — MONITORING & PRODUCTION (96 → 98)
> Voir les problemes avant les clients.

- [ ] 7.1 Sentry: alertes sur erreurs 500, erreurs Stripe, erreurs Twilio
- [ ] 7.2 Health check enrichi: DB, Redis, Twilio, Stripe (pas juste `{status: "ok"}`)
- [ ] 7.3 Logs structures (Winston) partout — remplacer les console.log restants
- [ ] 7.4 Alertes quotas: notification quand un tenant approche ses limites
- [ ] 7.5 Backup strategy: verifier que Supabase PITR est actif
- [ ] 7.6 Rate limiting: verifier les seuils sur toutes les routes publiques

**Critere de sortie:** Dashboard monitoring actif. Alertes configurees.

---

## PHASE 8 — LANCEMENT (98 → 100)
> Le produit est pret. On lance.

- [ ] 8.1 Audit securite final: OWASP top 10 check
- [ ] 8.2 Performance: temps de reponse < 500ms sur toutes les routes
- [ ] 8.3 2-3 clients beta Starter (vrais salons/restaurants)
- [ ] 8.4 Feedback loop 1 semaine → corrections
- [ ] 8.5 Pricing page live, Stripe en mode live (pas test)
- [ ] 8.6 Documentation API (Swagger deja en place, verifier completude)
- [ ] 8.7 CGV, RGPD, mentions legales verifees par un juriste
- [ ] 8.8 GO LIVE

**Critere de sortie:** Clients payants actifs. Zero bug critique pendant 7 jours.

---

## RESUME

| Phase | Score | Duree estimee | Focus |
|-------|-------|---------------|-------|
| 1. Securite | 65→72 | 1 jour | Failles critiques |
| 2. CI/CD | 72→78 | 1 jour | Filet de securite |
| 3. Nettoyage | 78→83 | 2 jours | Code mort, decisions |
| 4. Frontend | 83→88 | 3 jours | TypeScript, god components |
| 5. Tests | 88→93 | 3 jours | Couverture 60%+ |
| 6. E2E | 93→96 | 2 jours | Flows complets |
| 7. Monitoring | 96→98 | 1 jour | Observabilite |
| 8. Lancement | 98→100 | 1 semaine | Beta + go live |

**Total: ~2 semaines de travail concentre + 1 semaine de beta.**

---

> "On ne devie pas. On ne saute pas de phase. On coche chaque case. Point."
