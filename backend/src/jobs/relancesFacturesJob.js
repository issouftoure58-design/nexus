/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   JOB RELANCES FACTURES - Système automatique J+7, J+14, J+21     ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   J+7  : Première relance (email)                                 ║
 * ║   J+14 : Relance urgente (email + SMS)                            ║
 * ║   J+21 : Mise en demeure (email + SMS + notification admin)       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
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

// ============= CONFIGURATION =============

const RELANCE_CONFIG = {
  j7: {
    jours: 7,
    type: 'j7',
    nom: 'Première relance J+7',
    objet: 'Rappel : Facture en attente de règlement',
    couleur: '#3B82F6', // Bleu
    canaux: ['email'],
    urgence: 'normale'
  },
  j14: {
    jours: 14,
    type: 'j14',
    nom: 'Relance urgente J+14',
    objet: 'URGENT : Facture impayée depuis 14 jours',
    couleur: '#F59E0B', // Orange
    canaux: ['email', 'sms'],
    urgence: 'haute'
  },
  j21: {
    jours: 21,
    type: 'j21',
    nom: 'Mise en demeure J+21',
    objet: 'MISE EN DEMEURE : Règlement immédiat requis',
    couleur: '#EF4444', // Rouge
    canaux: ['email', 'sms'],
    urgence: 'critique',
    notifyAdmin: true
  }
};

// ============= FONCTIONS DB =============

/**
 * Récupère les factures à relancer J+7
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
async function getFacturesJ7(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('factures')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '("payee","annulee")')
    .neq('type', 'avoir')
    .eq('avoir_emis', false)
    .eq('relance_j7_envoyee', false)
    .not('date_echeance', 'is', null)
    .lte('date_echeance', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  if (error) {
    console.error('[RelancesJ7] Erreur récupération:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Récupère les factures à relancer J+14
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
async function getFacturesJ14(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('factures')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '("payee","annulee")')
    .neq('type', 'avoir')
    .eq('avoir_emis', false)
    .eq('relance_j7_envoyee', true)  // J+7 déjà envoyée
    .eq('relance_j14_envoyee', false)
    .not('date_echeance', 'is', null)
    .lte('date_echeance', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  if (error) {
    console.error('[RelancesJ14] Erreur récupération:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Récupère les factures à relancer J+21
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
async function getFacturesJ21(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('factures')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '("payee","annulee")')
    .neq('type', 'avoir')
    .eq('avoir_emis', false)
    .eq('relance_j14_envoyee', true)  // J+14 déjà envoyée
    .eq('relance_j21_envoyee', false)
    .not('date_echeance', 'is', null)
    .lte('date_echeance', new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  if (error) {
    console.error('[RelancesJ21] Erreur récupération:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Marque une facture comme relancée
 * @param {string} factureId
 * @param {string} type - 'j7', 'j14', 'j21'
 */
async function markRelanceEnvoyee(factureId, type) {
  const db = getSupabase();
  if (!db) return;

  const updates = {};
  const now = new Date().toISOString();

  if (type === 'j7') {
    updates.relance_j7_envoyee = true;
    updates.date_relance_j7 = now;
  } else if (type === 'j14') {
    updates.relance_j14_envoyee = true;
    updates.date_relance_j14 = now;
  } else if (type === 'j21') {
    updates.relance_j21_envoyee = true;
    updates.date_relance_j21 = now;
  }

  // Mettre à jour aussi les champs du système existant pour compatibilité
  updates.date_derniere_relance = now;

  const { error } = await db
    .from('factures')
    .update(updates)
    .eq('id', factureId);

  if (error) {
    console.error(`[Relances] Erreur marquage ${type}:`, error.message);
  }
}

/**
 * Enregistre une relance dans l'historique
 */
async function logRelance(tenantId, factureId, type, emailEnvoye, smsEnvoye) {
  const db = getSupabase();
  if (!db) return;

  const { error } = await db
    .from('relances_factures')
    .insert({
      tenant_id: tenantId,
      facture_id: factureId,
      niveau: type === 'j7' ? 2 : type === 'j14' ? 3 : 4,
      type,
      email_envoye: emailEnvoye,
      sms_envoye: smsEnvoye
    });

  if (error) {
    console.error('[Relances] Erreur log historique:', error.message);
  }
}

// ============= GENERATION EMAIL =============

/**
 * Génère le contenu email pour une relance
 */
function genererEmailRelance(facture, config, tenantConfig) {
  const montantTTC = ((facture.montant_ttc || 0) / 100).toFixed(2);
  const dateEcheance = facture.date_echeance
    ? new Date(facture.date_echeance).toLocaleDateString('fr-FR')
    : 'Non définie';

  // Calculer jours de retard
  const joursRetard = facture.date_echeance
    ? Math.floor((Date.now() - new Date(facture.date_echeance).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const t = tenantConfig;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${config.objet}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-top: 4px solid ${config.couleur}; padding-top: 20px;">
    <h1 style="color: ${config.couleur}; margin-bottom: 10px;">
      ${config.nom}
    </h1>

    <p>Bonjour ${facture.client_nom || 'Cher client'},</p>

    ${config.type === 'j7' ? `
    <p>Nous vous rappelons que la facture <strong>${facture.numero}</strong> reste en attente de règlement.</p>
    <p>L'échéance était fixée au <strong>${dateEcheance}</strong>, soit il y a <strong>${joursRetard} jours</strong>.</p>
    <p>Merci de bien vouloir procéder au règlement dans les meilleurs délais.</p>
    ` : config.type === 'j14' ? `
    <p>Malgré notre précédent rappel, la facture <strong>${facture.numero}</strong> reste impayée depuis <strong>${joursRetard} jours</strong>.</p>
    <p style="color: ${config.couleur}; font-weight: bold;">Nous vous prions de régulariser cette situation dans les plus brefs délais.</p>
    <p>Sans réponse de votre part sous 7 jours, nous serons contraints d'engager des actions de recouvrement.</p>
    ` : `
    <p style="font-weight: bold; color: ${config.couleur};">MISE EN DEMEURE DE PAYER</p>
    <p>La facture <strong>${facture.numero}</strong> est impayée depuis <strong>${joursRetard} jours</strong> malgré nos multiples relances.</p>
    <p style="color: ${config.couleur}; font-weight: bold;">Cette mise en demeure constitue un dernier avertissement avant engagement de poursuites judiciaires.</p>
    <p>Vous disposez d'un délai de <strong>8 jours</strong> à compter de la réception de ce message pour procéder au règlement intégral.</p>
    `}

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Facture n°:</strong> ${facture.numero}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${facture.service_nom || 'Prestation'}</p>
      <p style="margin: 5px 0;"><strong>Montant TTC:</strong> ${montantTTC} €</p>
      <p style="margin: 5px 0;"><strong>Échéance:</strong> ${dateEcheance}</p>
      <p style="margin: 5px 0; color: ${config.couleur}; font-weight: bold;"><strong>Retard:</strong> ${joursRetard} jours</p>
    </div>

    <p><strong>Moyens de paiement acceptés :</strong></p>
    <ul>
      <li>Virement bancaire</li>
      <li>Espèces</li>
      <li>PayPal</li>
    </ul>

    <p>Si vous avez déjà effectué le règlement, merci de nous en informer en répondant à cet email.</p>

    <p>Cordialement,<br>
    <strong>${t.ownerName || t.businessName}</strong><br>
    ${t.businessName}</p>

    <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 12px; color: #666;">
      ${t.businessName}<br>
      ${t.phone ? `Tél: ${t.phone}<br>` : ''}
      ${t.email || ''}
    </p>
  </div>
</body>
</html>`;

  return {
    subject: `${config.objet} - Facture ${facture.numero}`,
    html
  };
}

// ============= ENVOI RELANCES =============

/**
 * Envoie une relance pour une facture
 * @param {Object} facture
 * @param {string} type - 'j7', 'j14', 'j21'
 * @param {string} tenantId
 */
async function envoyerRelance(facture, type, tenantId) {
  const config = RELANCE_CONFIG[type];
  const tenantConfig = getTenantConfig(tenantId);
  const resend = getResend();

  console.log(`[Relances] 📤 Envoi ${config.nom} - Facture ${facture.numero}`);

  let emailEnvoye = false;
  let smsEnvoye = false;

  // 1. Envoyer email
  if (config.canaux.includes('email') && facture.client_email && resend) {
    try {
      const { subject, html } = genererEmailRelance(facture, config, tenantConfig);
      const fromEmail = tenantConfig.email || `noreply@${tenantConfig.domain || 'nexus.app'}`;

      await resend.emails.send({
        from: `${tenantConfig.businessName} <${fromEmail}>`,
        to: facture.client_email,
        subject,
        html
      });

      emailEnvoye = true;
      console.log(`[Relances] ✅ Email ${type} envoyé: ${facture.client_email}`);
    } catch (error) {
      console.error(`[Relances] ❌ Erreur email ${type}:`, error.message);
    }
  }

  // 2. Envoyer SMS (J+14 et J+21)
  if (config.canaux.includes('sms') && facture.client_telephone) {
    // TODO: Intégrer Twilio/autre service SMS
    console.log(`[Relances] 📱 SMS ${type} à implémenter: ${facture.client_telephone}`);
    // smsEnvoye = true; // Décommenter quand implémenté
  }

  // 3. Notification admin (J+21)
  if (config.notifyAdmin) {
    console.log(`[Relances] 🚨 ALERTE ADMIN: Mise en demeure envoyée pour facture ${facture.numero}`);
    // TODO: Envoyer notification à l'admin (email/Slack/webhook)
  }

  // 4. Marquer et logger si au moins un canal a fonctionné
  if (emailEnvoye || smsEnvoye) {
    await markRelanceEnvoyee(facture.id, type);
    await logRelance(tenantId, facture.id, type, emailEnvoye, smsEnvoye);
  }

  return { success: emailEnvoye || smsEnvoye, emailEnvoye, smsEnvoye };
}

// ============= JOB PRINCIPAL =============

/**
 * Traite toutes les relances J+7/J+14/J+21 pour un tenant
 * @param {string} tenantId
 */
export async function traiterRelancesTenant(tenantId) {
  console.log(`\n[Relances] 🏢 Traitement tenant: ${tenantId}`);

  const resultats = {
    j7: { total: 0, envoyees: 0, erreurs: 0 },
    j14: { total: 0, envoyees: 0, erreurs: 0 },
    j21: { total: 0, envoyees: 0, erreurs: 0 }
  };

  // 1. Relances J+7
  const facturesJ7 = await getFacturesJ7(tenantId);
  resultats.j7.total = facturesJ7.length;
  console.log(`[Relances] 📋 J+7: ${facturesJ7.length} factures`);

  for (const facture of facturesJ7) {
    try {
      const result = await envoyerRelance(facture, 'j7', tenantId);
      if (result.success) resultats.j7.envoyees++;
      else resultats.j7.erreurs++;
    } catch (error) {
      resultats.j7.erreurs++;
      console.error(`[Relances] ❌ J+7 ${facture.numero}:`, error.message);
    }
  }

  // 2. Relances J+14
  const facturesJ14 = await getFacturesJ14(tenantId);
  resultats.j14.total = facturesJ14.length;
  console.log(`[Relances] 📋 J+14: ${facturesJ14.length} factures`);

  for (const facture of facturesJ14) {
    try {
      const result = await envoyerRelance(facture, 'j14', tenantId);
      if (result.success) resultats.j14.envoyees++;
      else resultats.j14.erreurs++;
    } catch (error) {
      resultats.j14.erreurs++;
      console.error(`[Relances] ❌ J+14 ${facture.numero}:`, error.message);
    }
  }

  // 3. Relances J+21 (mise en demeure)
  const facturesJ21 = await getFacturesJ21(tenantId);
  resultats.j21.total = facturesJ21.length;
  console.log(`[Relances] 📋 J+21: ${facturesJ21.length} factures`);

  for (const facture of facturesJ21) {
    try {
      const result = await envoyerRelance(facture, 'j21', tenantId);
      if (result.success) resultats.j21.envoyees++;
      else resultats.j21.erreurs++;
    } catch (error) {
      resultats.j21.erreurs++;
      console.error(`[Relances] ❌ J+21 ${facture.numero}:`, error.message);
    }
  }

  const totalEnvoyees = resultats.j7.envoyees + resultats.j14.envoyees + resultats.j21.envoyees;
  const totalErreurs = resultats.j7.erreurs + resultats.j14.erreurs + resultats.j21.erreurs;

  console.log(`[Relances] 📊 Tenant ${tenantId}: ${totalEnvoyees} envoyées, ${totalErreurs} erreurs`);

  return {
    ...resultats,
    totalEnvoyees,
    totalErreurs
  };
}

/**
 * Traite les relances pour tous les tenants actifs
 * Appelé par le scheduler quotidien
 */
export async function traiterToutesRelancesJ7J14J21() {
  const db = getSupabase();
  if (!db) {
    console.log('[Relances] ⚠️ Supabase non configuré');
    return { success: false, error: 'Supabase non configuré' };
  }

  console.log(`\n[Relances] 🚀 Début traitement relances J+7/J+14/J+21 - ${new Date().toLocaleString('fr-FR')}`);

  // Récupérer tous les tenants avec des factures impayées (exclure avoirs)
  const { data: tenants, error } = await db
    .from('factures')
    .select('tenant_id')
    .not('statut', 'in', '("payee","annulee")')
    .neq('type', 'avoir')
    .eq('avoir_emis', false)
    .not('date_echeance', 'is', null);

  if (error) {
    console.error('[Relances] ❌ Erreur récupération tenants:', error.message);
    return { success: false, error: error.message };
  }

  // Dédupliquer
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
    resultatsGlobaux.totalEnvoyees += resultat.totalEnvoyees;
    resultatsGlobaux.totalErreurs += resultat.totalErreurs;
  }

  console.log(`\n[Relances] ✅ Terminé: ${resultatsGlobaux.totalEnvoyees} relances envoyées, ${resultatsGlobaux.totalErreurs} erreurs`);

  return { success: true, ...resultatsGlobaux };
}

/**
 * Récupère les statistiques de relances pour un tenant
 */
export async function getStatsRelances(tenantId) {
  const db = getSupabase();
  if (!db) return { j7: 0, j14: 0, j21: 0, total: 0 };

  const { data, error } = await db
    .from('factures')
    .select('relance_j7_envoyee, relance_j14_envoyee, relance_j21_envoyee')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '("payee","annulee")')
    .neq('type', 'avoir')
    .eq('avoir_emis', false);

  if (error) {
    console.error('[Relances] Erreur stats:', error.message);
    return { j7: 0, j14: 0, j21: 0, total: 0 };
  }

  const stats = { j7: 0, j14: 0, j21: 0, total: 0 };
  (data || []).forEach(f => {
    if (f.relance_j7_envoyee) stats.j7++;
    if (f.relance_j14_envoyee) stats.j14++;
    if (f.relance_j21_envoyee) stats.j21++;
    if (f.relance_j7_envoyee || f.relance_j14_envoyee || f.relance_j21_envoyee) stats.total++;
  });

  return stats;
}

// Export par défaut
export default {
  traiterRelancesTenant,
  traiterToutesRelancesJ7J14J21,
  getStatsRelances,
  RELANCE_CONFIG
};
