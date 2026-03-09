# BUSINESS PLAN — NEXUS
## Plateforme SaaS de gestion intelligente pour PME de services

**Version 1.0 — Mars 2026**
**Confidentiel**

---

## 1. EXECUTIVE SUMMARY

**NEXUS** est une plateforme SaaS tout-en-un qui permet aux PME de services (salons de coiffure, restaurants, hotels, services a domicile) de gerer l'integralite de leur activite depuis un seul outil : reservations, CRM, facturation, comptabilite, marketing automatise, et assistants IA.

### Le probleme
Les 1,2 million de PME de services en France utilisent en moyenne 4 a 7 outils differents (agenda papier ou Google, logiciel de caisse, fichier Excel clients, outil emailing...). Ce morcellement genere des pertes de temps (15h/semaine en gestion administrative), des erreurs, et un manque de visibilite sur leur activite.

### La solution
NEXUS remplace tous ces outils par une plateforme unique, avec des assistants IA integres qui automatisent les taches repetitives : prise de RDV par chatbot/telephone/WhatsApp, relances clients, facturation automatique, marketing cible.

### Traction actuelle
- Plateforme en production (v3.18.0), score technique 100/100
- 473 tests automatises, 0 echec
- 1 client Business en production (salon de coiffure)
- 74 routes API, 78 services backend, 43 pages frontend
- Stack complete operationnelle : IA (Claude/Anthropic), paiement (Stripe), communication (Twilio), email (Resend)
- Entreprise immatriculee (SIREN 947570362), comptes fournisseurs actifs, facturation en cours

### Demande de financement
**75 000 a 100 000 EUR** repartis entre pret bancaire, pret d'honneur et aides publiques, pour financer la phase de lancement commercial (12-18 mois).

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
| Prix entree | 99 EUR/mois | Gratuit* | Commission | 49 EUR/mois | Gratuit* |
| RGPD FR natif | Oui | Non (UK) | Non (UK) | Oui | Non (US) |

*Gratuit avec commissions sur transactions (3-5%)

**Avantage competitif cle :** NEXUS est la seule plateforme a combiner gestion complete + IA avancee + multi-vertical + conformite RGPD francaise, a un prix accessible aux TPE/PME.

---

## 3. LE PRODUIT

### 3.1 Architecture technique

NEXUS est bati sur une architecture multi-tenant avec isolation stricte des donnees (Tenant Shield). Chaque client dispose d'un espace completement isole, garanti par un systeme de protection verifie par 473 tests automatises.

**Stack technique :**
- Backend : Node.js/Express.js (74 routes, 78 services)
- Frontend : React/TypeScript/Vite (43 pages, 49 composants)
- Base de donnees : Supabase (PostgreSQL) avec RLS
- IA : Claude (Anthropic) — agents conversationnels
- Paiement : Stripe (abonnements, facturation, dunning)
- Communication : Twilio (SMS, appels, WhatsApp)
- Email : Resend (transactionnel + marketing)
- Monitoring : SENTINEL (systeme proprietaire)
- Deploiement : Render (cloud)

### 3.2 Modules fonctionnels

| Module | Plan | Description |
|--------|------|-------------|
| Agenda & Reservations | Tous | Calendrier, RDV, multi-services |
| CRM & Clients | Tous | Fichier client, historique, import CSV |
| Facturation | Tous | Auto-generation, relances, avoirs |
| Programme Fidelite | Tous | Points, recompenses, classement |
| Liste d'attente | Tous | Notification auto sur annulation |
| Comptabilite | Pro+ | P&L, rapprochement, expert-comptable |
| Marketing | Pro+ | Segments, workflows, campagnes A/B |
| Stock | Pro+ | Inventaire, alertes, mouvements |
| RH & Planning | Pro+ | Equipe, conges, evaluations |
| Agent IA Web | Pro+ | Chatbot 24/7 sur site client |
| Agent IA Telephone | Pro+ | Assistant vocal appels entrants |
| Agent IA WhatsApp | Pro+ | Bot WhatsApp pour clients |
| SENTINEL Monitoring | Business | Dashboard temps reel, alertes |
| SEO & Visibilite | Business | Articles IA, Google My Business |
| API & Webhooks | Business | Integration tierce |

### 3.3 Grille tarifaire

| Plan | Mensuel | Annuel | Cible |
|------|---------|--------|-------|
| **Starter** | 99 EUR/mois | 950 EUR/an (-20%) | Solo, demarrage |
| **Pro** | 249 EUR/mois | 2 390 EUR/an (-20%) | PME etablie |
| **Business** | 499 EUR/mois | 4 790 EUR/an (-20%) | Multi-sites, avance |

**ARPA cible (revenu moyen par compte) :** 199 EUR/mois (mix 50% Starter, 35% Pro, 15% Business)

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
- Demarchage direct salons/restaurants IDF (quartier par quartier)
- Offre early-adopter : 3 mois gratuits puis prix lance (-30%)
- Partenariat avec 2-3 federations professionnelles locales

**Phase 2 — Croissance (T3-T4 2026) :** 50 a 100 clients
- SEO/Content marketing (blog, guides sectoriels, tutos video)
- Google Ads cible (mots-cles metier : "logiciel salon coiffure", etc.)
- Programme de parrainage (50 EUR de credit par filleul converti)

**Phase 3 — Acceleration (2027) :** 200+ clients
- Partenariats distributeurs (grossistes coiffure, equipementiers hotel)
- Presence salons professionnels (Mondial Coiffure, EquipHotel, Sirha)
- Programme revendeurs/integrateurs

### 4.2 Funnel d'acquisition

```
Visiteurs site       → 5 000/mois (SEO + Ads)
Inscriptions essai   → 250/mois (taux 5%)
Activation (setup)   → 125/mois (taux 50%)
Conversion payant    → 50/mois (taux 40%)
Retention M3+        → 45/mois (churn 10% M1, puis 2.5%/mois)
```

### 4.3 Metriques cibles

| Metrique | Cible An 1 | Cible An 3 |
|----------|-----------|-----------|
| CAC (cout acquisition client) | 150 EUR | 100 EUR |
| LTV (valeur vie client) | 4 776 EUR | 5 970 EUR |
| Ratio LTV:CAC | 31.8x | 59.7x |
| CAC Payback | 0.8 mois | 0.5 mois |
| Churn mensuel | 3% | 2% |
| NRR (Net Revenue Retention) | 105% | 115% |

---

## 5. EQUIPE

### 5.1 Fondateur

**Issouf Toure** — CEO & CTO
- Entrepreneur autodidacte : a appris le developpement en construisant NEXUS de zero jusqu'a la v3.18.0
- 18 mois de R&D en autonomie complete — preuve de capacite d'apprentissage et de determination
- Maitrise acquise sur le terrain : React, Node.js, PostgreSQL, IA (Claude/Anthropic), Stripe, Twilio
- Experience entrepreneuriale prealable (projet tech 2023)
- Connaissance terrain des besoins des PME de services (1er client en production)
- SIREN : 947570362 — Nexus.AI, Franconville (95130)

### 5.2 Plan de recrutement

| Poste | Timing | Salaire brut annuel | Priorite |
|-------|--------|-------------------|----------|
| Developpeur full-stack | T2 2026 | 40 000 EUR | Critique |
| Commercial terrain IDF | T3 2026 | 32 000 EUR + variable | Haute |
| Support client / CSM | T4 2026 | 30 000 EUR | Moyenne |

### 5.3 Advisors envisages
- Expert-comptable specialise SaaS
- Mentor reseau Initiative 95 / WILCO
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

### 6.1 Besoin total : 85 000 EUR

| Poste | Montant | % |
|-------|---------|---|
| Tresorerie d'avance (BFR + runway 6 mois) | 25 000 EUR | 29% |
| Marketing lancement (SEO, Ads, salons) | 20 000 EUR | 24% |
| Infrastructure (upgrade Supabase Pro, CDN, backups) | 10 000 EUR | 12% |
| Recrutement dev (3 premiers mois salaire charges) | 20 000 EUR | 24% |
| Juridique, comptable, assurances | 5 000 EUR | 6% |
| Materiel (poste dev, ecrans) | 5 000 EUR | 6% |
| **TOTAL** | **85 000 EUR** | **100%** |

### 6.2 Actif technologique du fondateur (pas d'apport cash)

Le fondateur ne dispose pas d'apport en tresorerie mais a investi **18 mois de developpement** dans un actif logiciel en production :

| Element | Valorisation conservative |
|---------|--------------------------|
| Developpement plateforme (v3.18.0, 18 mois de travail) | 80 000 EUR |
| 74 routes API, 78 services, 43 pages frontend | inclus |
| 473 tests automatises, score technique 100/100 | inclus |
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
| Pret d'honneur Initiative 95 | 15 000 EUR | Quasi-fonds propres (0%) | A demander |
| Pret d'honneur WILCO | 30 000 EUR | Quasi-fonds propres (0%) | A demander |
| Pret bancaire (garanti BPI 60%) | 30 000 EUR | Emprunt 5 ans | A demander |
| NACRE phase 2 (si eligible) | 10 000 EUR | Pret 0%, 5 ans | A verifier |
| **TOTAL TRESORERIE** | **85 000 EUR** | | |

**Strategie sans apport cash :**
1. Les prets d'honneur (45 000 EUR) servent de **quasi-fonds propres** — les banques les assimilent aux capitaux propres
2. L'apport en nature valorise le capital social sans sortie de tresorerie
3. Ratio quasi-fonds propres / emprunt = 45 000 / 30 000 = **1.5** (superieur au seuil bancaire de 1.0)

**Plan B si WILCO non obtenu :**
- Bourse French Tech BPI : 25 000 EUR (subvention)
- Pret bancaire elargi : 40 000 EUR
- TP'UP Region IDF : 15 000 EUR (subvention)
- ADIE micro-credit : jusqu'a 12 000 EUR (si necessaire)

### 6.4 Effet de levier

```
Quasi-fonds propres (prets d'honneur) = 45 000 EUR
Pret bancaire = 30 000 EUR
NACRE (si eligible) = 10 000 EUR
Ratio quasi-FP / emprunt = 1.5 (bon, banques exigent > 1)
Effet levier prets d'honneur : 1 EUR = 7 EUR de pret bancaire
→ 45 000 EUR de prets d'honneur permettent jusqu'a 315 000 EUR de pret bancaire
```

---

## 7. PREVISIONS FINANCIERES

### 7.1 Hypotheses cles

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| ARPA (revenu moyen/client) | 199 EUR/mois | Mix : 50% Starter, 35% Pro, 15% Business |
| Nouveaux clients/mois (An 1) | 5 puis croissance | Demarrage prudent, acceleration T3 |
| Churn mensuel | 3% An 1, 2.5% An 2, 2% An 3 | Benchmark SaaS PME |
| Cout hebergement/client | 8 EUR/mois | Render + Supabase + Twilio proratise |
| Taux de charges sociales | 45% | Regime general |
| TVA | 20% | Standard |
| IS | 15% < 42 500 EUR, 25% au-dela | PME |

### 7.2 Compte de resultat previsionnel

| | An 1 (2026-27) | An 2 (2027-28) | An 3 (2028-29) |
|---|---|---|---|
| **CHIFFRE D'AFFAIRES** | | | |
| Abonnements SaaS | 71 640 EUR | 238 800 EUR | 477 600 EUR |
| Setup fees / accompagnement | 3 000 EUR | 8 000 EUR | 15 000 EUR |
| **CA Total HT** | **74 640 EUR** | **246 800 EUR** | **492 600 EUR** |
| | | | |
| **CHARGES VARIABLES** | | | |
| Hebergement cloud (Render, Supabase) | 3 600 EUR | 9 600 EUR | 18 000 EUR |
| Services tiers (Twilio, Resend, Anthropic) | 4 800 EUR | 14 400 EUR | 28 800 EUR |
| Commissions Stripe (1.4%+0.25) | 1 200 EUR | 3 800 EUR | 7 500 EUR |
| **Total charges variables** | **9 600 EUR** | **27 800 EUR** | **54 300 EUR** |
| | | | |
| **MARGE BRUTE** | **65 040 EUR** | **219 000 EUR** | **438 300 EUR** |
| **Taux de marge brute** | **87%** | **89%** | **89%** |
| | | | |
| **CHARGES FIXES** | | | |
| Salaire fondateur | 24 000 EUR | 36 000 EUR | 42 000 EUR |
| Salaire dev (a partir T2) | 15 000 EUR | 48 000 EUR | 52 000 EUR |
| Salaire commercial (a partir T3) | 8 000 EUR | 38 400 EUR | 42 000 EUR |
| Salaire support/CSM (a partir T4 An 2) | 0 EUR | 10 000 EUR | 36 000 EUR |
| Charges sociales (45%) | 21 150 EUR | 59 580 EUR | 77 400 EUR |
| Marketing & acquisition | 12 000 EUR | 24 000 EUR | 36 000 EUR |
| Loyer bureau / coworking | 3 600 EUR | 6 000 EUR | 9 600 EUR |
| Assurances (RC Pro, cyber) | 1 500 EUR | 2 000 EUR | 2 500 EUR |
| Comptable / juridique | 3 000 EUR | 4 000 EUR | 5 000 EUR |
| Materiel / licences | 3 000 EUR | 2 000 EUR | 3 000 EUR |
| Divers / imprevus | 2 000 EUR | 3 000 EUR | 4 000 EUR |
| **Total charges fixes** | **93 250 EUR** | **232 980 EUR** | **309 500 EUR** |
| | | | |
| **RESULTAT D'EXPLOITATION** | **-28 210 EUR** | **-13 980 EUR** | **128 800 EUR** |
| Charges financieres (interets emprunt) | 900 EUR | 750 EUR | 600 EUR |
| **RESULTAT COURANT** | **-29 110 EUR** | **-14 730 EUR** | **128 200 EUR** |
| IS (15% puis 25%) | 0 EUR | 0 EUR | 27 275 EUR |
| **RESULTAT NET** | **-29 110 EUR** | **-14 730 EUR** | **100 925 EUR** |

### 7.3 Evolution du MRR et nombre de clients

| Mois | Nouveaux | Churn | Clients actifs | MRR |
|------|----------|-------|----------------|-----|
| M1 | 3 | 0 | 3 | 597 EUR |
| M2 | 3 | 0 | 6 | 1 194 EUR |
| M3 | 4 | 0 | 10 | 1 990 EUR |
| M4 | 4 | 0 | 14 | 2 786 EUR |
| M5 | 5 | 0 | 19 | 3 781 EUR |
| M6 | 5 | 1 | 23 | 4 577 EUR |
| M7 | 6 | 1 | 28 | 5 572 EUR |
| M8 | 7 | 1 | 34 | 6 766 EUR |
| M9 | 8 | 1 | 41 | 8 159 EUR |
| M10 | 8 | 1 | 48 | 9 552 EUR |
| M11 | 9 | 1 | 56 | 11 144 EUR |
| M12 | 10 | 2 | 64 | 12 736 EUR |
| **Fin An 1** | **72** | **8** | **64** | **12 736 EUR** |
| **Fin An 2** | | | **~140** | **27 860 EUR** |
| **Fin An 3** | | | **~250** | **49 750 EUR** |

### 7.4 Plan de tresorerie mensuel — Annee 1

| | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **ENCAISSEMENTS** | | | | | | | | | | | | |
| CA TTC | 716 | 1 433 | 2 388 | 3 343 | 4 537 | 5 492 | 6 686 | 8 119 | 9 791 | 11 462 | 13 373 | 15 283 |
| Pret honneur I95 | 15 000 | | | | | | | | | | | |
| Pret honneur WILCO | | 30 000 | | | | | | | | | | |
| Pret bancaire | | | 30 000 | | | | | | | | | |
| NACRE phase 2 | | | | 10 000 | | | | | | | | |
| **Total encaiss.** | **15 716** | **31 433** | **32 388** | **13 343** | **4 537** | **5 492** | **6 686** | **8 119** | **9 791** | **11 462** | **13 373** | **15 283** |
| | | | | | | | | | | | | |
| **DECAISSEMENTS** | | | | | | | | | | | | |
| Hebergement | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 |
| Services tiers | 200 | 250 | 300 | 350 | 400 | 400 | 450 | 500 | 500 | 500 | 500 | 500 |
| Stripe commissions | 10 | 20 | 35 | 50 | 65 | 80 | 100 | 120 | 145 | 170 | 200 | 225 |
| Salaire fondateur | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 |
| Salaire dev | 0 | 0 | 0 | 2 500 | 2 500 | 2 500 | 2 500 | 2 500 | 2 500 | 2 500 | 2 500 | 2 500 |
| Salaire commercial | 0 | 0 | 0 | 0 | 0 | 0 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 | 2 000 |
| Charges sociales | 900 | 900 | 900 | 2 025 | 2 025 | 2 025 | 2 925 | 2 925 | 2 925 | 2 925 | 2 925 | 2 925 |
| Marketing | 500 | 500 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 | 1 000 |
| Loyer/coworking | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 | 300 |
| Assurances | 125 | 125 | 125 | 125 | 125 | 125 | 125 | 125 | 125 | 125 | 125 | 125 |
| Comptable | 250 | 250 | 250 | 250 | 250 | 250 | 250 | 250 | 250 | 250 | 250 | 250 |
| Materiel | 3 000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Remb. emprunt | 0 | 0 | 0 | 0 | 0 | 0 | 575 | 575 | 575 | 575 | 575 | 575 |
| **Total decaiss.** | **7 585** | **4 645** | **5 210** | **8 900** | **8 965** | **8 980** | **12 525** | **12 595** | **12 620** | **12 645** | **12 675** | **12 700** |
| | | | | | | | | | | | | |
| **Solde du mois** | +8 131 | +26 788 | +27 178 | +4 443 | -4 428 | -3 488 | -5 839 | -4 476 | -2 829 | -1 183 | +698 | +2 583 |
| **Treso cumulee** | **8 131** | **34 919** | **62 097** | **66 540** | **62 112** | **58 624** | **52 785** | **48 309** | **45 480** | **44 297** | **44 995** | **47 578** |

**La tresorerie reste positive chaque mois**, avec un point bas a 44 297 EUR au mois 10. Le NACRE phase 2 en M4 compense l'absence d'apport personnel et maintient un coussin confortable.

### 7.5 Seuil de rentabilite

```
Charges fixes annuelles An 1 = 93 250 EUR
Taux de marge brute = 87%
Seuil de rentabilite = 93 250 / 0.87 = 107 184 EUR de CA/an
= 8 932 EUR MRR
= ~45 clients au ARPA de 199 EUR

→ Seuil atteint au mois 9-10 de l'Annee 1 en MRR
→ Rentabilite pleine en Annee 3
```

### 7.6 BFR (Besoin en Fonds de Roulement)

```
Avantage SaaS : BFR quasi nul
- Creances clients : 0 (paiement CB immediat via Stripe)
- Stocks : 0 (produit numerique)
- Dettes fournisseurs : 30 jours standard (hebergement, services)

BFR = 0 + 0 - 1 mois de charges variables = -800 EUR
→ BFR negatif = la tresorerie est generee par l'activite
```

### 7.7 Capacite d'autofinancement (CAF)

| | An 1 | An 2 | An 3 |
|---|---|---|---|
| Resultat net | -29 110 EUR | -14 730 EUR | 100 925 EUR |
| + Amortissements | 1 500 EUR | 1 500 EUR | 1 500 EUR |
| **CAF** | **-27 610 EUR** | **-13 230 EUR** | **102 425 EUR** |

---

## 8. ANALYSE DES RISQUES

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Acquisition clients lente | Moyenne | Fort | Offre freemium limitee, partenariats distributeurs |
| Churn eleve | Faible | Fort | Onboarding assiste, CSM dedie, programme fidelite |
| Panne technique | Faible | Fort | 473 tests, SENTINEL monitoring, backups |
| Concurrent agressif | Moyenne | Moyen | Multi-vertical = differenciateur difficile a copier |
| Reglementation IA | Faible | Moyen | Conformite AI Act anticipee, donnees en Europe |

---

## 9. CALENDRIER

| Etape | Date | Jalons |
|-------|------|--------|
| Transformation micro → SASU | Mars 2026 | Kbis SASU, apport en nature formalise |
| Demande ACRE + NACRE | Mars 2026 | Exoneration charges + pret 0% |
| Depot dossiers financement | Mars-Avril 2026 | Initiative 95, WILCO, BPI |
| Obtention prets d'honneur | Mai 2026 | 15-45k EUR debloques |
| Pret bancaire | Juin 2026 | 30k EUR debloques |
| Lancement commercial IDF | Juin 2026 | 10 premiers clients |
| Recrutement dev | Juillet 2026 | 1 dev full-stack |
| 50 clients | Decembre 2026 | Breakeven MRR |
| Recrutement commercial | Janvier 2027 | Acceleration acquisition |
| 100 clients | Juin 2027 | ARR > 200k EUR |
| Rentabilite operationnelle | 2028 | Resultat net positif |

---

## 10. CONCLUSION

NEXUS dispose d'un produit mature (v3.18.0, 100/100 technique, 473 tests), d'un modele economique eprouve (SaaS par abonnement, marge brute 87%), et d'un marche adressable massif (640 000 etablissements en France, 75% non equipes).

Le financement demande de 85 000 EUR permettra de transformer un produit techniquement abouti en une entreprise commercialement viable, avec un chemin clair vers la rentabilite en Annee 3 et un CA previsionnel de pres de 500 000 EUR.

Le risque est maitrise : BFR quasi nul, tresorerie positive chaque mois, et un produit deja en production avec un client payant.

---

**Contact :**
Issouf Toure — Fondateur NEXUS
Email : nexussentinelai@yahoo.com
Tel : +33 7 60 53 76 94
Site : https://nexus-ai-saas.com
App : https://app.nexus-ai-saas.com
SIREN : 947 570 362 — Code APE : 5829C
