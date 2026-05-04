# NEXUS — Roadmap Features & Sprint Planning

> Source de verite unique pour toutes les features planifiees

## Sprint Planning — 4 semaines (29 avril — 27 mai 2026)

### Semaine 1 (29 avril — 4 mai) — WhatsApp Admin + Dashboard KPIs
- [x] **WhatsApp Admin** : detection admin par tel, handler admin WA, split messages, /reset
  - Fichiers crees : `phoneNormalize.js`, `adminDetectionService.js`, `whatsappAdminHandler.js`
  - Fichiers modifies : `whatsapp.js`, `adminChatService.js`, `adminAuth.js`, `adminServices.js`
- [x] **Refonte Home → Dashboard KPIs** : 4 KPI cards, graphique CA 30j, RDV du jour, services populaires, clients a risque
  - Home.tsx rewrite complet (chat supprime, remplace par dashboard Stripe/Shopify)
- [x] **Activation WhatsApp Twilio** : enregistrer numeros comme WhatsApp Senders via Twilio
- [x] **Tests WhatsApp Admin** : envoyer message depuis tel admin, verifier routing, tester /reset, vocal, split
- [x] **Tests Dashboard** : verifier 4 KPIs, graphique, dark mode, responsive mobile

### Semaine 2 (5 — 11 mai) — Tests intensifs + Business Types
- [x] Tests business type **Security** (phase complete — majorations, dates par ligne)
- [x] Tests business type **Restaurant** (phase 2)
- [x] Tests business type **Hotel** (regression)
- [x] Tests business type **Commerce** (regression)
- [x] Fix bugs trouves pendant tests

### Semaine 3 (12 — 18 mai) — Stripe + Onboarding
- [x] Creer nouveaux Price IDs Stripe (69/199/599€) — `setup-stripe-plans.mjs` execute (4 produits + 3 top-ups, mode TEST)
- [x] Page success Stripe (`/onboarding/success`) dans admin-ui — OnboardingSuccess.tsx + route App.tsx
- [x] Email verification au signup — migration 134, 3 fonctions service, 2 routes, guard signup, template HTML
- [x] Envoi factures par email apres creation — webhook Stripe invoice.paid → sendInvoicePaidEmail
- [x] Test parcours complet : `smoke-test-signup.mjs` — 9/9 ALL PASS (email→SMS→signup→dashboard→checkout→cleanup)

### Semaine 4 (19 — 27 mai) — Polish + Deploy
- [x] Smoke test complet (`npm run smoke`) — 35/45 OK (10 = tenant config, pas de code bug)
- [x] Script `smoke:all` unifie (smoke-test.js + smoke-test-signup.mjs)
- [x] Performance audit — build admin-ui 2.9 MB, 105 chunks, 0 erreur TS
- [x] Documentation API endpoints nouveaux — `backend/src/docs/ENDPOINTS.md` (14 endpoints)
- [x] TS fixes — ModuleGate enterprise, Stock types, OnboardingSuccess import, ForfaitPeriodeDetail scope
- [x] Deploy staging + push main/develop
- [x] Version bump → v3.26.0
- [x] Fix simulateur credits landing — couts alignes backend, presets recalibres (light→Starter, regular→Pro, intensive→Business)

---

## Features planifiees (backlog)

### IA & Voix
- [ ] Multi-langue voix (anglais, espagnol)
- [ ] Voix personnalisee par tenant (choix de voix OpenAI)
- [ ] Historique conversations voix consultable dans admin

### SEO & Contenu
- [ ] **Refonte articles blog IA** — rendu HTML riche (plus de markdown brut), images hero, tableaux stylises, encadres couleur, CTA, typographie soignee, sidebar articles lies. Objectif : articles visuellement premium pour maximiser temps sur page et SEO
- [ ] SEO intensif NEXUS — blog, pages metier, mots-cles longue traine

### Business
- [ ] Module Comptabilite avancee (rapprochement bancaire)
- [ ] Module Fidelite (points, rewards)
- [ ] Widget reservation V2 (redesign)
- [ ] Export PDF rapports mensuels automatiques

### Technique
- [ ] Monitoring Sentry integration
- [ ] Rate limiting granulaire par endpoint
- [ ] Backup automatique S3

### Projet issouf.ai (freelance)
- [ ] Init repo `~/Documents/issouf-ai/` (Next.js 14 + TS + Tailwind)
- [ ] Landing 1 page (hero + demo live tel + 3 offres + portfolio + contact)
- [ ] Backend voix (extraction briques NEXUS)
- [ ] Dashboard light
- [ ] Numero Twilio dedie
- [ ] Video 30s demo
- [ ] Publier profil Malt V2
- [ ] Acheter domaines issouf.ai + issouftoure.com
