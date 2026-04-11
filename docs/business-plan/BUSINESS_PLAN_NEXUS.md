# BUSINESS PLAN — NEXUS
## Plateforme SaaS de gestion intelligente pour PME de services

**Version 3.0 — Avril 2026**
**Confidentiel**

---

## 1. EXECUTIVE SUMMARY

**NEXUS** est une IA qui repond au telephone et sur WhatsApp 24/7 pour les PME de services (salons de coiffure, restaurants, hotels, services a domicile). Elle prend les reservations automatiquement, gere la facturation et centralise la relation client. Le fondateur developpe seul la plateforme, deja en production.

### Le probleme
Les 1,2 million de PME de services en France ratent des appels, perdent des clients et passent 15h/semaine sur des taches administratives repetitives. Elles utilisent 4 a 7 outils differents (agenda, caisse, Excel, WhatsApp...) sans aucune automatisation.

### La solution
NEXUS repond automatiquement aux appels et messages WhatsApp des clients, prend les rendez-vous, envoie les confirmations et rappels, et genere les factures. Reservations, CRM, facturation — tout dans une seule plateforme propulsee par l'IA. Comptabilite, marketing et autres outils sont inclus en bonus.

### Traction actuelle
- Plateforme en production (v3.25.0), score technique 100/100
- 484 tests automatises, 0 echec
- 1 client en production (salon de coiffure)
- 74 routes API, 78 services backend, 46 pages admin, 107 migrations DB
- 7 verticales metier operationnelles : salon, restaurant, hotel, commerce, securite, service a domicile, conseil
- Modele freemium : Free (0 EUR) / Basic (29 EUR/mois) / Business (149 EUR/mois) + credits IA
- Stack complete : IA (Claude/Anthropic), paiement (Stripe), communication (Twilio), email (Resend)
- Monitoring proprietaire SENTINEL (22 composants, alertes temps reel)
- Domaine en production : nexus-ai-saas.com / app.nexus-ai-saas.com
- Entreprise immatriculee (SIREN 947570362), comptes fournisseurs actifs
- Presence reseaux sociaux : Instagram, TikTok, Facebook + groupes cibles (600K+ portee)

### Demande de financement
**40 000 EUR** repartis entre pret d'honneur (Initiative 95 : 15 000 EUR) et pret bancaire garanti BPI (25 000 EUR), pour financer le fonds de roulement et la phase de lancement commercial (12-18 mois). NACRE (5 000 EUR) en option si eligible. Pas de recrutement prevu — le fondateur developpe, vend et supporte seul. Le fondateur ne se verse pas de salaire les 6 premiers mois et assure la comptabilite lui-meme (BEP Compta + 10 ans d'experience).

---

## 2. LE MARCHE

### 2.1 Marche adressable

| Niveau | Perimetre | Taille |
|--------|-----------|--------|
| **TAM** | Marche mondial des logiciels SaaS pour PME de services | 45 Mds $ (2025) |
| **SAM** | Marche francais logiciels gestion PME services | 2,1 Mds EUR |
| **SOM** | Cible atteignable en 3 ans (4 verticales, IDF puis France) | 15 M EUR |

### 2.2 Segmentation par vertical

| Vertical | Nb etablissements France | Taux equipement logiciel | Opportunite |
|----------|--------------------------|-------------------------|-------------|
| Salons coiffure/beaute | 185 000 | ~30% | Forte |
| Restaurants | 175 000 | ~25% | Forte |
| Hotels/hebergements | 30 000 | ~60% | Moyenne |
| Services a domicile | 250 000 | ~10% | Tres forte |
| **Total** | **640 000** | **~25%** | |

**Source :** INSEE 2024, Federation des entreprises de la beaute, GNI Hotellerie, FNAIM

### 2.3 Tendances du marche
- Digitalisation acceleree post-Covid des PME de services (+40% en 3 ans)
- Montee en puissance de l'IA generative dans les outils metiers
- Demande croissante pour des solutions tout-en-un (vs stack fragmentee)
- Reglementation RGPD poussant vers des outils conformes et securises

### 2.4 Positionnement concurrentiel

| Critere | NEXUS | Fresha | Treatwell | Planity | Square |
|---------|-------|--------|-----------|---------|--------|
| Multi-vertical | 4 secteurs | 1 (beaute) | 1 (beaute) | 1 (beaute) | 2 (resto+retail) |
| IA integree | Web+Tel+WhatsApp | Non | Non | Non | Basique |
| Comptabilite | Complete + expert | Non | Non | Non | Basique |
| Marketing auto | Email+SMS+Workflows | Email | Email | SMS | Email |
| Multi-tenant | Isolation totale | Oui | Oui | Oui | Oui |
| Prix entree | 0 EUR (Free) / 29 EUR/mois | Gratuit* | Commission | 49 EUR/mois | Gratuit* |
| IA Telephone 24/7 | Oui (credits) | Non | Non | Non | Non |
| IA WhatsApp 24/7 | Oui (credits) | Non | Non | Non | Non |
| RGPD FR natif | Oui | Non (UK) | Non (UK) | Oui | Non (US) |

*Gratuit avec commissions sur transactions (3-5%)

**Avantage competitif cle :** NEXUS est la seule plateforme a combiner IA telephone/WhatsApp 24/7 + gestion complete + multi-vertical + conformite RGPD francaise. Le plan Free permet de tester sans engagement, le Basic a 29 EUR/mois inclut deja 1 000 credits IA.

---

## 3. LE PRODUIT

### 3.1 Architecture technique

NEXUS est bati sur une architecture multi-tenant avec isolation stricte des donnees (Tenant Shield). Chaque client dispose d'un espace completement isole, garanti par un systeme de protection verifie par 484 tests automatises et un lint tenant automatique.

**Stack technique :**
- Backend : Node.js/Express.js (74 routes, 78 services, 16 middleware, 87 migrations)
- Frontend admin : React/TypeScript/Vite (46 pages, 71 composants)
- Landing : React/Vite + Spline 3D (site vitrine nexus-ai-saas.com)
- Base de donnees : Supabase (PostgreSQL) avec RLS
- IA : Claude Opus 4.6 (Anthropic) — agents conversationnels multi-canal
- Voix IA : ElevenLabs (synthese vocale naturelle francaise)
- Paiement : Stripe (abonnements, facturation, dunning, webhooks)
- Communication : Twilio (SMS, appels vocaux, WhatsApp Business)
- Email : Resend (transactionnel + marketing, domaine verifie)
- Monitoring : SENTINEL (systeme proprietaire, 22 composants, alertes temps reel)
- Deploiement : Render (backend + admin-ui + landing, CI/CD GitHub Actions)
- Securite : Isolation tenant stricte, rate limiting, CSRF, CORS, sessions DB, MFA (TOTP)

### 3.2 Modules fonctionnels

| Module | Plan | Description |
|--------|------|-------------|
| Dashboard | Free | Vue d'ensemble activite, KPIs temps reel |
| Reservations (10/mois) | Free | Calendrier, RDV, multi-services (illimite en Basic) |
| CRM (30 clients) | Free | Fichier client, historique (illimite en Basic) |
| Facturation (10/mois, watermark) | Free | Auto-generation, relances (illimite sans watermark en Basic) |
| Agent IA Telephone | Basic (credits) | Assistant vocal 24/7 — repond aux appels, prend les RDV |
| Agent IA WhatsApp | Basic (credits) | Bot WhatsApp Business — reponses automatiques |
| Agent IA Web | Basic (credits) | Chatbot 24/7 sur site client |
| Comptabilite | Basic | P&L, rapprochement, export expert-comptable |
| CRM Avance | Basic | Segmentation, workflows, relances auto |
| Devis | Basic | Generation, suivi, conversion en facture |
| Stock & Inventaire | Basic | Inventaire, alertes seuil, mouvements |
| Marketing & Campagnes | Basic (credits) | Email/SMS, workflows, posts IA |
| Equipe (5 max) | Basic | Gestion des collaborateurs |
| RH & Planning complet | Business | Conges, paie, evaluations, equipe 20 max |
| Multi-sites | Business | Gestion de plusieurs etablissements |
| White-label | Business | Logo + domaine custom |
| API & Webhooks | Business | Integration tierce, cles API |
| SSO entreprise | Business | Authentification unifiee |

### 3.3 Grille tarifaire (revisee avril 2026)

| Plan | Mensuel | Annuel | Credits IA inclus | Cible |
|------|---------|--------|-------------------|-------|
| **Free** | 0 EUR (gratuit a vie) | 0 EUR | 0 (IA bloquee) | Decouverte, freelances |
| **Basic** | 29 EUR/mois | 290 EUR/an | 1 000/mois (valeur 15 EUR) | PME, salons, restaurants |
| **Business** | 149 EUR/mois | 1 490 EUR/an | 10 000/mois (valeur 150 EUR) | Multi-sites, franchises |

**Pack credits additionnel :** Pack 1000 = 15 EUR (taux base, sans bonus)
**Taux credits IA :** 1,5 EUR = 100 credits (0,015 EUR/credit)

**ARPA cible (revenu moyen par compte) :** 55 EUR/mois (mix 10% Free, 70% Basic, 20% Business + packs credits)

### 3.4 Roadmap produit 12-18 mois

| Trimestre | Priorite |
|-----------|----------|
| T2 2026 | Lancement commercial, onboarding autonome, i18n FR/EN |
| T3 2026 | App mobile (React Native), marketplace integrations |
| T4 2026 | Fonctions IA avancees (prevision CA, optimisation planning) |
| T1 2027 | Programme partenaires/revendeurs, API marketplace |

---

## 4. STRATEGIE COMMERCIALE

### 4.1 Go-to-market

**Phase 1 — Validation (T2 2026) :** 20 premiers clients
- Demarchage direct salons/restaurants IDF (quartier par quartier, terrain)
- Offre Free illimitee pour tester → conversion naturelle vers Basic 29 EUR/mois
- Groupes Facebook cibles (~600K portee : coiffure, restauration, hotellerie, entrepreneurs)
- Reseaux sociaux organiques : Instagram, TikTok, Facebook (contenus educatifs + demos IA)

**Phase 2 — Croissance (T3-T4 2026) :** 50 a 100 clients
- SEO/Content marketing (landing optimisee, guides sectoriels, tutos video)
- Google Ads cible (mots-cles metier : "logiciel salon coiffure", "IA telephone restaurant", etc.)
- Programme de parrainage (credits IA offerts par filleul converti)
- Bouche a oreille amplifie par les demos IA telephone (effet "wow")

**Phase 3 — Acceleration (2027) :** 200+ clients
- Partenariats distributeurs (grossistes coiffure, equipementiers hotel)
- Presence salons professionnels (Mondial Coiffure, EquipHotel, Sirha)
- Programme revendeurs/integrateurs
- Synergie avec Sublime-In-Hair (marketplace beaute → acquisition cross-plateforme)

### 4.2 Funnel d'acquisition

```
Phase 1 (M1-M6) — acquisition organique solo founder :
Visiteurs site       → 1 000-3 000/mois (SEO + reseaux sociaux + groupes FB)
Inscriptions Free    → 50-150/mois (taux 5%)
Activation (setup)   → 25-75/mois (taux 50%)
Conversion payant    → 6-10/mois (taux 15-20% — conversion Free→Basic progressive)

Phase 2 (M7-M12) — traction + Ads :
Visiteurs site       → 3 000-8 000/mois (SEO + Ads + parrainage)
Inscriptions Free    → 150-400/mois
Conversion payant    → 11-14/mois
```

### 4.3 Metriques cibles

| Metrique | Cible An 1 | Cible An 3 |
|----------|-----------|-----------|
| CAC (cout acquisition client) | 29 EUR | 51 EUR |
| LTV (valeur vie client) | 1 833 EUR | 2 750 EUR |
| Ratio LTV:CAC | 63x | 54x |
| CAC Payback | < 1 mois | < 1 mois |
| Churn mensuel | 3% | 2% |
| NRR (Net Revenue Retention) | 105% | 115% |

*LTV = ARPA (55 EUR) x duree de vie moyenne (1/churn). CAC = budget marketing / nouveaux clients. Ratios > 3x = excellents pour SaaS PME (benchmark Baremetrics 2025).*

---

## 5. EQUIPE

### 5.1 Fondateur

**Issouf Toure** — CEO & CTO
- SIREN : 947570362 — Nexus.AI, 8 rue des Monts Rouges, 95130 Franconville

**Formation :**

| Annee | Diplome / Formation | Etablissement | Statut |
|-------|---------------------|---------------|--------|
| 2006 | BEP Comptabilite | | Obtenu |
| 2008 | CQP APS (Agent de Prevention et de Securite) | | Obtenu |
| 2009 | Comptabilite et Gestion Informatisee | IFOCOP | Formation completee |
| 2010 | Bac Pro Comptabilite (alternance) | | Obtenu |
| 2024 | SSIAP 1 (Service de Securite Incendie) | | Obtenu |
| 2024-2026 | Developpement full-stack (autodidacte) | Autoformation | En cours |

**Experience professionnelle :**

| Periode | Poste | Entreprise / Contexte |
|---------|-------|-----------------------|
| 2005-2008 | Agent de production (saisons ete) | Industrie |
| 2007 | Livreur de journaux | Presse |
| 2008 | Agent de securite | Securite privee |
| 2010-2013 | Assistant comptable | Cabinet / Entreprise |
| 2014-2020 | Comptable | Entreprise (6 ans) |
| 2019-2023 | Gerant de SARL — livraison de colis | Entrepreneur (4 ans) |
| 2023-2025 | Agent de securite | Securite privee |
| 2024-present | Fondateur & CTO NEXUS | Nexus.AI (EI puis SASU) |

**Competences cles pour NEXUS :**
- **10 ans en comptabilite** (BEP + assistant + comptable) — connaissance metier directe pour construire les modules facturation, compta, devis, P&L de la plateforme
- **4 ans entrepreneur** (gerant SARL) — gestion d'entreprise, relation client, logistique, administratif : comprehension terrain des besoins des PME
- **Developpeur full-stack autodidacte** — a appris React, Node.js, PostgreSQL, IA (Claude/Anthropic), Stripe, Twilio en construisant NEXUS de zero jusqu'a la v3.25.0 (18 mois de R&D solo)
- **Determination prouvee** — plateforme de 74 routes API, 78 services, 46 pages, 484 tests, score 100/100, construite seul sans formation prealable en developpement
- **Connaissance terrain** — 1er client en production, 4 verticales metier operationnelles

### 5.2 Plan de recrutement

**Strategie solo-founder :** Le fondateur assure seul le developpement, le commercial et le support en An 1 et An 2. Les prestataires externes (freelance dev) sont mobilises ponctuellement en An 2 si besoin. Premier recrutement envisage en An 3 (support/CSM) si la traction le justifie.

| Poste | Timing | Cout annuel | Priorite |
|-------|--------|-------------|----------|
| Prestataires dev ponctuels | An 2 | 10 000 EUR (missions) | Moyenne |
| Support client / CSM (1er salarie) | An 3 (M25) | 24 000 EUR brut + 10 800 EUR ch. sociales | Conditionnelle |

### 5.3 Advisors envisages
- Expert-comptable specialise SaaS
- Mentor reseau Initiative 95
- Conseiller BPI France

---

## 6. PLAN DE FINANCEMENT

### 6.0 Prerequis juridique : passage de micro-entreprise a SASU

**Situation actuelle :** Micro-entreprise (EI) — SIREN 947570362, immatriculee le 20/02/2026.
La micro-entreprise a ete choisie strategiquement pour accelerer le lancement : ouverture rapide des comptes fournisseurs (Stripe, Twilio, Resend), obtention d'un SIREN, et facturation du premier client. L'entreprise est operationnelle et genere du chiffre d'affaires.

**Pourquoi le passage en SASU est maintenant necessaire :**

| Contrainte micro-entreprise | Solution SASU |
|---------------------------|--------------|
| Plafond CA : 77 700 EUR HT (services) | Pas de plafond |
| Pas de capital social → pas d'apport en nature | Capital avec apport en nature du logiciel |
| Pas de TVA deductible (franchise base) | TVA deductible sur fournisseurs |
| Difficile d'obtenir prets > 15k EUR | Structure credible pour banques/BPI |
| WILCO/BPI exigent souvent une societe | SASU = forme privilegiee des startups |
| Pas de separation patrimoine perso/pro | Responsabilite limitee aux apports |
| Impossible d'avoir des investisseurs | Ouverture possible du capital |

**Demarche de creation SASU :**
1. Rediger les statuts SASU (modeles gratuits sur bpifrance-creation.fr ou CCI)
2. Capital social : 1 EUR (minimum legal) — pas d'apport en nature formel, donc pas de commissaire aux apports
3. Annonce legale (~150 EUR) + depot au greffe via guichet unique (~70 EUR)
4. L'ancien SIREN micro-entreprise est conserve
5. Duree : 1-2 semaines
6. Cout total : ~220 EUR
7. Le logiciel NEXUS reste un actif du fondateur, valorise a 80 000 EUR dans le business plan (augmentation de capital possible ulterieurement)

*Note : BGE Val-d'Oise et CCI accompagnent gratuitement la creation et peuvent prendre en charge les frais.*

**Timing :** A faire AVANT le depot des dossiers de financement (semaine 1-2 du calendrier)

**Situation sociale du fondateur :**
- Demandeur d'emploi, beneficiaire de l'ASS (Allocation de Solidarite Specifique)
- Eligible ACRE (exoneration charges 1 an) en tant que beneficiaire ASS
- Eligible NACRE (pret 0% jusqu'a 10 000 EUR) en tant que beneficiaire ASS
- Maintien ASS possible pendant la creation (cumul activite/allocation)
- ARCE non disponible (necessite ARE, deja utilisee en 2023)

### 6.1 Besoin total : 40 000 EUR (+ 5 000 EUR NACRE en option)

Le fondateur developpe seul — pas de recrutement, pas d'infrastructure lourde. Le financement couvre le fonds de roulement et la tresorerie de securite pour les 12-18 premiers mois. Le fondateur ne se verse pas de salaire les 6 premiers mois et gere la comptabilite lui-meme (BEP Comptabilite + 10 ans d'experience).

| Poste | Montant | % |
|-------|---------|---|
| Fonds de roulement (6 mois de charges mini) | 18 000 EUR | 45% |
| Tresorerie de securite (couverture pertes Y1) | 16 000 EUR | 40% |
| Marketing lancement (reseaux sociaux, pub ciblee) | 3 000 EUR | 8% |
| Materiel informatique | 1 500 EUR | 4% |
| Frais d'etablissement (SASU, juridique) | 1 500 EUR | 4% |
| **TOTAL** | **40 000 EUR** | **100%** |

### 6.2 Actif technologique du fondateur (pas d'apport cash)

Le fondateur ne dispose pas d'apport en tresorerie mais a investi **18 mois de developpement** dans un actif logiciel en production :

| Element | Valorisation conservative |
|---------|--------------------------|
| Developpement plateforme (v3.25.0, 18 mois de travail) | 80 000 EUR |
| 74 routes API, 78 services, 46 pages frontend | inclus |
| 484 tests automatises, score technique 100/100 | inclus |
| Integrations IA (Claude), Stripe, Twilio, Resend | inclus |
| 87 migrations DB, architecture multi-tenant | inclus |
| 1 client Business en production (preuve de marche) | inclus |
| Comptes fournisseurs operationnels (Stripe, Twilio, Resend) | inclus |

**Methode de valorisation :** Cout de remplacement — un developpeur senior a 500 EUR/jour pendant 18 mois (220 jours ouvrables) = 110 000 EUR. Valorisation retenue : **80 000 EUR** (conservative, decote de 27%).

**Strategie juridique :** Le logiciel n'est pas apporte formellement au capital (capital SASU = 1 EUR) pour eviter le cout d'un commissaire aux apports. Il reste un actif du fondateur, licence d'utilisation accordee a la SASU. L'augmentation de capital avec apport en nature pourra etre faite ulterieurement si un investisseur entre au capital.

### 6.3 Sources de financement

| Source | Montant | Type | Statut |
|--------|---------|------|--------|
| Apport en nature (logiciel NEXUS) | 80 000 EUR | Fonds propres (capital) | A formaliser |
| Pret d'honneur Initiative 95 | 15 000 EUR | Quasi-fonds propres (0%, 5 ans) | En cours |
| Pret bancaire (garanti BPI 60%) | 25 000 EUR | Emprunt 5 ans, 3% | A demander |
| **TOTAL TRESORERIE** | **40 000 EUR** | | |
| NACRE phase 2 (optionnel) | +5 000 EUR | Pret 0%, 5 ans (gere par la Region) | Bonus si eligible |

**Note NACRE :** Le NACRE est gere par la Region (pas France Travail). Si accessible, il apporte 5 000 EUR de tresorerie supplementaire sans impact sur le resultat (pret a 0%). Total avec NACRE : 45 000 EUR.

**Strategie sans apport cash :**
1. Le pret d'honneur Initiative 95 (15 000 EUR) sert de **quasi-fonds propres** — la banque s'appuie dessus pour accorder le pret
2. L'apport en nature valorise le capital sans sortie de tresorerie
3. Ratio quasi-fonds propres / emprunt = 15 000 / 25 000 = **0.60** (complemente par l'apport en nature)
4. Regle Initiative 95 : le pret d'honneur ne depasse pas le montant du pret bancaire (15 000 ≤ 25 000 ✓)

### 6.4 Effet de levier

```
Quasi-fonds propres (pret d'honneur I95) = 15 000 EUR
Pret bancaire (garanti BPI 60%) = 25 000 EUR
Total tresorerie = 40 000 EUR (+ 5 000 EUR si NACRE)
Remboursements mensuels (a partir M7) = 728 EUR/mois (I95 278 + bancaire 450)
→ A partir M13 si NACRE : 821 EUR/mois (+ NACRE 93)
```

---

## 7. PREVISIONS FINANCIERES

### 7.1 Hypotheses cles

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| ARPA (revenu moyen/client) | 55 EUR/mois | Mix : 10% Free, 70% Basic (29 EUR), 20% Business (149 EUR) + credits |
| Nouveaux clients/mois (An 1) | 6-14 (progressif) | Free tier + groupes FB + reseaux sociaux + SEO + pub ciblee |
| Objectif clients fin annee | 110 (An 1), 325 (An 2), 550 (An 3) | Croissance acceleree via acquisition multi-canal |
| Churn mensuel | 3% An 1, 2.5% An 2, 2% An 3 | Benchmark SaaS PME (Baremetrics 2025) |
| Cout infra/mois | ~200 EUR fixe + ~5 EUR/client (scalable) | Render + Supabase + Anthropic + Twilio |
| Taux de charges sociales | 45% | SASU regime general |
| TVA | 20% | Standard |
| IS | 15% < 42 500 EUR, 25% au-dela | PME |
| Effectif | 1 (An 1), 1 + prestataires (An 2), 3 (An 3) | Premier recrutement CSM en An 3 |
| Remuneration fondateur Y1 | 7 200 EUR net (M7-M12) | Pas de salaire les 6 premiers mois |
| Remuneration fondateur Y2 | 24 000 EUR net (2 000/mois) | Croissance |
| Remuneration fondateur Y3 | 36 000 EUR net (3 000/mois) | Rentabilite confirmee |
| Comptabilite | 0 EUR | Fondateur = comptable diplome (BEP + 10 ans exp) |
| Loyer | 0 EUR | Societe hebergee au domicile du fondateur |

### 7.2 Compte de resultat previsionnel

| | An 1 (2026-27) | An 2 (2027-28) | An 3 (2028-29) |
|---|---|---|---|
| **CHIFFRE D'AFFAIRES** | | | |
| Abonnements SaaS + credits | 35 860 EUR | 149 710 EUR | 309 700 EUR |
| Setup / accompagnement | 6 000 EUR | 13 500 EUR | 16 000 EUR |
| **CA Total HT** | **41 860 EUR** | **163 210 EUR** | **325 700 EUR** |
| | | | |
| **CHARGES VARIABLES** | | | |
| Hebergement cloud (Render, Supabase) | 2 400 EUR | 4 800 EUR | 8 400 EUR |
| Services tiers (Anthropic, Twilio, Resend) | 3 200 EUR | 12 000 EUR | 24 000 EUR |
| Commissions Stripe (2.9%) | 1 200 EUR | 4 700 EUR | 9 500 EUR |
| **Total charges variables** | **6 800 EUR** | **21 500 EUR** | **41 900 EUR** |
| | | | |
| **MARGE BRUTE** | **35 060 EUR** | **141 710 EUR** | **283 800 EUR** |
| **Taux de marge brute** | **84%** | **87%** | **87%** |
| | | | |
| **CHARGES FIXES** | | | |
| Remuneration fondateur (net) | 7 200 EUR (M7-M12) | 24 000 EUR | 36 000 EUR |
| Charges sociales (45%) | 3 240 EUR | 10 800 EUR | 16 200 EUR |
| Prestataires externes (missions) | 0 EUR | 10 000 EUR | 6 000 EUR |
| Salaire support/CSM (a partir M25) | 0 EUR | 0 EUR | 24 000 EUR |
| Charges sociales CSM | 0 EUR | 0 EUR | 10 800 EUR |
| Marketing & acquisition | 3 600 EUR | 9 600 EUR | 14 400 EUR |
| Assurances (RC Pro) | 1 000 EUR | 1 200 EUR | 2 000 EUR |
| Comptable / juridique | 0 EUR | 0 EUR | 0 EUR |
| Materiel / licences | 500 EUR | 1 500 EUR | 2 500 EUR |
| Loyer / coworking | 0 EUR | 0 EUR | 0 EUR |
| Divers / imprevus | 1 200 EUR | 2 000 EUR | 3 000 EUR |
| **Total charges fixes** | **16 740 EUR** | **59 100 EUR** | **114 900 EUR** |
| | | | |
| **RESULTAT D'EXPLOITATION** | **18 320 EUR** | **82 610 EUR** | **168 900 EUR** |
| Charges financieres (interets emprunt) | 375 EUR | 625 EUR | 500 EUR |
| **RESULTAT COURANT** | **17 945 EUR** | **81 985 EUR** | **168 400 EUR** |
| IS (15%/25%) | 2 692 EUR | 16 246 EUR | 37 725 EUR |
| **RESULTAT NET** | **+15 253 EUR** | **+65 739 EUR** | **+130 675 EUR** |

**Points cles :**
- **Resultat net positif des l'An 1** (+15 253 EUR) grace au volume d'acquisition (110 clients fin An 1)
- **Forte croissance An 2** (+65 739 EUR, CA 163 210 EUR)
- **Rentabilite confirmee An 3** (+130 675 EUR, CA 325 700 EUR)
- Taux de marge brute SaaS excellent : 84-87%

### 7.3 Evolution du MRR et nombre de clients

| Mois | Nouveaux | Churn | Clients actifs | MRR |
|------|----------|-------|----------------|-----|
| M1 | 6 | 0 | 6 | 330 EUR |
| M2 | 7 | 0 | 13 | 715 EUR |
| M3 | 8 | 0 | 21 | 1 155 EUR |
| M4 | 9 | 1 | 29 | 1 595 EUR |
| M5 | 10 | 1 | 38 | 2 090 EUR |
| M6 | 10 | 1 | 47 | 2 585 EUR |
| M7 | 11 | 1 | 57 | 3 135 EUR |
| M8 | 12 | 2 | 67 | 3 685 EUR |
| M9 | 12 | 2 | 77 | 4 235 EUR |
| M10 | 13 | 2 | 88 | 4 840 EUR |
| M11 | 14 | 3 | 99 | 5 445 EUR |
| M12 | 14 | 3 | 110 | 6 050 EUR |
| **Fin An 1** | **126** | **16** | **110** | **6 050 EUR** |
| **Fin An 2** | **278** | **63** | **~325** | **17 875 EUR** |
| **Fin An 3** | **285** | **60** | **~550** | **30 250 EUR** |

### 7.4 Plan de tresorerie mensuel — Annee 1

| | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CA TTC | 750 | 1 260 | 1 850 | 2 430 | 3 080 | 3 680 | 4 400 | 5 110 | 5 770 | 6 560 | 7 340 | 8 070 |
| Pret I95 | 15 000 | | | | | | | | | | | |
| Pret bancaire | | | 25 000 | | | | | | | | | |
| NACRE (optionnel) | | | | | | (5 000) | | | | | | |
| **Total encaiss.** | **15 750** | **1 260** | **26 850** | **2 430** | **3 080** | **3 680** | **4 400** | **5 110** | **5 770** | **6 560** | **7 340** | **8 070** |
| | | | | | | | | | | | | |
| Charges | 1 305 | 845 | 912 | 953 | 1 022 | 1 065 | 3 579 | 3 624 | 4 493 | 3 741 | 3 789 | 5 435 |
| | | | | | | | | | | | | |
| **Solde mois** | +14 445 | +415 | +25 938 | +1 477 | +2 058 | +2 615 | +821 | +1 486 | +1 277 | +2 819 | +3 551 | +2 635 |
| **Treso cumulee** | **14 445** | **14 860** | **40 798** | **42 275** | **44 333** | **46 948** | **47 769** | **49 255** | **50 532** | **53 351** | **56 902** | **59 537** |

**La tresorerie reste positive et croissante chaque mois** (sans NACRE). Fin d'annee : **59 537 EUR** (ou 64 537 EUR avec NACRE). Solde positif chaque mois grace au volume d'acquisition.

### 7.5 Seuil de rentabilite

```
Charges fixes mensuelles An 1 = 1 395 EUR (moyenne — pas de salaire M1-M6, compta interne)
Marge brute par client = 50 EUR (ARPA 55 - charges variables 5)
Taux de marge brute = 84%
Seuil formel An 1 = 30 clients (reflete l'absence de salaire M1-M6)
Seuil "avec salaire plein" ≈ 50 clients
→ Seuil atteint M6-M7 (47 clients en M6, 57 en M7)
→ Resultat net positif des l'An 1 (+15 253 EUR)
```

### 7.6 BFR (Besoin en Fonds de Roulement)

```
Avantage SaaS : BFR quasi nul
- Creances clients : 0 (paiement CB immediat via Stripe)
- Stocks : 0 (produit numerique)
- Dettes fournisseurs : 30 jours standard (hebergement, services)

BFR = 0 + 0 - 1 mois de charges variables = -400 EUR
→ BFR negatif = la tresorerie est generee par l'activite
```

### 7.7 Capacite d'autofinancement (CAF)

| | An 1 | An 2 | An 3 |
|---|---|---|---|
| Resultat net | +15 253 EUR | +65 739 EUR | +130 675 EUR |
| + Amortissements | 1 500 EUR | 1 500 EUR | 1 500 EUR |
| **CAF** | **+16 753 EUR** | **+67 239 EUR** | **+132 175 EUR** |

---

## 8. ANALYSE DES RISQUES

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Acquisition clients lente | Moyenne | Fort | Offre Free sans engagement, demos IA "wow", terrain IDF + reseaux sociaux |
| Churn eleve | Faible | Fort | Onboarding automatise, credits IA inclus, valeur immediate (IA telephone) |
| Fondateur seul (bus factor) | Moyenne | Fort | Code documente, 484 tests, architecture maintenable, prestataires ponctuels An 2 |
| Panne technique | Faible | Fort | 484 tests, SENTINEL monitoring, PITR Supabase, CI/CD |
| Concurrent agressif | Moyenne | Moyen | IA telephone + gestion complete + multi-vertical = combinaison unique |
| Reglementation IA | Faible | Moyen | Conformite AI Act anticipee, donnees en Europe, RGPD natif |

---

## 9. CALENDRIER

| Etape | Date | Jalons |
|-------|------|--------|
| Transformation micro → SASU | Avril 2026 | Kbis SASU |
| Demande ACRE + NACRE | Avril 2026 | Exoneration charges + pret 0% |
| Depot dossier Initiative 95 | Avril 2026 | Pret d'honneur 15 000 EUR |
| Obtention pret d'honneur I95 | Mai 2026 | 15 000 EUR debloques |
| Depot dossier pret bancaire (BPI) | Mai 2026 | 25 000 EUR, garanti BPI 60% |
| Obtention pret bancaire + NACRE | Juin 2026 | 25 000 EUR debloques |
| Lancement commercial IDF | Mai-Juin 2026 | 20 premiers clients (terrain + reseaux) |
| Seuil de rentabilite (~50 clients) | M6-M7 | Resultat mensuel positif |
| 110 clients | Mars 2027 (M12) | MRR 6 050 EUR, ARR 72 600 EUR |
| 325 clients | Mi-2028 (An 2) | MRR 17 875 EUR, resultat net +65 739 EUR |
| Premier recrutement (CSM) | An 3 (M25) | Support client dedie |
| 550 clients | Mi-2029 (An 3) | MRR 30 250 EUR, resultat net +130 675 EUR |

---

## 10. CONCLUSION

NEXUS dispose d'un produit mature (v3.25.0, score technique 100/100, 484 tests automatises), d'un modele economique valide (SaaS freemium + credits IA, marge brute 84-87%), et d'un marche adressable massif (640 000 etablissements en France, 75% non equipes).

Le financement demande de **40 000 EUR** (+ 5 000 EUR NACRE en option) permettra de transformer un produit techniquement abouti en une entreprise commercialement viable. Le modele solo-founder ultra-frugal (pas de salaire M1-M6, compta geree en interne, domicile) genere un **resultat net positif des l'An 1** (+15 253 EUR) avec 110 clients. **Forte croissance An 2** (+65 739 EUR, 325 clients), confirmee en An 3 (+130 675 EUR, 550 clients, CA 325 700 EUR).

Le risque est maitrise : BFR quasi nul, **tresorerie positive et croissante chaque mois** (fin Y1 : 59 537 EUR sans NACRE), seuil de rentabilite a ~50 clients (atteint M6-M7), et un produit deja en production avec un client payant. Le differenciateur IA telephone/WhatsApp 24/7 est difficile a reproduire et genere un effet "wow" immediat aupres des prospects.

---

**Contact :**
Issouf Toure — Fondateur NEXUS
Email : contact@nexus-ai-saas.com
Tel : +33 7 60 53 76 94
Site : https://nexus-ai-saas.com
App : https://app.nexus-ai-saas.com
SIREN : 947 570 362 — Code APE : 5829C
