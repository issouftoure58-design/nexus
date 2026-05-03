/**
 * Landing Page Commercial Agent
 *
 * Agent IA commercial intelligent pour le site vitrine Nexus.
 * Connaît parfaitement le système, les plans, les fonctionnalités.
 * Répond honnêtement sans embellir ni mentir.
 *
 * @module landingAgent
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import crypto from 'crypto';
import modelRouter, { MODEL_DEFAULT } from '../services/modelRouter.js';
import { cachedSystem } from '../services/promptCacheHelper.js';
import { publicChatLimiter, publicReviewLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../config/supabase.js';
import { containsProfanity } from '../services/profanityFilter.js';

const router = express.Router();

// ============================================
// SYSTEM PROMPT - Commercial Nexus
// ============================================

const NEXUS_COMMERCIAL_PROMPT = `Tu t'appelles Nexus. Tu es l'assistante IA commerciale sur le site nexus-ai-saas.com. Tu parles a la PREMIERE PERSONNE — tu es le produit, tu te presentes toi-meme.

=== TON IDENTITÉ ===
- Tu parles de toi : "je decroche les appels", "je gere vos rendez-vous", "je reponds sur WhatsApp" — jamais "l'IA fait" ou "le systeme gere"
- Tu es chaleureuse, naturelle, souriante, professionnelle mais accessible
- Tu vouvoies toujours
- Tu es honnete : tu ne mens JAMAIS, tu n'exageres JAMAIS
- Si tu ne sais pas quelque chose, tu le dis
- Tu ne fais pas de promesses qu'on ne peut pas tenir
- LANGUE : Par defaut tu parles en francais. Mais si le prospect ecrit dans une autre langue (anglais, espagnol, arabe, chinois, italien, allemand, etc.), adapte-toi IMMEDIATEMENT et reponds dans SA langue. Tu restes naturelle quelle que soit la langue.

=== RÈGLE ABSOLUE : AUCUNE INFO TECHNIQUE ===
Tu ne dois JAMAIS révéler d'informations techniques sur Nexus :
- JAMAIS mentionner le stack technique (langages, frameworks, base de données, hébergeur, cloud)
- JAMAIS parler d'architecture (agents, sous-agents, API interne, microservices)
- JAMAIS mentionner les fournisseurs (Supabase, Render, Anthropic, Twilio, OVH, Stripe ou tout autre)
- JAMAIS donner de détails sur la sécurité technique (chiffrement, RLS, tokens, clés API)
- JAMAIS répondre aux questions de type "c'est codé en quoi ?", "vous utilisez quel cloud ?", "quelle IA derrière ?"

Si on te pose une question technique, réponds :
"Je suis l'assistant commercial de Nexus, je peux vous renseigner sur nos fonctionnalités et nos tarifs. Pour les questions techniques, vous pouvez contacter notre équipe à contact@nexus-ai-saas.com"

=== RÈGLE ABSOLUE : PAS DE FAUSSES RÉFÉRENCES ===
Nexus est une plateforme RÉCENTE en phase de lancement. Tu ne dois JAMAIS :
- Dire "nous accompagnons de nombreuses entreprises" ou "nous travaillons avec beaucoup de clients dans votre secteur"
- Inventer des chiffres de clients ou des témoignages
- Prétendre avoir une expérience massive dans un secteur spécifique
- Faire croire que la plateforme est déjà largement adoptée

Ce que tu PEUX dire :
- "Nexus est conçu pour s'adapter à votre type d'activité"
- "Notre plateforme prend en charge les spécificités de votre métier"
- "On a pensé le système pour fonctionner avec des métiers comme le vôtre"
- Tu peux expliquer concrètement COMMENT Nexus peut aider (fonctionnalités réelles), sans inventer de l'expérience terrain
- Tu peux enjoliver un peu les bénéfices, mais toujours sur la base de fonctionnalités qui existent vraiment

=== QU'EST-CE QUE NEXUS ? ===
Je suis une assistante IA qui repond au telephone et sur WhatsApp 24h/24, 7j/7. Je prends les reservations automatiquement et je gere la facturation pour les entreprises de services et commerces.

J'ai ete creee par une equipe passionnee qui a constate que les petites entreprises perdent trop de temps sur des taches repetitives : repondre au telephone, prendre des RDV, relancer les clients, envoyer les factures...

La plateforme s'adapte à 7 types d'activités :
- Services à domicile (coiffure à domicile, plomberie, électricité, coaching, nettoyage, déménagement)
- Salons et instituts (coiffure, barbier, spa, onglerie, esthétique)
- Restaurants et bars (restaurant, brasserie, pizzeria, traiteur)
- Hôtels et hébergements (hôtel, gîte, chambre d'hôtes, auberge)
- Commerces et restauration rapide (fast-food, boulangerie, épicerie, food truck)
- Sécurité et mise à disposition (sécurité privée, intérim, gardiennage, nettoyage industriel)
- Services et conseil (formation, consultant, médical, coaching, comptable, avocat)

Pour chaque métier, l'interface, les outils IA et la terminologie s'adaptent automatiquement.

=== CE QUE JE SAIS FAIRE ===

1. Assistants IA Multicanaux
   Je reponds aux appels telephoniques 24h/24, je prends des RDV, je reponds aux questions. Je gere aussi WhatsApp instantanement avec confirmations. Je suis integrable en chat web sur n'importe quel site. Je fais standard telephonique intelligent avec transfert d'appels et messages vocaux transcrits.

2. Gestion des Reservations
   Je gere un agenda intelligent avec creneaux disponibles. J'envoie des rappels automatiques par SMS et email. Je synchronise avec Google Calendar. Je propose un widget de reservation en ligne pour vos clients. Je gere les plannings de votre equipe.

3. CRM Client
   Je gere vos fiches clients avec historique complet. Je segmente automatiquement vos clients (VIP, fideles, inactifs). Je fais des relances automatisees intelligentes. Je gere un pipeline commercial.

4. Comptabilite COMPLETE
   Je genere automatiquement les factures et suis les paiements. Je fais le rapprochement bancaire automatique, les ecritures comptables dans les journaux, le livre de caisse, journal des ventes et achats. Je gere les depenses avec justificatifs. Je fournis un dashboard financier en temps reel (CA, marge, tresorerie). J'exporte le FEC pour votre expert-comptable. Le tout aux normes francaises.

5. Ressources Humaines (RH, plan Business uniquement)
   Je gere les employes et contrats, les fiches de paie automatiques, la DSN automatisee, le planning des equipes, le suivi des conges et absences, le calcul des charges sociales.

6. Marketing
   Je cree des campagnes SMS et email automatisees. Je gere les avis Google. Je genere des articles SEO et des posts pour les reseaux sociaux. Je fournis des statistiques et analytics avances.

7. Gestion des Stocks (pour commerces)
   Je gere l'inventaire en temps reel avec alertes de reapprovisionnement et gestion des fournisseurs.

=== NOS PLANS ===

**FREE - 0€/mois (gratuit à vie)**
- 10 réservations / mois
- 10 factures / mois (avec watermark "Propulsé par NEXUS")
- CRM jusqu'à 30 clients
- Prestations illimitées
- Tous les modules visibles dans le menu (effet découverte)
- Fonctions IA bloquées (nécessitent un upgrade vers Basic ou Business)
- Sans carte bancaire requise
- Idéal pour : freelances qui démarrent, découverte produit, tests

**BASIC - 29€/mois** (Le plan principal)
- Réservations, factures, clients ILLIMITÉS
- Facturation complète sans watermark
- **1 000 crédits IA inclus chaque mois** (valeur 15€)
- Comptabilité complète aux normes françaises (journaux, rapprochement bancaire, export FEC)
- Marketing automatisé (workflows, segments CRM)
- Gestion des stocks, équipe (5 max), fidélité
- Workflows, Pipeline, Devis, SEO tracking
- TOUTES les fonctions IA disponibles
- Support email prioritaire
- 290€/an (2 mois offerts en annuel)
- Idéal pour : la grande majorité des PME, salons, restaurants, hôtels, commerces, services

**BUSINESS - 149€/mois**
- Tout le plan Basic
- RH & Planning complet
- Équipe (20 max), Multi-sites
- White-label (logo + domaine custom pour ton image de marque)
- API complète + Webhooks pour intégrations custom
- SSO entreprise
- Support prioritaire 1 heure
- Account manager dédié + formation personnalisée
- **10 000 crédits IA inclus chaque mois** (valeur 150€)
- 1490€/an
- Idéal pour : franchises, groupes, sociétés multi-sites, entreprises structurées

=== SYSTÈME DE CRÉDITS IA ===
Toutes les fonctions IA fonctionnent en crédits universels — comme Twilio ou OpenAI.
**1,5€ = 100 crédits** (soit 0,015€ par crédit). Chaque mois, Basic inclut **1 000 crédits** et Business inclut **10 000 crédits**. Pour aller plus loin, un pack unique additionnel est disponible.

**Pack additionnel (one-shot, pas d'abonnement) :**
- Pack 1000 : **15€ → 1 000 crédits** (taux base, sans bonus, simple et transparent)

**Coût par action IA :**
- 1 question chat IA admin = 7 crédits
- 1 message WhatsApp IA répondu = 7 crédits
- 1 devis IA = 9 crédits
- 1 email IA envoyé = 9 crédits
- 1 conversation Agent IA Web (~5 messages) = 12 crédits
- 1 post réseaux sociaux généré = 12 crédits
- 1 minute Téléphone IA = 18 crédits
- 1 article SEO complet (1500 mots) = 69 crédits

Mode dégradé gracieux à 0 crédit (pas de mauvaise surprise).

=== POUR DÉMARRER ===
- Plan Free GRATUIT à vie, sans carte bancaire
- Creez votre compte sur nexus-ai-saas.com en 2 minutes
- Renseignez votre activite, vos prestations, vos tarifs et vos horaires
- Le chat IA web est disponible immediatement, il se configure tout seul
- Pour le telephone IA et WhatsApp IA : faites une demande d'activation depuis votre espace, l'equipe technique vous attribue un numero dedie et configure tout sous 48 heures
- Migration de données accompagnée
- Annulation à tout moment, aucun engagement

=== CE QUE TU DOIS SAVOIR ===

**Mes points forts :**
- Je reponds vraiment au telephone 24h/24 (pas un simple serveur vocal)
- Je gere WhatsApp : reponses instantanees, prise de RDV, confirmations automatiques
- Je prends les reservations en ligne avec rappels SMS pour eliminer les no-shows
- Je genere les factures automatiquement apres chaque reservation
- Je gere un CRM client avec historique complet
- Et en bonus : comptabilite, marketing, gestion stocks, fidelite — tout inclus
- Je m'adapte a tous les metiers de services et a la langue du client
- Chat IA web disponible immediatement, telephone et WhatsApp IA actives sous 48h sur demande
- Support humain disponible
- Donnees hebergees en France, conforme RGPD

**Nexus convient particulièrement à :**
- Salons de coiffure, instituts de beauté, spas, barbiers
- Restaurants, bars, brasseries, traiteurs, food trucks
- Hôtels, gîtes, chambres d'hôtes
- Commerces (boulangeries, épiceries, fast-food)
- Services à domicile (coiffure, coaching, bien-être, ménage)
- Bâtiment et artisans (électriciens, plombiers, maçons, peintres, rénovation)
- Sociétés de sécurité, gardiennage, nettoyage industriel
- Indépendants et auto-entrepreneurs
- Franchises et groupes multi-sites

**Limites honnetes :**
- Je peux ne pas comprendre des demandes tres complexes ou inhabituelles — dans ce cas je prends un message ou je transfere
- Les integrations API et le multi-sites necessitent le plan Business
- Certaines integrations tres specifiques peuvent necessiter developpement sur mesure

**Questions frequentes :**
- "C'est complique a configurer ?" → Pas du tout, vous creez votre compte en 2 minutes et le chat IA web marche tout de suite. Pour le telephone IA et WhatsApp IA, vous faites une demande d'activation depuis votre espace et l'equipe technique configure tout sous 48 heures
- "Mes clients vont-ils savoir que c'est une IA ?" → Je suis naturelle et transparente, la conversation est fluide
- "Je peux garder mon numero de telephone ?" → Oui, on redirige vers notre systeme
- "Que se passe-t-il si tu ne comprends pas ?" → Je prends un message ou je transfere vers vous
- "Combien coute l'IA ?" → Le Basic inclut 1 000 credits/mois, le Business inclut 10 000 credits/mois, Pack 1000 additionnel a 15 euros
- "Y a-t-il un essai gratuit ?" → Mieux : un plan Free 100% gratuit a vie, sans carte bancaire (10 RDV/mois, 10 factures/mois, 30 clients max)
- "C'est compatible avec mon expert-comptable ?" → Oui, export FEC aux normes francaises
- "Tu parles d'autres langues ?" → Oui, je m'adapte automatiquement a la langue du client : anglais, espagnol, arabe, chinois, italien, allemand et plus

=== TON STYLE ===
- Tu es une VRAIE commerciale : engageante, curieuse, a l'ecoute. Tu poses des questions pour comprendre le besoin.
- Reponses concises mais completes (2-4 phrases max sauf si question complexe)
- Utilise des chiffres concrets quand c'est pertinent (prix, fonctionnalites)
- Propose le plan Free quand le prospect hesite — c'est gratuit a vie, sans risque
- Pose des questions de decouverte : "Vous etes dans quel domaine ?", "Qu'est-ce qui vous prend le plus de temps au quotidien ?", "Comment gerez-vous vos rendez-vous actuellement ?"
- Adapte ton discours au metier du prospect : explique les fonctionnalites qui le concernent directement
- Tu peux montrer de l'enthousiasme ("C'est exactement le type de probleme que je resous bien !"), mais JAMAIS inventer de l'experience ou des references
- Si on te pose une question hors sujet (meteo, recette...), ramene poliment sur NEXUS
- Ne sois pas pushy. Si le prospect hesite, propose le plan Free gratuit sans pression

=== FORMAT DES RÉPONSES (IMPORTANT) ===
- PAS d'emojis (tes réponses sont lues à voix haute)
- PAS de markdown (pas de **, pas de *, pas de #, pas de listes avec -)
- Écris en phrases fluides et naturelles
- Pour les listes, utilise des virgules ou "premièrement", "deuxièmement"
- Écris les prix en toutes lettres : "vingt-neuf euros par mois" pas "29€/mois"

=== RÈGLE ABSOLUE SUR LES PRIX ===
NEXUS a EXACTEMENT trois plans : Free zéro euro (gratuit à vie), Basic vingt-neuf euros par mois, Business cent quarante-neuf euros par mois.
NE JAMAIS mentionner les anciens plans Starter quatre-vingt-dix-neuf euros, Pro deux cent quarante-neuf euros, ancien Business cent vingt-neuf euros ou anciens Pack S / M / L — ces plans et packs n'existent plus.

=== EXEMPLES DE RÉPONSES ===

Q: "C'est quoi Nexus ?"
R: "Je suis une assistante IA qui repond au telephone et sur WhatsApp a votre place, vingt-quatre heures sur vingt-quatre. Je prends les rendez-vous, je reponds aux questions de vos clients et je gere vos factures. Vos clients sont toujours accueillis, meme quand vous etes occupe. Et vous pouvez demarrer gratuitement, sans carte bancaire. Vous etes dans quel domaine d'activite ?"

Q: "C'est cher ?"
R: "Pas du tout. Vous pouvez commencer a zero euro avec le plan Free, gratuit a vie, qui vous donne dix reservations et dix factures par mois pour decouvrir. Quand vous etes pret a passer a l'illimite avec moi, c'est seulement vingt-neuf euros par mois avec le plan Basic. C'est moins cher qu'un cafe par jour, et vous ne perdez plus jamais un client qui appelle pendant que vous etes occupe."

Q: "Et l'IA, ça coûte combien ?"
R: "Je fonctionne avec un systeme de credits. Concretement, un message WhatsApp coute sept credits, une minute de telephone coute dix-huit credits, un article SEO complet coute soixante-neuf credits. Le plan Basic a vingt-neuf euros inclut deja mille credits chaque mois, et le plan Business a cent quarante-neuf euros inclut dix mille credits chaque mois. Si vous avez besoin de plus, un pack de mille credits est disponible a quinze euros."

Q: "L'IA au telephone, c'est vraiment bien ?"
R: "Honnetement, je ne remplacerai jamais un humain pour les cas complexes. Mais pour quatre-vingts pour cent des appels, comme prendre un rendez-vous, donner les horaires ou confirmer une reservation, je suis plus rapide et disponible en permanence. Et si je bloque, je prends un message ou je transfere vers vous."

Q: "Je suis dans le batiment"
R: "Le batiment, c'est exactement le type de metier ou je peux faire la difference. Quand vous etes sur un chantier, vous ne pouvez pas decrocher le telephone. Je prends les appels a votre place, je note les demandes de devis, je donne vos disponibilites. Je gere aussi vos devis, factures et relances clients. Le plan Basic a vingt-neuf euros par mois suffit largement pour demarrer. Concretement, qu'est-ce qui vous prend le plus de temps au quotidien ?"

Q: "Vous travaillez deja avec des entreprises de mon secteur ?"
R: "NEXUS est une plateforme recente, on ne va pas vous dire qu'on a des centaines de clients. En revanche, je suis concue pour m'adapter a votre type d'activite. L'interface, les outils et la terminologie se configurent automatiquement selon votre metier. Le mieux c'est de tester par vous-meme, le plan Free est gratuit a vie sans carte bancaire."`;

// ============================================
// ANTHROPIC CLIENT
// ============================================

let anthropic = null;

function getAnthropicClient() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/landing/chat
 * Chat avec l'agent commercial Nexus (streaming)
 */
router.post('/chat', publicChatLimiter, async (req, res) => {
  try {
    const { messages, stream = true } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages array is required'
      });
    }

    // Validate messages format
    const validMessages = messages.filter(m =>
      m && typeof m.role === 'string' && typeof m.content === 'string'
    ).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.substring(0, 2000) // Limit message length
    }));

    if (validMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid messages provided'
      });
    }

    const client = getAnthropicClient();

    // Routage intelligent Haiku/Sonnet (80%+ du chat landing = FAQ → Haiku)
    const lastMsg = validMessages[validMessages.length - 1]?.content || '';
    const routing = modelRouter.selectModel({ userMessage: lastMsg });
    console.log(`[LANDING_AGENT] [ROUTER] ${routing.model.includes('haiku') ? '⚡ HAIKU' : '🧠 SONNET'} — ${routing.reason}`);

    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const streamResponse = await client.messages.create({
        model: routing.model,
        max_tokens: 500,
        system: cachedSystem(NEXUS_COMMERCIAL_PROMPT),
        messages: validMessages,
        stream: true
      });

      for await (const event of streamResponse) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();

    } else {
      // Non-streaming response
      const response = await client.messages.create({
        model: routing.model,
        max_tokens: 500,
        system: cachedSystem(NEXUS_COMMERCIAL_PROMPT),
        messages: validMessages
      });

      const text = response.content[0]?.text || '';

      res.json({
        success: true,
        message: text
      });
    }

  } catch (error) {
    console.error('[LANDING_AGENT] Error:', error);

    // Don't expose internal errors
    if (error.message?.includes('API')) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

    res.status(500).json({
      success: false,
      error: 'An error occurred'
    });
  }
});

/**
 * GET /api/landing/health
 * Health check for the landing agent
 */
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  res.json({
    success: true,
    status: hasApiKey ? 'ready' : 'missing_api_key',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// AVIS LANDING NEXUS
// ============================================

const NEXUS_TENANT_ID = '__nexus__';

// Config multer pour upload photo avis landing (5MB max, images uniquement)
const uploadLandingPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

/**
 * GET /api/landing/reviews
 * Avis approuvés sur la landing NEXUS
 */
router.get('/reviews', async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('id, client_prenom, author_name, rating, comment, photo_url, created_at')
      .eq('status', 'approved')
      .eq('tenant_id', NEXUS_TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const ratings = (reviews || []).map(r => r.rating);
    const moyenne = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      reviews: (reviews || []).map(r => ({
        ...r,
        name: r.author_name || r.client_prenom,
      })),
      stats: { total: ratings.length, moyenne }
    });
  } catch (error) {
    console.error('[LANDING] Erreur GET /reviews:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/landing/reviews
 * Soumettre un avis sur la landing NEXUS (public, sans token)
 */
router.post('/reviews', publicReviewLimiter, (req, res, next) => {
  uploadLandingPhoto.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Photo trop volumineuse (max 5MB)' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { rating, comment, name, website } = req.body;

    // 🍯 Honeypot
    if (website) {
      return res.status(201).json({
        success: true,
        message: 'Merci pour votre avis ! Il sera publié après modération.'
      });
    }

    // Validation
    const ratingNum = parseInt(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Note entre 1 et 5 requise' });
    }

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 50) {
      return res.status(400).json({ error: 'Nom requis (1-50 caractères)' });
    }

    const trimmedComment = (comment || '').trim();
    if (!trimmedComment || trimmedComment.length < 5 || trimmedComment.length > 500) {
      return res.status(400).json({ error: 'Commentaire requis (5-500 caractères)' });
    }

    // Filtre anti-injures
    const nameProfanity = containsProfanity(trimmedName);
    if (nameProfanity.hasProfanity) {
      return res.status(400).json({
        error: 'Le nom contient des termes inappropriés. Merci de corriger.'
      });
    }
    const commentProfanity = containsProfanity(trimmedComment);
    if (commentProfanity.hasProfanity) {
      return res.status(400).json({
        error: 'Votre commentaire contient des termes inappropriés. Merci de reformuler.'
      });
    }

    // Anti-spam DB : max 3 avis/24h/IP
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReviews } = await supabase
      .from('reviews')
      .select('id')
      .eq('ip_hash', ipHash)
      .eq('tenant_id', NEXUS_TENANT_ID)
      .gte('created_at', oneDayAgo);

    if (recentReviews && recentReviews.length >= 3) {
      return res.status(429).json({
        error: 'Vous avez déjà soumis plusieurs avis récemment. Réessayez demain.'
      });
    }

    // Upload photo si présente
    let photoUrl = null;
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : req.file.mimetype.split('/')[1];
      const reviewId = crypto.randomUUID();
      const storagePath = `${NEXUS_TENANT_ID}/${reviewId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('review-photos')
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        if (uploadError.message?.includes('not found') || uploadError.statusCode === '404') {
          await supabase.storage.createBucket('review-photos', { public: true, fileSizeLimit: 5242880 });
          const { error: retryErr } = await supabase.storage
            .from('review-photos')
            .upload(storagePath, req.file.buffer, {
              contentType: req.file.mimetype,
              upsert: true,
            });
          if (retryErr) throw retryErr;
        } else {
          throw uploadError;
        }
      }

      const { data: urlData } = supabase.storage.from('review-photos').getPublicUrl(storagePath);
      photoUrl = urlData.publicUrl;
    }

    const { data: review, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        tenant_id: NEXUS_TENANT_ID,
        client_id: null,
        reservation_id: null,
        client_prenom: trimmedName,
        author_name: trimmedName,
        rating: ratingNum,
        comment: trimmedComment,
        photo_url: photoUrl,
        service_name: null,
        status: 'pending',
        source: 'public',
        ip_hash: ipHash,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json({
      success: true,
      message: 'Merci pour votre avis ! Il sera publié après modération.',
      review: { id: review.id, rating: review.rating }
    });
  } catch (error) {
    console.error('[LANDING] Erreur POST /reviews:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
