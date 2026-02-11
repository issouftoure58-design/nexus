/**
 * Service de gestion des relances factures
 * 4 niveaux : J-15 (préventif), J+1, J+7, J+15
 */

import { createClient } from '@supabase/supabase-js';
import { getTenantConfig } from '../config/tenants/index.js';
import { Resend } from 'resend';

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let _supabase = null;

function getSupabase() {
  if (!_supabase && supabaseUrl && supabaseKey) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// Resend client
let _resend = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Configuration des niveaux de relance
const NIVEAUX_RELANCE = {
  1: {
    type: 'preventif',
    nom: 'Rappel préventif J-15',
    jours: -15, // 15 jours avant échéance
    objet: 'Rappel : Facture à régler prochainement',
    urgence: 'faible'
  },
  2: {
    type: 'rappel',
    nom: 'Première relance J+1',
    jours: 1, // 1 jour après échéance
    objet: 'Relance : Facture impayée',
    urgence: 'moyenne'
  },
  3: {
    type: 'urgence',
    nom: 'Deuxième relance J+7',
    jours: 7, // 7 jours après échéance
    objet: 'URGENT : Facture en retard de paiement',
    urgence: 'haute'
  },
  4: {
    type: 'mise_en_demeure',
    nom: 'Mise en demeure J+15',
    jours: 15, // 15 jours après échéance
    objet: 'MISE EN DEMEURE : Règlement immédiat requis',
    urgence: 'critique'
  }
};

/**
 * Récupère les factures à relancer pour un tenant
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
export async function getFacturesARelancer(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('factures_a_relancer')
    .select('*')
    .eq('tenant_id', tenantId)
    .gt('prochain_niveau_relance', 0)
    .order('jours_retard', { ascending: false });

  if (error) {
    console.error('[Relances] Erreur récupération factures:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Récupère les stats de relances pour un tenant
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
export async function getStatsRelances(tenantId) {
  const db = getSupabase();
  if (!db) return { niveau1: 0, niveau2: 0, niveau3: 0, niveau4: 0, total: 0 };

  const { data, error } = await db
    .from('factures')
    .select('niveau_relance')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '("payee","annulee")');

  if (error) {
    console.error('[Relances] Erreur stats:', error.message);
    return { niveau1: 0, niveau2: 0, niveau3: 0, niveau4: 0, total: 0 };
  }

  const stats = { niveau1: 0, niveau2: 0, niveau3: 0, niveau4: 0, total: 0 };
  (data || []).forEach(f => {
    if (f.niveau_relance >= 1) stats.niveau1++;
    if (f.niveau_relance >= 2) stats.niveau2++;
    if (f.niveau_relance >= 3) stats.niveau3++;
    if (f.niveau_relance >= 4) stats.niveau4++;
    if (f.niveau_relance > 0) stats.total++;
  });

  return stats;
}

/**
 * Génère le contenu email pour une relance
 * @param {Object} facture
 * @param {number} niveau
 * @param {Object} tenantConfig
 * @returns {Object} { subject, html }
 */
function genererEmailRelance(facture, niveau, tenantConfig) {
  const config = NIVEAUX_RELANCE[niveau];
  const t = tenantConfig;
  const montantTTC = (facture.montant_ttc / 100).toFixed(2);
  const dateEcheance = new Date(facture.date_echeance).toLocaleDateString('fr-FR');
  const joursRetard = facture.jours_retard || 0;

  const couleurUrgence = {
    faible: '#3B82F6',    // Bleu
    moyenne: '#F59E0B',   // Orange
    haute: '#EF4444',     // Rouge
    critique: '#7C3AED'   // Violet
  }[config.urgence];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${config.objet}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-top: 4px solid ${couleurUrgence}; padding-top: 20px;">
    <h1 style="color: ${couleurUrgence}; margin-bottom: 10px;">
      ${config.nom}
    </h1>

    <p>Bonjour ${facture.client_nom},</p>

    ${niveau === 1 ? `
    <p>Nous vous rappelons que la facture <strong>${facture.numero}</strong> arrive à échéance le <strong>${dateEcheance}</strong>.</p>
    <p>Merci de bien vouloir procéder au règlement dans les délais.</p>
    ` : niveau === 2 ? `
    <p>Sauf erreur de notre part, la facture <strong>${facture.numero}</strong> dont l'échéance était le <strong>${dateEcheance}</strong> n'a pas été réglée.</p>
    <p>Nous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.</p>
    ` : niveau === 3 ? `
    <p>Malgré notre précédent rappel, la facture <strong>${facture.numero}</strong> reste impayée depuis <strong>${joursRetard} jours</strong>.</p>
    <p style="color: ${couleurUrgence}; font-weight: bold;">Nous vous prions de régler cette facture de toute urgence.</p>
    ` : `
    <p style="font-weight: bold;">MISE EN DEMEURE</p>
    <p>La facture <strong>${facture.numero}</strong> est impayée depuis <strong>${joursRetard} jours</strong> malgré nos multiples relances.</p>
    <p style="color: ${couleurUrgence}; font-weight: bold;">Sans règlement sous 8 jours, nous serons contraints d'engager des poursuites.</p>
    `}

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Facture n°:</strong> ${facture.numero}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${facture.service_nom}</p>
      <p style="margin: 5px 0;"><strong>Montant TTC:</strong> ${montantTTC} €</p>
      <p style="margin: 5px 0;"><strong>Échéance:</strong> ${dateEcheance}</p>
      ${joursRetard > 0 ? `<p style="margin: 5px 0; color: ${couleurUrgence};"><strong>Retard:</strong> ${joursRetard} jours</p>` : ''}
    </div>

    <p><strong>Moyens de paiement :</strong></p>
    <ul>
      <li>Virement bancaire</li>
      <li>Espèces lors de votre prochain RDV</li>
      <li>PayPal</li>
    </ul>

    <p>Si vous avez déjà effectué le règlement, merci de ne pas tenir compte de ce message.</p>

    <p>Cordialement,<br>
    <strong>${t.ownerName || t.businessName}</strong><br>
    ${t.businessName}</p>

    <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 12px; color: #666;">
      ${t.businessName}<br>
      ${t.phone ? `Tél: ${t.phone}` : ''}<br>
      ${t.email || ''}
    </p>
  </div>
</body>
</html>`;

  return {
    subject: `${config.objet} - ${facture.numero}`,
    html
  };
}

/**
 * Envoie une relance pour une facture
 * @param {Object} facture
 * @param {number} niveau
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
export async function envoyerRelance(facture, niveau, tenantId) {
  const db = getSupabase();
  const resend = getResend();
  const config = NIVEAUX_RELANCE[niveau];

  if (!config) {
    return { success: false, error: `Niveau de relance invalide: ${niveau}` };
  }

  const tenantConfig = getTenantConfig(tenantId);
  console.log(`[Relances] 📤 Envoi relance niveau ${niveau} pour facture ${facture.numero}`);

  let emailEnvoye = false;
  let smsEnvoye = false;
  let emailId = null;
  let smsId = null;

  // 1. Envoyer email
  if (facture.client_email && resend) {
    try {
      const { subject, html } = genererEmailRelance(facture, niveau, tenantConfig);
      const fromEmail = tenantConfig.email || 'noreply@nexus.app';

      const result = await resend.emails.send({
        from: `${tenantConfig.businessName} <${fromEmail}>`,
        to: facture.client_email,
        subject,
        html
      });

      emailEnvoye = true;
      emailId = result.id;
      console.log(`[Relances] ✅ Email envoyé: ${facture.client_email}`);
    } catch (error) {
      console.error(`[Relances] ❌ Erreur email:`, error.message);
    }
  }

  // 2. Envoyer SMS (niveaux 3 et 4 uniquement)
  if (niveau >= 3 && facture.client_telephone) {
    // TODO: Intégrer Twilio pour SMS
    // Pour l'instant, on log seulement
    console.log(`[Relances] 📱 SMS niveau ${niveau} à envoyer: ${facture.client_telephone}`);
    // smsEnvoye = true;
  }

  // 3. Mettre à jour la facture
  if (db && (emailEnvoye || smsEnvoye)) {
    const { error: updateError } = await db
      .from('factures')
      .update({
        niveau_relance: niveau,
        date_derniere_relance: new Date().toISOString()
      })
      .eq('id', facture.id);

    if (updateError) {
      console.error(`[Relances] ❌ Erreur update facture:`, updateError.message);
    }

    // 4. Enregistrer dans l'historique
    const { error: histError } = await db
      .from('relances_factures')
      .insert({
        tenant_id: tenantId,
        facture_id: facture.id,
        niveau,
        type: config.type,
        email_envoye: emailEnvoye,
        sms_envoye: smsEnvoye,
        email_id: emailId,
        sms_id: smsId
      });

    if (histError) {
      console.error(`[Relances] ❌ Erreur historique:`, histError.message);
    }
  }

  return {
    success: emailEnvoye || smsEnvoye,
    emailEnvoye,
    smsEnvoye,
    niveau,
    factureId: facture.id
  };
}

/**
 * Traite toutes les relances en attente pour un tenant
 * Appelé par le CRON job quotidien
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
export async function traiterRelancesTenant(tenantId) {
  console.log(`\n[Relances] 🏢 Traitement relances pour tenant: ${tenantId}`);

  const factures = await getFacturesARelancer(tenantId);
  console.log(`[Relances] 📋 ${factures.length} factures à relancer`);

  const resultats = {
    total: factures.length,
    envoyees: 0,
    erreurs: 0,
    parNiveau: { 1: 0, 2: 0, 3: 0, 4: 0 }
  };

  for (const facture of factures) {
    const niveau = facture.prochain_niveau_relance;
    if (niveau < 1 || niveau > 4) continue;

    try {
      const result = await envoyerRelance(facture, niveau, tenantId);
      if (result.success) {
        resultats.envoyees++;
        resultats.parNiveau[niveau]++;
        console.log(`[Relances] ✅ Facture ${facture.numero}: niveau ${niveau} envoyé`);
      } else {
        resultats.erreurs++;
        console.log(`[Relances] ⚠️ Facture ${facture.numero}: échec envoi`);
      }
    } catch (error) {
      resultats.erreurs++;
      console.error(`[Relances] ❌ Erreur facture ${facture.numero}:`, error.message);
    }
  }

  console.log(`[Relances] 📊 Résultat: ${resultats.envoyees}/${resultats.total} envoyées, ${resultats.erreurs} erreurs`);
  return resultats;
}

/**
 * Traite les relances pour tous les tenants actifs
 * @returns {Promise<Object>}
 */
export async function traiterToutesRelances() {
  const db = getSupabase();
  if (!db) {
    console.log('[Relances] ⚠️ Supabase non configuré');
    return { success: false, error: 'Supabase non configuré' };
  }

  console.log(`\n[Relances] 🚀 Début traitement relances - ${new Date().toLocaleString('fr-FR')}`);

  // Récupérer tous les tenants avec des factures à relancer
  const { data: tenants, error } = await db
    .from('factures')
    .select('tenant_id')
    .not('statut', 'in', '("payee","annulee")')
    .not('date_echeance', 'is', null);

  if (error) {
    console.error('[Relances] ❌ Erreur récupération tenants:', error.message);
    return { success: false, error: error.message };
  }

  // Dédupliquer les tenants
  const tenantIds = [...new Set((tenants || []).map(t => t.tenant_id))];
  console.log(`[Relances] 🏢 ${tenantIds.length} tenants à traiter`);

  const resultatsGlobaux = {
    tenants: tenantIds.length,
    totalEnvoyees: 0,
    totalErreurs: 0,
    details: {}
  };

  for (const tenantId of tenantIds) {
    const resultat = await traiterRelancesTenant(tenantId);
    resultatsGlobaux.details[tenantId] = resultat;
    resultatsGlobaux.totalEnvoyees += resultat.envoyees;
    resultatsGlobaux.totalErreurs += resultat.erreurs;
  }

  console.log(`\n[Relances] ✅ Traitement terminé: ${resultatsGlobaux.totalEnvoyees} relances envoyées, ${resultatsGlobaux.totalErreurs} erreurs`);
  return { success: true, ...resultatsGlobaux };
}

// Export par défaut
export default {
  getFacturesARelancer,
  getStatsRelances,
  envoyerRelance,
  traiterRelancesTenant,
  traiterToutesRelances,
  NIVEAUX_RELANCE
};
