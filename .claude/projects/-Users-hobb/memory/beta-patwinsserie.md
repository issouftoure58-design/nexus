# Beta Tester — Patwinsserie

## Activite
Formation en cake design (reconversion pro, complement revenus). Certifiee **Qualiopi**.
Contenu heberge sur GoHighLevel (videos + PDF).

## Stack actuel
- GoHighLevel: hebergement formation
- ManyChat: automation DM Instagram (CTA commentaire → ebook en DM)
- Calendly: booking appels visio closing
- Zapier: filtrage prospects non qualifies (questionnaire capacite investissement)
- Stripe: paiement
- systeme.io: VSL tunnel alternatif (http://patwinsserie-academy.systeme.io/vsl)
- Discord: communaute apprenants (groupe prive)

## Tunnel de vente
Instagram/TikTok (Reels educatifs) → CTA commentaire ("GUIDE"/"EBOOK")
→ ManyChat envoie ebook en DM
→ Ebook apporte valeur + CTA fin: reserver appel visio
→ Questionnaire prequalification (Calendly) avec filtre capacite investissement
→ Si non qualifie: Zapier → email "revenez quand pret"
→ Si qualifie: appel visio closing
→ Paiement Stripe → onboarding manuel (1h30/apprenant)

## Process post-paiement actuel (MANUEL - 1h30/apprenant)
1. Envoi contrat, attente retour signe (impression/scan)
2. Envoi email acces plateforme GHL (identifiants + lien connexion)
3. Appel visio: explication navigation plateforme
4. Discord: demander telecharger app + creer compte + invitation groupe prive
5. Appel visio: explication utilisation Discord

## Automatisation souhaitee (post-paiement)
### Mail 1 — Apres paiement Stripe
- Contrat avec signature electronique
- Programme de formation (PDF)
- CGV (PDF)
- Copie auto aux 2 parties apres signature

### Mail 2 — Apres signature contrat
- Lien creation acces GHL (identifiant + mot de passe)
- Lien connexion plateforme (+ astuce favori navigateur)
- Lien video tuto navigation plateforme

### Mail 3 — Apres Mail 2
- Guide telechargement Discord + creation compte
- Lien invitation groupe prive Discord
- Lien video tuto Discord

### Drive avec contenus prepares
https://drive.google.com/drive/folders/1NtKPbq3JOz2hw39kq2UUd7L7VHn_MM3l?usp=drive_link

## Conformite Qualiopi (audits tous les 18 mois)
Documents a conserver:
- [x] Contrat signe
- [x] Programme de formation envoye
- [x] CGV envoye
- [x] Feuilles emargement (visio pendant formation)
- [x] Enquetes satisfaction a chaud (pendant formation)
- [x] Enquetes satisfaction a froid (quelques semaines/mois apres fin formation 6 mois)

## Ce que NEXUS doit construire
1. **Setter IA Instagram** — IA en DM qui relance apres ebook, qualifie, pousse vers Calendly
2. **Module Onboarding Automatise** — Stripe webhook → emails sequences → Yousign
3. **Integration Yousign** — signature electronique contrat
4. **Dashboard Qualiopi** — suivi documents, conformite, alertes
5. **Enquetes satisfaction** — formulaires auto envoyes a chaud (mi-formation) et a froid (post-formation)
6. **Discord webhook** — invitation automatique groupe prive (optionnel)

## Setter IA Instagram — Detail
### Fonction
Apres que ManyChat envoie l'ebook en DM, le setter IA prend le relais pour engager la conversation, qualifier le prospect, et le pousser vers un appel Calendly.

### Flow
1. ManyChat envoie l'ebook (declenche par commentaire mot-cle)
2. Setter IA attend un delai (ex: 30min-1h) puis engage la conversation en DM
   → "Tu as eu le temps de regarder le guide ? Qu'est-ce qui t'a le plus interesse ?"
3. IA pose des questions de qualification (situation pro, objectifs, timeline)
4. Si qualifie → envoie lien Calendly + message motivant
5. Si pas qualifie → nurture doux (contenu supplementaire, relance plus tard)
6. Si pas de reponse → relance J+1, J+3 (max 2 relances)

### Canal
Meta Instagram Messaging API (necessite Meta Business verification + Instagram Pro account)

### Prerequis techniques
- API Meta (Instagram Graph API + Messaging API)
- Webhook pour recevoir les messages entrants DM
- Handoff ManyChat → NEXUS (ou remplacement ManyChat par NEXUS directement)

## Ce que NEXUS ne remplace pas
- ManyChat (automation Instagram — fonctionne bien)
- Calendly (booking appels)
- GoHighLevel (hebergement formation — pas d'API creation compte)
- Discord (communaute)

## Priorite
1. Setter IA Instagram (qualification + relance DM apres ebook)
2. Onboarding automatise (elimine 1h30 manuelle/apprenant)
3. Signature electronique Yousign
4. Dashboard Qualiopi
5. Enquetes satisfaction
