# NEXUS — Modules à venir

> Documenté le 7 mars 2026 — À implémenter ultérieurement
> Priorité : Post-commercialisation

---

## Module 1 : Gestion automatique des immobilisations

### Principe
Détection automatique des immobilisations lors de l'upload d'une facture de dépense, avec génération des écritures comptables et suivi via un tableau d'immobilisations.

### Fonctionnement prévu

1. **Détection auto à l'upload**
   - Quand le client saisit/upload une facture de dépense, le système détecte si le montant et la nature correspondent à une immobilisation (seuil configurable, ex: > 500€ HT)
   - Analyse du libellé / catégorie pour suggérer le type d'immo (matériel, mobilier, véhicule, logiciel, etc.)
   - Notification au client : "Cette dépense semble être une immobilisation. Confirmez-vous ?"

2. **Validation par le client**
   - Choix de la durée d'amortissement (suggestions par défaut selon le type : mobilier 10 ans, matériel informatique 3 ans, véhicule 5 ans, etc.)
   - Choix du mode d'amortissement : linéaire (par défaut) ou dégressif
   - Possibilité de modifier la date de mise en service

3. **Écritures comptables automatiques**
   - Écriture d'acquisition (débit compte d'immo, crédit fournisseur)
   - Dotation aux amortissements mensuelle/annuelle automatique
   - Écriture de cession le cas échéant

4. **Tableau des immobilisations**
   - Vue complète : bien, date acquisition, valeur brute, amortissement cumulé, VNC
   - Export pour liasse fiscale
   - Alertes : fin d'amortissement, biens totalement amortis

### Tables à créer
- `immobilisations` (id, tenant_id, facture_id, libelle, type_immo, valeur_acquisition, date_acquisition, date_mise_service, duree_amortissement, mode_amortissement, compte_immo, compte_amortissement, statut)
- `amortissements` (id, tenant_id, immobilisation_id, exercice, mois, dotation, amortissement_cumule, vnc)

---

## Module 2 : Clôture annuelle automatique

### Principe
Automatisation complète des opérations de clôture d'exercice : détection des charges/produits à régulariser, écritures de cut-off, contrôles de cohérence.

### Opérations de clôture couvertes

1. **Charges constatées d'avance (CCA)**
   - Détection auto des factures de dépense qui chevauchent 2 exercices ou plus
   - Factures récurrentes (abonnements, forfaits, assurances) : prorata automatique
   - Écriture : débit 486 CCA, crédit compte de charge
   - Extourne automatique à l'ouverture N+1

2. **Produits constatés d'avance (PCA)**
   - Même logique sur les ventes : factures de vente couvrant une période à cheval
   - Écriture : débit compte de produit, crédit 487 PCA
   - Extourne N+1

3. **Factures non parvenues (FNP)**
   - Détection des charges récurrentes attendues mais pas encore facturées à la clôture
   - Détection de "trous" : si un abonnement mensuel n'a pas de facture pour décembre, alerte + suggestion FNP
   - Écriture : débit compte de charge, crédit 408 FNP

4. **Factures à établir (FAE)**
   - Prestations réalisées mais pas encore facturées
   - Détection via réservations/prestations terminées sans facture associée
   - Écriture : débit 418 FAE, crédit compte de produit

5. **Variation de stock**
   - Si module stock actif : calcul automatique de la variation (stock final - stock initial)
   - Écriture de variation de stock

6. **Ajustements immobilisations**
   - Dotation aux amortissements prorata temporis si mise en service en cours d'exercice
   - Lien avec Module 1

7. **Ajustements paie**
   - Provision congés payés
   - Charges sociales à payer
   - Primes à verser

### Détection intelligente

- **Factures récurrentes** : le système identifie les patterns (même fournisseur, montant similaire, périodicité régulière) → marque comme "récurrent" → détecte si une facture manque
- **Chevauchement** : analyse date début / date fin de la prestation vs dates d'exercice → calcul prorata automatique
- **Trous** : si fournisseur X facture tous les mois et qu'il manque un mois → alerte "FNP probable"

### Workflow clôture

1. Le client lance "Préparer la clôture" pour l'exercice N
2. Le système analyse toutes les écritures et factures
3. Rapport de pré-clôture avec :
   - Liste des CCA/PCA/FNP/FAE détectés
   - Alertes (trous, incohérences)
   - Écritures proposées
4. Le client valide (ou ajuste) chaque écriture
5. Génération automatique des écritures de clôture
6. Génération des extournes d'ouverture N+1

### Tables à créer
- `exercices_comptables` (id, tenant_id, date_debut, date_fin, statut, cloture_at)
- `ecritures_cloture` (id, tenant_id, exercice_id, type, facture_id, montant, compte_debit, compte_credit, statut, validee_par)
- `factures_recurrentes` (id, tenant_id, fournisseur, montant_moyen, periodicite, derniere_facture, pattern_detecte)

---

## Module 3 : Gestion email pro par l'assistant IA NEXUS

### Principe
Permettre à l'assistant IA NEXUS de gérer la boîte mail professionnelle du client : lecture, tri, réponse, résumé, actions automatiques. Le client délègue la gestion courante de ses emails à l'IA.

### Fonctionnement prévu

1. **Connexion boîte mail**
   - OAuth2 pour Gmail (Google Workspace) et Outlook (Microsoft 365)
   - IMAP/SMTP pour les boîtes mail classiques (OVH, Gandi, etc.)
   - Le client autorise l'accès en lecture + envoi depuis Paramètres > Intégrations

2. **Lecture et tri automatique**
   - L'IA lit les emails entrants et les catégorise : client, fournisseur, admin, spam, perso
   - Détection des emails urgents (impayés, annulations, réclamations)
   - Résumé quotidien : "Vous avez reçu 12 emails. 3 nécessitent votre attention."
   - Lien avec le CRM : si l'expéditeur est un client connu, enrichit la fiche

3. **Réponses assistées / automatiques**
   - L'IA propose des brouillons de réponse basés sur le contexte (historique client, services, tarifs)
   - Réponses automatiques configurables : confirmations RDV, accusés de réception, demandes de devis
   - Le client peut valider/modifier avant envoi, ou activer le mode auto pour certaines catégories
   - Ton et signature personnalisés par tenant

4. **Actions déclenchées par email**
   - Email de demande de RDV → l'IA crée la réservation et confirme
   - Email de demande de devis → l'IA génère le devis et l'envoie
   - Facture fournisseur reçue → l'IA la catégorise en dépense (lien Module 1 immobilisations)
   - Réclamation → l'IA alerte le client + crée un ticket

5. **Interface dans le chat admin**
   - Depuis le chat IA admin : "Montre-moi mes emails non lus", "Réponds à ce fournisseur", "Résume les emails de la semaine"
   - Outils chat : `lire_emails`, `repondre_email`, `resume_emails`, `chercher_email`

### Sécurité et confidentialité
- Tokens OAuth stockés chiffrés en DB
- Aucun email stocké en clair côté NEXUS (traitement en mémoire, seuls les métadonnées et résumés sont persistés)
- Le client peut révoquer l'accès à tout moment
- Logs d'actions email dans l'audit log

### Tables à créer
- `email_connections` (id, tenant_id, provider, email_address, oauth_tokens_encrypted, imap_config_encrypted, status, connected_at)
- `email_rules` (id, tenant_id, category, action, auto_reply, template_id, is_active)
- `email_summaries` (id, tenant_id, date, total_received, categories_count, urgent_count, summary_text)

---

## Notes techniques

- Modules 1 et 2 s'intègrent au module comptabilité existant (plan comptable, écritures, journaux)
- Module 3 s'intègre au chat admin IA (105 outils existants) + nouveau module email
- Nécessitent le plan Pro minimum (Module 3 potentiellement Business)
- L'IA assiste dans la détection, catégorisation et rédaction
- Priorité à l'UX : le client non-comptable doit comprendre ce qui se passe
- Module 3 : respecter RGPD strictement (pas de stockage email en clair, consentement explicite)
