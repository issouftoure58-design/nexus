/**
 * Email Generator Service
 * Genere des emails de prospection personnalises par secteur via Claude Haiku
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../services/modelRouter.js';

const anthropic = new Anthropic();

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
  },
};

/**
 * Genere un email initial de prospection
 */
export async function generateInitialEmail(prospect, campaign = {}) {
  const ctx = SECTOR_CONTEXT[prospect.sector];
  if (!ctx) throw new Error(`Secteur inconnu: ${prospect.sector}`);

  const systemPrompt = buildSystemPrompt(ctx, campaign);
  const userPrompt = `
Genere un email de prospection B2B pour :
- Nom du commerce : ${prospect.name}
- Secteur : ${ctx.label}
- Ville : ${prospect.city || 'non precisee'}
- Note Google : ${prospect.rating || 'non disponible'}/5 (${prospect.reviews_count || 0} avis)
- Site web : ${prospect.website || 'aucun'}

L'email doit etre court (max 150 mots), percutant, et personnalise avec le nom du commerce.
Commence par un constat de leur secteur (pas "Cher/Chere").
Termine par une proposition de demo gratuite de 15min.

Reponds UNIQUEMENT en JSON : { "subject": "...", "html_body": "..." }
Le html_body doit etre du HTML simple avec <p>, <strong>, <br>, pas de <style> ni <div> complexe.
`;

  return generateEmail(systemPrompt, userPrompt);
}

/**
 * Genere un email de relance (J+3, J+7, J+14)
 */
export async function generateFollowUpEmail(prospect, emailType, previousSubject) {
  const ctx = SECTOR_CONTEXT[prospect.sector];
  if (!ctx) throw new Error(`Secteur inconnu: ${prospect.sector}`);

  const angles = {
    followup_j3: 'Angle: rappeler le benefice principal, mentionner un chiffre concret (ex: -80% de no-shows). Tres court (80 mots max).',
    followup_j7: 'Angle: partager un temoignage client fictif mais realiste du meme secteur. Montrer un resultat concret.',
    followup_j14: 'Angle: dernier email, ton plus direct. Proposer un essai gratuit 14 jours sans engagement. Creer l\'urgence sans agressivite.',
  };

  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = `
Genere un email de RELANCE pour :
- Nom du commerce : ${prospect.name}
- Secteur : ${ctx.label}
- Ville : ${prospect.city || 'non precisee'}
- Type de relance : ${emailType}
- Sujet du premier email : "${previousSubject}"

${angles[emailType] || angles.followup_j3}

IMPORTANT : fais reference au mail precedent ("Suite a mon precedent message..." ou similaire).
Max 100 mots. Pas de "Cher/Chere".

Reponds UNIQUEMENT en JSON : { "subject": "...", "html_body": "..." }
Le subject doit commencer par "Re: " suivi d'un nouveau sujet court.
Le html_body doit etre du HTML simple.
`;

  return generateEmail(systemPrompt, userPrompt);
}

/**
 * Appel Claude Haiku avec prompt caching
 */
async function generateEmail(systemPrompt, userPrompt) {
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
    // Extraire le JSON meme si entoure de markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Pas de JSON dans la reponse IA');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.subject || !parsed.html_body) throw new Error('Champs subject/html_body manquants');

    return parsed;
  } catch (err) {
    console.error('[EMAIL_GEN] Parse error:', err.message, 'Raw:', text.substring(0, 200));
    throw new Error(`Erreur generation email: ${err.message}`);
  }
}

function buildSystemPrompt(sectorCtx, campaign = {}) {
  return `Tu es un expert en email marketing B2B pour les TPE/PME en France.
Tu ecris des emails de prospection pour NEXUS, une solution SaaS tout-en-un avec IA integree.

SECTEUR CIBLE : ${sectorCtx.label}

PROBLEMES DU SECTEUR :
${sectorCtx.painPoints.map(p => `- ${p}`).join('\n')}

SOLUTIONS NEXUS :
${sectorCtx.benefits.map(b => `- ${b}`).join('\n')}

REGLES ABSOLUES :
- Ton professionnel mais accessible, PAS commercial agressif
- Pas de "Cher/Chere", pas de "Madame/Monsieur"
- Tutoiement interdit, vouvoiement obligatoire
- Pas de superlatifs excessifs ("revolutionnaire", "incroyable")
- Mentionner le nom du commerce dans l'email
- Phrases courtes, paragraphes courts
- UN seul CTA clair : "Repondez a cet email pour planifier votre demo gratuite de 15 minutes"
- INTERDIT : liens externes (Calendly, site web, etc.). Le CTA doit etre une reponse a l'email
- Le bouton CTA doit etre un <a href="mailto:nexussentinelai@yahoo.com?subject=Demo%20NEXUS"> style bouton vert
- Le HTML doit inclure le footer RGPD suivant en petit :
  <p style="font-size:11px;color:#888;margin-top:30px;">
    NEXUS Business Solutions — nexussentinelai@yahoo.com<br>
    <a href="{{unsubscribe_url}}">Se desinscrire</a>
  </p>

${campaign.custom_prompt ? `INSTRUCTIONS SUPPLEMENTAIRES :\n${campaign.custom_prompt}` : ''}

Reponds TOUJOURS en JSON valide : { "subject": "...", "html_body": "..." }`;
}

export default { generateInitialEmail, generateFollowUpEmail };
