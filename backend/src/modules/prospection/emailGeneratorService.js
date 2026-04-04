/**
 * Email Generator Service
 * Genere des emails de prospection personnalises par secteur via Claude Haiku
 * Template HTML premium avec header NEXUS, design moderne, signature pro
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../services/modelRouter.js';

const anthropic = new Anthropic();

const LANDING_URL = process.env.LANDING_URL || 'https://nexus-ai-saas.com';

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
// TEMPLATE HTML PREMIUM — GLASS / LIQUID DESIGN
// =============================================================================

const HERO_BG_URL = (process.env.BACKEND_URL || 'https://nexus-backend-dev.onrender.com') + '/images/nexus-hero-bg.jpg';

/**
 * Wrap le contenu genere par IA dans un template email premium glass/liquid
 */
function wrapInTemplate({ bodyHtml, ctaText = 'Essayez NEXUS gratuitement', unsubscribeUrl = '{{unsubscribe_url}}' }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEXUS</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:'Poppins',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0e1a;">
<tr><td align="center" style="padding:24px 12px;">

<!-- CONTAINER — IMAGE ROBOT EN ARRIERE-PLAN DE TOUT LE MAIL -->
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(14,165,233,0.15),0 4px 24px rgba(139,92,246,0.1);background-image:url('${HERO_BG_URL}');background-size:cover;background-position:center top;background-repeat:no-repeat;">

  <!--[if gte mso 9]>
  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
  <v:fill type="frame" src="${HERO_BG_URL}" />
  <v:textbox inset="0,0,0,0">
  <![endif]-->

  <!-- OVERLAY SOMBRE SEMI-TRANSPARENT SUR TOUT LE MAIL -->
  <tr>
    <td>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(180deg,rgba(10,14,26,0.4) 0%,rgba(10,14,26,0.82) 20%,rgba(10,14,26,0.88) 50%,rgba(10,14,26,0.92) 80%,rgba(10,14,26,0.96) 100%);">

  <!-- ========== HERO HEADER — GLASS ========== -->
  <tr>
    <td style="padding:40px 40px 28px;text-align:center;">
      <!-- Logo glass pill -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:16px;padding:14px 24px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:38px;height:38px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);border-radius:10px;text-align:center;vertical-align:middle;">
                  <span style="color:#ffffff;font-size:22px;font-weight:900;line-height:38px;font-family:'Poppins',Arial,sans-serif;">N</span>
                </td>
                <td style="padding-left:12px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:4px;font-family:'Poppins',Arial,sans-serif;">
                  NEXUS
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Tagline -->
      <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:18px 0 0;letter-spacing:0.5px;font-weight:300;font-family:'Poppins',Arial,sans-serif;">
        L'intelligence artificielle au service de votre business
      </p>
      <!-- Accent line -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0;">
        <tr>
          <td style="width:80px;height:3px;background:linear-gradient(90deg,#06b6d4,#8b5cf6,#ec4899);border-radius:2px;"></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ========== BODY CONTENT ========== -->
  <tr>
    <td style="padding:20px 40px 16px;">
      ${bodyHtml}
    </td>
  </tr>

  <!-- ========== CTA BUTTON — LIQUID GLASS ========== -->
  <tr>
    <td align="center" style="padding:8px 40px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:50px;background:linear-gradient(135deg,rgba(6,182,212,0.85) 0%,rgba(99,102,241,0.85) 50%,rgba(139,92,246,0.85) 100%);box-shadow:0 4px 24px rgba(6,182,212,0.4),0 0 48px rgba(99,102,241,0.2);border:1px solid rgba(255,255,255,0.2);">
            <a href="${LANDING_URL}" target="_blank" style="border-radius:50px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;padding:16px 48px;letter-spacing:0.8px;font-family:'Poppins',Arial,sans-serif;">
              ${ctaText} &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Sub-CTA -->
  <tr>
    <td align="center" style="padding:12px 40px 28px;">
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);font-family:'Poppins',Arial,sans-serif;">
        &#x2705; Gratuit &nbsp;&bull;&nbsp; &#x23F1; 15 minutes &nbsp;&bull;&nbsp; Sans engagement
      </p>
    </td>
  </tr>

  <!-- ========== MODULES NEXUS — GLASS CARD ========== -->
  <tr>
    <td style="padding:0 28px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#06b6d4;letter-spacing:1.5px;text-transform:uppercase;font-family:'Poppins',Arial,sans-serif;">
              Tout NEXUS en un clic
            </p>
            <p style="margin:0 0 16px;font-size:13px;font-style:italic;color:rgba(255,255,255,0.75);line-height:1.9;font-family:'Poppins',Arial,sans-serif;">
              &#x1F4DE; IA Vocale 24/7 &mdash; r&eacute;pond &agrave; vos appels, prend les RDV<br>
              &#x1F4AC; Chat &amp; WhatsApp IA &mdash; r&eacute;ponses instantan&eacute;es &agrave; vos clients<br>
              &#x1F4C5; Planning intelligent &mdash; z&eacute;ro conflit, rappels SMS auto<br>
              &#x1F4B3; Facturation automatique &mdash; devis, factures, relances<br>
              &#x1F4CA; Dashboard temps r&eacute;el &mdash; CA, clients, performance<br>
              &#x1F91D; CRM int&eacute;gr&eacute; &mdash; fid&eacute;lisation, suivi, historique<br>
              &#x1F9E0; 114 outils IA &mdash; pilotables en langage naturel
            </p>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);font-family:'Poppins',Arial,sans-serif;">
              &Agrave; partir de <strong style="color:#06b6d4;">79&euro;/mois</strong> &mdash; ROI x20 d&egrave;s le premier mois
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ========== SIGNATURE ========== -->
  <tr>
    <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:44px;height:44px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);border-radius:12px;text-align:center;vertical-align:middle;box-shadow:0 2px 12px rgba(6,182,212,0.3);">
                  <span style="color:#ffffff;font-size:22px;font-weight:900;line-height:44px;font-family:'Poppins',Arial,sans-serif;">N</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding-left:16px;vertical-align:top;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;font-family:'Poppins',Arial,sans-serif;">L'&eacute;quipe NEXUS</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);font-family:'Poppins',Arial,sans-serif;">
              &#x1F4E7; contact@nexus-ai-saas.com<br>
              &#x1F4F1; 07 60 53 76 94<br>
              &#x1F310; <a href="${LANDING_URL}" style="color:#06b6d4;text-decoration:none;">nexus-ai-saas.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ========== FOOTER RGPD ========== -->
  <tr>
    <td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.04);">
      <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;line-height:1.8;font-family:'Poppins',Arial,sans-serif;">
        NEXUS Business Solutions &mdash; contact@nexus-ai-saas.com<br>
        <a href="${LANDING_URL}" style="color:rgba(6,182,212,0.6);text-decoration:none;">nexus-ai-saas.com</a>
        &nbsp;|&nbsp;
        <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Se d&eacute;sinscrire</a>
      </p>
    </td>
  </tr>

      </table>
      <!-- FIN OVERLAY -->
    </td>
  </tr>

  <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->

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
      ctaText: emailType === 'followup_j14' ? 'Essayez NEXUS 14 jours gratuit' : 'Essayez NEXUS gratuitement',
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
  return `Tu es un copywriter email B2B d'elite specialise en cold email ultra-court et impactant.
Tu ecris pour NEXUS — la plateforme IA tout-en-un qui gere le business des TPE/PME.

CE QU'EST NEXUS (a presenter dans l'email) :
- Une IA qui repond au telephone 24/7, prend les RDV, et parle comme un humain
- Des rappels SMS/WhatsApp automatiques qui reduisent les no-shows de 80%
- Un planning intelligent, une facturation automatique, un CRM integre
- 114 outils IA pilotables en langage naturel
- Essai gratuit 14 jours, sans engagement, sans carte bancaire
- Tarif a partir de 79€/mois (ROI x20 des le premier mois)

SECTEUR CIBLE : ${sectorCtx.label}

PROBLEMES DE CE SECTEUR :
${sectorCtx.painPoints.map(p => `- ${p}`).join('\n')}

SOLUTIONS NEXUS POUR CE SECTEUR :
${sectorCtx.benefits.map(b => `- ${b}`).join('\n')}

STRUCTURE DE L'EMAIL — 3 BLOCS OBLIGATOIRES :
1. ACCROCHE (1 phrase) : Chiffre choc ou question provocante sur leur probleme quotidien
2. PITCH NEXUS (3-4 phrases) : Presenter NEXUS comme LA solution a ce probleme. Mentionner 2-3 features concretes avec des chiffres (ex: "-80% de no-shows", "24/7", "114 outils IA"). Pas de blabla, que du concret.
3. CLOSING (1 phrase) : Terminer par "A bientot sur NEXUS !" ou "A tres vite sur NEXUS !"

REGLES ABSOLUES :
- MAXIMUM 80 mots. Court = impactant. Chaque mot doit compter.
- Vouvoiement obligatoire. JAMAIS "Cher/Chere/Bonjour/Madame/Monsieur"
- Phrases ULTRA COURTES. Un concept par phrase. Beaucoup d'air.
- Gras (<strong>) sur les chiffres et mots-cles puissants
- Mentionner le nom du commerce UNE SEULE FOIS dans l'accroche
- NE JAMAIS dire que le prospect utilise deja NEXUS. C'est une decouverte.
- Ton : confiant, direct, moderne. Comme un SMS d'un ami expert.
- PAS de superlatifs creux ("revolutionnaire", "incroyable")

FORMAT HTML (fond sombre, texte clair) :
- Chaque paragraphe : <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.85);font-family:'Poppins',Arial,sans-serif;">
- Gras : <strong style="color:#06b6d4;">
- INTERDIT : <div>, <table>, <style>, <img>, <a>, <button>, <h1/h2/h3>
- INTERDIT : generer bouton CTA, header, footer, signature (gere par le template)

${campaign.custom_prompt ? `INSTRUCTIONS CUSTOM :\n${campaign.custom_prompt}\n` : ''}
Reponds UNIQUEMENT en JSON valide : { "subject": "...", "body_paragraphs": "..." }`;
}

export default { generateInitialEmail, generateFollowUpEmail };
