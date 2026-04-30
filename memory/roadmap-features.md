# NEXUS — Roadmap Features & Sprint Planning

> Source de verite unique pour toutes les features planifiees

## Sprint Planning — 4 semaines (29 avril — 27 mai 2026)

### Semaine 1 (29 avril — 4 mai) — WhatsApp Admin + Dashboard KPIs
- [x] **WhatsApp Admin** : detection admin par tel, handler admin WA, split messages, /reset
  - Fichiers crees : `phoneNormalize.js`, `adminDetectionService.js`, `whatsappAdminHandler.js`
  - Fichiers modifies : `whatsapp.js`, `adminChatService.js`, `adminAuth.js`, `adminServices.js`
- [x] **Refonte Home → Dashboard KPIs** : 4 KPI cards, graphique CA 30j, RDV du jour, services populaires, clients a risque
  - Home.tsx rewrite complet (chat supprime, remplace par dashboard Stripe/Shopify)
- [ ] **Activation WhatsApp Twilio** : enregistrer numeros comme WhatsApp Senders via Twilio
  - Fat's Hair Afro (+33939240269) : WABA cree "Fat's Hair-Afro", rate-limited par Meta — reprendre demain
  - issouf.ai (+33939245651) : meme rate limit — reprendre demain
  - NEXUS demo (+33974995631) : voice-only, pas de SMS → ne supporte PAS WhatsApp
  - **Procedure** : Twilio > WhatsApp Senders > Create > Facebook Login > nouveau WABA > verif par appel vocal
  - **IMPORTANT** : 2 essais max avant rate limit Meta. Utiliser appel vocal + forward vers tel perso (+33760537694)
  - Forward vocal : rediriger temporairement le voice URL vers `http://twimlets.com/echo?Twiml=<Response><Dial><Number>+33760537694</Number></Dial></Response>` puis restaurer apres
  - Token Meta permanent dans .env : META_WA_ACCESS_TOKEN (genere, compte "Conversions API System User")
  - Tel admin en DB : +33760537694 sur "Demo User" (fatshairafro) + "issouf" (nexus-test)
- [ ] **Tests WhatsApp Admin** : envoyer message depuis tel admin, verifier routing, tester /reset, vocal, split
- [ ] **Tests Dashboard** : verifier 4 KPIs, graphique, dark mode, responsive mobile

### Semaine 2 (5 — 11 mai) — Tests intensifs + Business Types
- [ ] Tests business type **Security** (phase complete — majorations, dates par ligne)
- [ ] Tests business type **Restaurant** (phase 2)
- [ ] Tests business type **Hotel** (regression)
- [ ] Tests business type **Commerce** (regression)
- [ ] Fix bugs trouves pendant tests

### Semaine 3 (12 — 18 mai) — Stripe + Onboarding
- [ ] Creer nouveaux Price IDs Stripe (69/199/599€) dans Stripe Dashboard
- [ ] Page success Stripe (`/onboarding/success`) dans admin-ui
- [ ] Email verification au signup
- [ ] Envoi factures par email apres creation
- [ ] Test parcours complet : signup → paiement → onboarding → dashboard

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
