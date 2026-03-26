/**
 * Email Generator Service
 * Genere des emails de prospection personnalises par secteur via Claude Haiku
 * Template HTML premium avec header NEXUS, design moderne, signature pro
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../services/modelRouter.js';

const anthropic = new Anthropic();

const LANDING_URL = 'https://nexus-ai-saas.com';

// Pain points par secteur — contexte pour la generation IA
const SECTOR_CONTEXT = {
  salon: {
    label: 'Salon de coiffure / Beaute',
    painPoints: [
      'Appels manques pendant les coupes = clients perdus',
      'No-shows et RDV non confirmes (15-30% de perte)',
      'Gestion manuelle du planning (papier ou Excel)',
      'Pas de rappels automatiques SMS/WhatsApp',
      'Difficulte a fideliser et recontacter les clients',
    ],
    benefits: [
      'IA qui repond au telephone 24/7 et prend les RDV',
      'Rappels automatiques SMS/WhatsApp (-80% de no-shows)',
      'Planning intelligent avec gestion des conflits',
      'Fiche client avec historique complet',
      'Campagnes fidelite automatisees',
    ],
    emoji: '&#x1F484;',
  },
  restaurant: {
    label: 'Restaurant / Brasserie',
    painPoints: [
      'Reservations perdues pendant le rush',
      'Telephone qui sonne sans reponse en cuisine',
      'No-shows sur les grandes tables (perte seche)',
      'Gestion des avis Google chronophage',
      'Pas de base clients pour remarketing',
    ],
    benefits: [
      'IA vocale qui prend les reservations 24/7',
      'Confirmation automatique + rappel J-1',
      'Gestion intelligente des tables et capacite',
      'Reponse automatique aux avis Google',
      'Base clients avec preferences alimentaires',
    ],
    emoji: '&#x1F37D;',
  },
  commerce: {
    label: 'Commerce / Boutique',
    painPoints: [
      'Questions repetitives (horaires, stock, prix)',
      'Pas de vente en ligne ou click & collect',
      'Difficulte a gerer le stock manuellement',
      'Peu de visibilite locale sur Google',
      'Pas de programme de fidelite automatise',
    ],
    benefits: [
      'Chatbot IA qui repond aux questions clients 24/7',
      'Catalogue en ligne avec disponibilite stock',
      'Gestion de stock simplifiee avec alertes',
      'SEO local booste par l\'IA',
      'Programme fidelite automatique',
    ],
    emoji: '&#x1F6CD;',
  },
  hotel: {
    label: 'Hotel / Hebergement',
    painPoints: [
      'Dependance aux OTA (Booking, Expedia) et leurs commissions 15-25%',
      'Questions clients repetitives (check-in, parking, wifi)',
      'Pas de suivi post-sejour pour avis et fidelisation',
      'Gestion manuelle des disponibilites multi-canal',
      'Accueil 24/7 impossible avec equipe reduite',
    ],
    benefits: [
      'IA concierge 24/7 (telephone + chat)',
      'Reservations directes sans commission OTA',
      'Suivi automatique post-sejour + demande d\'avis',
      'Channel manager IA integre',
      'Upsell automatique (room upgrade, petit-dej)',
    ],
    emoji: '&#x1F3E8;',
  },
  domicile: {
    label: 'Services a domicile',
    painPoints: [
      'Planning complexe avec deplacements',
      'Devis manuels chronophages',
      'Facturation en retard ou oubliee',
      'Pas de suivi des interventions',
      'Difficulte a trouver de nouveaux clients',
    ],
    benefits: [
      'Planning optimise avec calcul d\'itineraires',
      'Devis automatiques generes par IA',
      'Facturation automatique post-intervention',
      'Suivi client avec historique interventions',
      'Visibilite locale + prise de RDV en ligne',
    ],
    emoji: '&#x1F527;',
  },
  securite: {
    label: 'Societe de securite',
    painPoints: [
      'Planning gardes complexe (rotations, remplacements)',
      'Pointage terrain difficile a verifier',
      'Rapports d\'intervention manuscrits ou oublies',
      'Communication equipe dispersee sur le terrain',
      'Conformite reglementaire (CNAPS) chronophage',
    ],
    benefits: [
      'Planning gardes automatise avec gestion remplacements',
      'Pointage GPS + QR code en temps reel',
      'Rapports digitalises avec photos et geolocalisation',
      'Portail employe mobile pour toute l\'equipe',
      'Dashboard conformite et suivi certifications',
    ],
    emoji: '&#x1F6E1;',
  },
};

// =============================================================================
// TEMPLATE HTML PREMIUM
// =============================================================================

/**
 * Wrap le contenu genere par IA dans un template email professionnel
 */
function wrapInTemplate({ bodyHtml, ctaText = 'Decouvrir NEXUS gratuitement', unsubscribeUrl = '{{unsubscribe_url}}' }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEXUS</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f1f3;">
<tr><td align="center" style="padding:24px 12px;">

<!-- CONTAINER -->
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">

  <!-- ========== HERO HEADER ========== -->
  <tr>
    <td style="background:linear-gradient(135deg,#0ea5e9 0%,#4f46e5 50%,#8b5cf6 100%);padding:36px 40px 32px;text-align:center;">
      <!-- Logo -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:rgba(255,255,255,0.15);border-radius:14px;padding:12px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:#ffffff;border-radius:10px;text-align:center;vertical-align:middle;">
                  <span style="color:#4f46e5;font-size:22px;font-weight:900;line-height:36px;font-family:Arial,Helvetica,sans-serif;">N</span>
                </td>
                <td style="padding-left:12px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:3px;font-family:Arial,Helvetica,sans-serif;">
                  NEXUS
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Tagline -->
      <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:14px 0 0;letter-spacing:0.5px;font-weight:400;">
        L'IA qui fait tourner votre business pendant que vous travaillez
      </p>
    </td>
  </tr>

  <!-- ========== ACCENT BAR ========== -->
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,#06b6d4,#8b5cf6,#ec4899,#06b6d4);background-size:200% 100%;"></td>
  </tr>

  <!-- ========== BODY CONTENT ========== -->
  <tr>
    <td style="padding:36px 40px 12px;">
      ${bodyHtml}
    </td>
  </tr>

  <!-- ========== CTA BUTTON ========== -->
  <tr>
    <td align="center" style="padding:16px 40px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);border-radius:14px;mso-padding-alt:0;">
            <!--[if mso]><i style="mso-font-width:300%;mso-text-raise:30pt">&nbsp;</i><![endif]-->
            <a href="${LANDING_URL}" target="_blank" style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);border-radius:14px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;padding:16px 44px;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;">
              ${ctaText} &rarr;
            </a>
            <!--[if mso]><i style="mso-font-width:300%">&nbsp;</i><![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Sub-CTA -->
  <tr>
    <td align="center" style="padding:8px 40px 32px;">
      <p style="margin:0;font-size:13px;color:#9ca3af;">
        &#x2705; Gratuit &nbsp;&bull;&nbsp; &#x23F1; 15 minutes &nbsp;&bull;&nbsp; &#x1F6AB; Sans engagement
      </p>
    </td>
  </tr>

  <!-- ========== SEPARATOR ========== -->
  <tr>
    <td style="padding:0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="border-top:2px solid #f3f4f6;"></td></tr>
      </table>
    </td>
  </tr>

  <!-- ========== SIGNATURE ========== -->
  <tr>
    <td style="padding:28px 40px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:44px;height:44px;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);border-radius:12px;text-align:center;vertical-align:middle;">
                  <span style="color:#ffffff;font-size:22px;font-weight:900;line-height:44px;font-family:Arial,Helvetica,sans-serif;">N</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding-left:16px;vertical-align:top;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#1f2937;">L'equipe NEXUS</p>
            <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">
              &#x1F4E7; nexussentinelai@yahoo.com<br>
              &#x1F4F1; 07 60 53 76 94<br>
              &#x1F310; <a href="${LANDING_URL}" style="color:#6366f1;text-decoration:none;">nexus-ai-saas.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ========== FOOTER RGPD ========== -->
  <tr>
    <td style="background-color:#f8f9fa;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.8;">
        NEXUS Business Solutions &mdash; nexussentinelai@yahoo.com<br>
        <a href="${LANDING_URL}" style="color:#6366f1;text-decoration:none;">nexus-ai-saas.com</a>
        &nbsp;|&nbsp;
        <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Se desinscrire</a>
      </p>
    </td>
  </tr>

</table>
<!-- FIN CONTAINER -->

</td></tr>
</table>
</body>
</html>`;
}

// =============================================================================
// GENERATION IA
// =============================================================================

/**
 * Genere un email initial de prospection
 */
export async function generateInitialEmail(prospect, campaign = {}) {
  const ctx = SECTOR_CONTEXT[prospect.sector];
  if (!ctx) throw new Error(`Secteur inconnu: ${prospect.sector}`);

  const systemPrompt = buildSystemPrompt(ctx, campaign);
  const userPrompt = `
Genere le CORPS d'un email de prospection B2B pour :
- Nom du commerce : ${prospect.name}
- Secteur : ${ctx.label}
- Ville : ${prospect.city || 'non precisee'}
- Note Google : ${prospect.rating || 'non disponible'}/5 (${prospect.reviews_count || 0} avis)
- Site web : ${prospect.website || 'aucun'}

Reponds UNIQUEMENT en JSON : { "subject": "...", "body_paragraphs": "..." }
- "subject" : objet de l'email, court et percutant (max 60 caracteres)
- "body_paragraphs" : le texte en HTML (uniquement des balises <p>)
`;

  const result = await callAI(systemPrompt, userPrompt);

  // Wrapper dans le template premium
  return {
    subject: result.subject,
    html_body: wrapInTemplate({
      bodyHtml: result.body_paragraphs || result.html_body,
    }),
  };
}

/**
 * Genere un email de relance (J+3, J+7, J+14)
 */
export async function generateFollowUpEmail(prospect, emailType, previousSubject) {
  const ctx = SECTOR_CONTEXT[prospect.sector];
  if (!ctx) throw new Error(`Secteur inconnu: ${prospect.sector}`);

  const angles = {
    followup_j3: 'Angle: rappeler le benefice principal avec un chiffre concret. Tres court (60 mots max). Ton direct, presque complice.',
    followup_j7: 'Angle: partager un temoignage client realiste du meme secteur. Un resultat concret avec des chiffres. Court (80 mots max).',
    followup_j14: 'Angle: dernier message, ton sincere. Proposer un essai gratuit 14 jours. Pas d\'agressivite, juste de la franchise. Court (60 mots max).',
  };

  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = `
Genere le CORPS d'un email de RELANCE pour :
- Nom du commerce : ${prospect.name}
- Secteur : ${ctx.label}
- Ville : ${prospect.city || 'non precisee'}
- Type : ${emailType}
- Sujet du premier email : "${previousSubject}"

${angles[emailType] || angles.followup_j3}

Fais reference au mail precedent de maniere naturelle.

Reponds UNIQUEMENT en JSON : { "subject": "...", "body_paragraphs": "..." }
- "subject" : commence par "Re: " + nouveau sujet court
- "body_paragraphs" : le texte en HTML (uniquement des balises <p>)
`;

  const result = await callAI(systemPrompt, userPrompt);

  return {
    subject: result.subject,
    html_body: wrapInTemplate({
      bodyHtml: result.body_paragraphs || result.html_body,
      ctaText: emailType === 'followup_j14' ? 'Essayer NEXUS 14 jours gratuit' : 'Voir ce que NEXUS peut faire',
    }),
  };
}

/**
 * Appel Claude Haiku avec prompt caching
 */
async function callAI(systemPrompt, userPrompt) {
  const response = await anthropic.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 1000,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].text;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Pas de JSON dans la reponse IA');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.subject) throw new Error('Champ subject manquant');
    if (!parsed.body_paragraphs && !parsed.html_body) throw new Error('Champ body_paragraphs manquant');

    return parsed;
  } catch (err) {
    console.error('[EMAIL_GEN] Parse error:', err.message, 'Raw:', text.substring(0, 300));
    throw new Error(`Erreur generation email: ${err.message}`);
  }
}

function buildSystemPrompt(sectorCtx, campaign = {}) {
  return `Tu es un copywriter email B2B d'elite. Tu ecris des emails de prospection percutants pour NEXUS, une solution SaaS tout-en-un avec IA pour les TPE/PME en France.

SECTEUR : ${sectorCtx.label} ${sectorCtx.emoji || ''}

PROBLEMES DU SECTEUR :
${sectorCtx.painPoints.map(p => `- ${p}`).join('\n')}

SOLUTIONS NEXUS :
${sectorCtx.benefits.map(b => `- ${b}`).join('\n')}

STYLE D'ECRITURE — OBLIGATOIRE :
- Accroche CHOC en premiere phrase (chiffre, question provocante, constat dur)
- Vouvoiement, JAMAIS de tutoiement
- JAMAIS "Cher", "Chere", "Madame", "Monsieur", "Bonjour" en ouverture
- Phrases COURTES (max 15 mots). Un concept par phrase.
- Paragraphes COURTS (2-3 phrases max). Beaucoup d'espace entre les blocs.
- Utiliser du **gras** (<strong>) pour les chiffres cles et mots-cles importants
- Ton : confiant, moderne, direct. Comme un ami expert qui donne un bon conseil.
- PAS de superlatifs creux ("revolutionnaire", "incroyable", "formidable")
- MAX 100 mots pour tout le body

PERSONNALISATION — OBLIGATOIRE :
- Mentionner le nom du commerce UNE SEULE FOIS, dans l'accroche ou la conclusion
- NE JAMAIS dire que le commerce "utilise deja" ou "gagne deja" avec NEXUS
- NE JAMAIS dire "${sectorCtx.label} [nom commerce] gagne du temps avec NEXUS" ou similaire
- Le commerce est un PROSPECT, pas un client. On lui propose de decouvrir NEXUS.

FORMAT HTML — OBLIGATOIRE :
- Chaque paragraphe dans une balise <p> avec ce style inline :
  <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
- Pour le gras : <strong style="color:#111827;">
- INTERDIT : <div>, <table>, <style>, <img>, <a>, <button>, <h1/h2/h3>
- INTERDIT : generer un bouton CTA, un header, un footer, ou une signature
- Le template email (header NEXUS, bouton CTA, signature) est gere automatiquement

${campaign.custom_prompt ? `INSTRUCTIONS CUSTOM :\n${campaign.custom_prompt}\n` : ''}
Reponds UNIQUEMENT en JSON valide : { "subject": "...", "body_paragraphs": "..." }`;
}

export default { generateInitialEmail, generateFollowUpEmail };
