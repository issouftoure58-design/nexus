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
- [ ] Smoke test complet (`npm run smoke`)
- [ ] Performance audit (Lighthouse, bundle size)
- [ ] Documentation API endpoints nouveaux
- [ ] Deploy staging + tests prod
- [ ] Version bump → v3.26.0

---

## Features planifiees (backlog)

### IA & Voix
- [ ] Multi-langue voix (anglais, espagnol)
- [ ] Voix personnalisee par tenant (choix de voix OpenAI)
- [ ] Historique conversations voix consultable dans admin

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
