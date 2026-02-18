/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   SERVICE RELANCES FACTURES - Système automatique R1 à Contentieux            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   R1: 7 jours AVANT échéance (préventive)                                     ║
 * ║   R2: Jour d'échéance                                                         ║
 * ║   R3: Échéance +7j                                                            ║
 * ║   R4: Échéance +15j                                                           ║
 * ║   R5: Mise en demeure +21j                                                    ║
 * ║   Contentieux: +30j (transmission huissier/service interne)                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
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

// ============= CONFIGURATION DES DÉLAIS PAR DÉFAUT =============

const DEFAULT_DELAYS = {
  r1: -7,      // 7 jours AVANT échéance
  r2: 0,       // Jour d'échéance
  r3: 7,       // 7 jours après échéance
  r4: 15,      // 15 jours après échéance
  r5: 21,      // Mise en demeure +21 jours
  contentieux: 30  // Contentieux +30 jours
};

// Cache des settings par tenant
const settingsCache = new Map();

// ============= CONFIGURATION DES NIVEAUX =============

export const NIVEAUX_RELANCE = {
  1: {
    type: 'preventive',
    nom: 'R1 - Rappel préventif',
    jours: -7, // 7 jours AVANT échéance
    objet: 'Rappel : Facture à régler prochainement',
    couleur: '#3B82F6', // Bleu
    urgence: 'info',
    canaux: ['email']
  },
  2: {
    type: 'echeance',
    nom: 'R2 - Jour d\'échéance',
    jours: 0, // Jour d'échéance
    objet: 'Rappel : Votre facture arrive à échéance aujourd\'hui',
    couleur: '#06B6D4', // Cyan
    urgence: 'normale',
    canaux: ['email']
  },
  3: {
    type: 'relance1',
    nom: 'R3 - Première relance',
    jours: 7, // 7 jours après échéance
    objet: 'Relance : Facture impayée depuis 7 jours',
    couleur: '#EAB308', // Yellow
    urgence: 'moyenne',
    canaux: ['email', 'sms']
  },
  4: {
    type: 'relance2',
    nom: 'R4 - Deuxième relance',
    jours: 15, // 15 jours après échéance
    objet: 'URGENT : Facture impayée depuis 15 jours',
    couleur: '#F97316', // Orange
    urgence: 'haute',
    canaux: ['email', 'sms']
  },
  5: {
    type: 'mise_en_demeure',
    nom: 'R5 - Mise en demeure',
    jours: 21, // 21 jours après échéance
    objet: 'MISE EN DEMEURE : Règlement immédiat requis',
    couleur: '#EF4444', // Rouge
    urgence: 'critique',
    canaux: ['email', 'sms', 'courrier'],
    notifyAdmin: true
  },
  6: {
    type: 'contentieux',
    nom: 'Contentieux',
    jours: 30, // 30 jours après échéance
    objet: 'Transmission au service contentieux',
    couleur: '#7C3AED', // Violet
    urgence: 'contentieux',
    canaux: ['email', 'courrier']
  }
};

// ============= FONCTIONS UTILITAIRES =============

/**
 * Calcule le nombre de jours de retard par rapport à l'échéance
 */
function calculerJoursRetard(dateEcheance) {
  if (!dateEcheance) return 0;
  const echeance = new Date(dateEcheance);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  echeance.setHours(0, 0, 0, 0);
  return Math.floor((aujourdhui - echeance) / (1000 * 60 * 60 * 24));
}

/**
 * Détermine le niveau de relance en fonction des jours de retard
 */
function determinerNiveauRelance(joursRetard) {
  if (joursRetard >= 30) return 6; // Contentieux
  if (joursRetard >= 21) return 5; // Mise en demeure
  if (joursRetard >= 15) return 4; // R4
  if (joursRetard >= 7) return 3;  // R3
  if (joursRetard >= 0) return 2;  // R2 (jour d'échéance)
  if (joursRetard >= -7) return 1; // R1 (7 jours avant)
  return 0; // Pas encore de relance
}

// ============= RÉCUPÉRATION DES DONNÉES =============

/**
 * Récupère les factures impayées avec leur niveau de relance
 */
export async function getFacturesARelancer(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('factures')
    .select(`
      id,
      numero,
      client_nom,
      client_email,
      client_telephone,
      montant_ttc,
      date_facture,
      date_echeance,
      statut,
      niveau_relance,
      date_derniere_relance,
      en_contentieux
    `)
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '(payee,annulee)')
    .not('date_echeance', 'is', null)
    .order('date_echeance', { ascending: true });

  if (error) {
    console.error('[Relances] Erreur récupération factures:', error.message);
    return [];
  }

  // Calculer les jours de retard et le niveau pour chaque facture
  return (data || []).map(f => {
    const joursRetard = calculerJoursRetard(f.date_echeance);
    const niveauCalcule = determinerNiveauRelance(joursRetard);

    return {
      ...f,
      jours_retard: joursRetard,
      niveau_relance: f.niveau_relance || 0,
      niveau_attendu: niveauCalcule,
      dernier_envoi: f.date_derniere_relance
    };
  });
}

/**
 * Récupère les stats de relances avec les nouveaux niveaux
 */
export async function getStatsRelances(tenantId) {
  const db = getSupabase();
  if (!db) return getEmptyStats();

  const { data, error } = await db
    .from('factures')
    .select('id, date_echeance, montant_ttc, niveau_relance, en_contentieux')
    .eq('tenant_id', tenantId)
    .not('statut', 'in', '(payee,annulee)')
    .not('date_echeance', 'is', null);

  if (error) {
    console.error('[Relances] Erreur stats:', error.message);
    return getEmptyStats();
  }

  const stats = {
    total_impayees: 0,
    montant_total: 0,
    r1_preventive: 0,
    r2_echeance: 0,
    r3_plus7: 0,
    r4_plus15: 0,
    r5_mise_demeure: 0,
    contentieux: 0
  };

  (data || []).forEach(f => {
    const joursRetard = calculerJoursRetard(f.date_echeance);
    const niveau = determinerNiveauRelance(joursRetard);

    stats.total_impayees++;
    stats.montant_total += f.montant_ttc || 0;

    if (f.en_contentieux) {
      stats.contentieux++;
    } else if (niveau === 1 || joursRetard < 0) {
      stats.r1_preventive++;
    } else if (niveau === 2 || joursRetard === 0) {
      stats.r2_echeance++;
    } else if (niveau === 3 || joursRetard <= 7) {
      stats.r3_plus7++;
    } else if (niveau === 4 || joursRetard <= 15) {
      stats.r4_plus15++;
    } else if (niveau === 5 || joursRetard <= 21) {
      stats.r5_mise_demeure++;
    } else {
      stats.contentieux++;
    }
  });

  return stats;
}

function getEmptyStats() {
  return {
    total_impayees: 0,
    montant_total: 0,
    r1_preventive: 0,
    r2_echeance: 0,
    r3_plus7: 0,
    r4_plus15: 0,
    r5_mise_demeure: 0,
    contentieux: 0
  };
}

// ============= GÉNÉRATION EMAIL =============

function genererEmailRelance(facture, niveau, tenantConfig) {
  const config = NIVEAUX_RELANCE[niveau];
  const t = tenantConfig;
  const montantTTC = ((facture.montant_ttc || 0) / 100).toFixed(2);
  const dateEcheance = facture.date_echeance
    ? new Date(facture.date_echeance).toLocaleDateString('fr-FR')
    : 'Non définie';
  const joursRetard = calculerJoursRetard(facture.date_echeance);

  const messages = {
    1: `
      <p>Nous vous rappelons que la facture <strong>${facture.numero}</strong> arrivera à échéance le <strong>${dateEcheance}</strong>.</p>
      <p>Merci de bien vouloir procéder au règlement dans les délais impartis.</p>
    `,
    2: `
      <p>La facture <strong>${facture.numero}</strong> arrive à échéance <strong>aujourd'hui</strong>.</p>
      <p>Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.</p>
    `,
    3: `
      <p>Sauf erreur de notre part, la facture <strong>${facture.numero}</strong> reste impayée depuis <strong>${joursRetard} jours</strong>.</p>
      <p style="color: ${config.couleur};">Nous vous prions de régulariser cette situation rapidement.</p>
    `,
    4: `
      <p>Malgré nos précédents rappels, la facture <strong>${facture.numero}</strong> reste impayée depuis <strong>${joursRetard} jours</strong>.</p>
      <p style="color: ${config.couleur}; font-weight: bold;">Nous vous demandons de régler cette facture dans les plus brefs délais.</p>
      <p>Sans règlement de votre part, nous serons contraints d'engager des actions de recouvrement.</p>
    `,
    5: `
      <p style="font-weight: bold; color: ${config.couleur}; font-size: 18px;">MISE EN DEMEURE DE PAYER</p>
      <p>La facture <strong>${facture.numero}</strong> est impayée depuis <strong>${joursRetard} jours</strong> malgré nos multiples relances.</p>
      <p style="color: ${config.couleur}; font-weight: bold;">Cette mise en demeure constitue un dernier avertissement avant transmission au service contentieux.</p>
      <p>Vous disposez d'un délai de <strong>8 jours</strong> à compter de la réception de ce message pour procéder au règlement intégral, faute de quoi votre dossier sera transmis à notre service de recouvrement.</p>
    `,
    6: `
      <p style="font-weight: bold; color: ${config.couleur}; font-size: 18px;">TRANSMISSION AU SERVICE CONTENTIEUX</p>
      <p>Suite à l'absence de règlement de la facture <strong>${facture.numero}</strong> malgré nos multiples relances et mise en demeure, votre dossier a été transmis à notre service contentieux.</p>
      <p>Des frais de recouvrement seront ajoutés au montant de la créance.</p>
    `
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${config.objet}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-top: 4px solid ${config.couleur}; padding-top: 20px;">
    <h1 style="color: ${config.couleur}; margin-bottom: 10px; font-size: 22px;">
      ${config.nom}
    </h1>

    <p>Bonjour ${facture.client_nom || 'Cher client'},</p>

    ${messages[niveau] || messages[3]}

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Facture n°:</strong> ${facture.numero}</p>
      <p style="margin: 5px 0;"><strong>Montant TTC:</strong> ${montantTTC} €</p>
      <p style="margin: 5px 0;"><strong>Échéance:</strong> ${dateEcheance}</p>
      ${joursRetard > 0 ? `<p style="margin: 5px 0; color: ${config.couleur}; font-weight: bold;"><strong>Retard:</strong> ${joursRetard} jours</p>` : ''}
    </div>

    <p><strong>Moyens de paiement acceptés :</strong></p>
    <ul>
      <li>Virement bancaire</li>
      <li>Espèces</li>
      <li>Carte bancaire</li>
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
 */
export async function envoyerRelance(facture, niveau, tenantId) {
  const db = getSupabase();
  const resend = getResend();
  const config = NIVEAUX_RELANCE[niveau];

  if (!config) {
    return { success: false, error: `Niveau de relance invalide: ${niveau}` };
  }

  const tenantConfig = getTenantConfig(tenantId);
  console.log(`[Relances] 📤 Envoi ${config.nom} pour facture ${facture.numero}`);

  let emailEnvoye = false;
  let smsEnvoye = false;

  // 1. Envoyer email
  if (config.canaux.includes('email') && facture.client_email && resend) {
    try {
      const { subject, html } = genererEmailRelance(facture, niveau, tenantConfig);
      const fromEmail = tenantConfig.email || `noreply@${tenantConfig.domain || 'nexus.app'}`;

      await resend.emails.send({
        from: `${tenantConfig.businessName} <${fromEmail}>`,
        to: facture.client_email,
        subject,
        html
      });

      emailEnvoye = true;
      console.log(`[Relances] ✅ Email envoyé: ${facture.client_email}`);
    } catch (error) {
      console.error(`[Relances] ❌ Erreur email:`, error.message);
    }
  }

  // 2. Envoyer SMS (à partir de R3)
  if (config.canaux.includes('sms') && facture.client_telephone) {
    // TODO: Intégrer Twilio/autre service SMS
    console.log(`[Relances] 📱 SMS ${config.nom} à implémenter: ${facture.client_telephone}`);
  }

  // 3. Notification admin (R5 et contentieux)
  if (config.notifyAdmin) {
    console.log(`[Relances] 🚨 ALERTE ADMIN: ${config.nom} envoyée pour facture ${facture.numero}`);
  }

  // 4. Mettre à jour la facture et logger
  if (db && (emailEnvoye || smsEnvoye)) {
    await db
      .from('factures')
      .update({
        niveau_relance: niveau,
        date_derniere_relance: new Date().toISOString()
      })
      .eq('id', facture.id);

    await db
      .from('relances_factures')
      .insert({
        tenant_id: tenantId,
        facture_id: facture.id,
        niveau,
        type: config.type,
        email_envoye: emailEnvoye,
        sms_envoye: smsEnvoye
      });
  }

  return {
    success: emailEnvoye || smsEnvoye,
    emailEnvoye,
    smsEnvoye,
    niveau,
    message: emailEnvoye ? `${config.nom} envoyée par email` : 'Échec de l\'envoi'
  };
}

/**
 * Transmet un dossier au contentieux
 */
export async function transmettreContentieux(factureId, tenantId, service = 'interne') {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  // Récupérer la facture
  const { data: facture, error: fetchError } = await db
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchError || !facture) {
    return { success: false, error: 'Facture non trouvée' };
  }

  // Marquer comme contentieux
  const { error: updateError } = await db
    .from('factures')
    .update({
      en_contentieux: true,
      niveau_relance: 6,
      date_contentieux: new Date().toISOString(),
      service_contentieux: service
    })
    .eq('id', factureId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Logger dans l'historique
  await db
    .from('relances_factures')
    .insert({
      tenant_id: tenantId,
      facture_id: factureId,
      niveau: 6,
      type: 'contentieux',
      email_envoye: false,
      sms_envoye: false,
      notes: `Transmis au ${service === 'huissier' ? 'huissier de justice' : 'service contentieux interne'}`
    });

  console.log(`[Relances] ⚖️ Dossier ${facture.numero} transmis au contentieux (${service})`);

  return {
    success: true,
    message: service === 'huissier'
      ? 'Dossier transmis à l\'huissier de justice'
      : 'Dossier transmis au service contentieux interne'
  };
}

/**
 * Traite automatiquement les relances pour un tenant
 */
export async function traiterRelancesTenant(tenantId) {
  console.log(`\n[Relances] 🏢 Traitement relances pour tenant: ${tenantId}`);

  const factures = await getFacturesARelancer(tenantId);
  console.log(`[Relances] 📋 ${factures.length} factures impayées`);

  const resultats = {
    total: factures.length,
    envoyees: 0,
    erreurs: 0,
    parNiveau: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  };

  for (const facture of factures) {
    // Calculer le niveau attendu
    const niveauAttendu = facture.niveau_attendu;
    const niveauActuel = facture.niveau_relance || 0;

    // Si le niveau attendu est supérieur au niveau actuel, envoyer la relance
    if (niveauAttendu > niveauActuel && niveauAttendu <= 5) {
      try {
        const result = await envoyerRelance(facture, niveauAttendu, tenantId);
        if (result.success) {
          resultats.envoyees++;
          resultats.parNiveau[niveauAttendu]++;
        } else {
          resultats.erreurs++;
        }
      } catch (error) {
        resultats.erreurs++;
        console.error(`[Relances] ❌ Erreur facture ${facture.numero}:`, error.message);
      }
    }
  }

  console.log(`[Relances] 📊 Résultat: ${resultats.envoyees} envoyées, ${resultats.erreurs} erreurs`);
  return resultats;
}

/**
 * Traite les relances pour tous les tenants
 */
export async function traiterToutesRelances() {
  const db = getSupabase();
  if (!db) {
    console.log('[Relances] ⚠️ Supabase non configuré');
    return { success: false, error: 'Supabase non configuré' };
  }

  console.log(`\n[Relances] 🚀 Début traitement relances - ${new Date().toLocaleString('fr-FR')}`);

  // Récupérer tous les tenants avec des factures impayées
  const { data: tenants, error } = await db
    .from('factures')
    .select('tenant_id')
    .not('statut', 'in', '(payee,annulee)')
    .not('date_echeance', 'is', null);

  if (error) {
    console.error('[Relances] ❌ Erreur récupération tenants:', error.message);
    return { success: false, error: error.message };
  }

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

  console.log(`\n[Relances] ✅ Terminé: ${resultatsGlobaux.totalEnvoyees} relances, ${resultatsGlobaux.totalErreurs} erreurs`);
  return { success: true, ...resultatsGlobaux };
}

// ============= GESTION DES SETTINGS =============

/**
 * Récupère les paramètres de relance pour un tenant
 */
export async function getRelanceSettings(tenantId) {
  // Check cache first
  if (settingsCache.has(tenantId)) {
    return settingsCache.get(tenantId);
  }

  const db = getSupabase();
  if (!db) {
    return { ...DEFAULT_DELAYS };
  }

  const { data, error } = await db
    .from('relance_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    // Return defaults if no settings exist
    return { ...DEFAULT_DELAYS };
  }

  const settings = {
    r1: data.r1_jours ?? DEFAULT_DELAYS.r1,
    r2: data.r2_jours ?? DEFAULT_DELAYS.r2,
    r3: data.r3_jours ?? DEFAULT_DELAYS.r3,
    r4: data.r4_jours ?? DEFAULT_DELAYS.r4,
    r5: data.r5_jours ?? DEFAULT_DELAYS.r5,
    contentieux: data.contentieux_jours ?? DEFAULT_DELAYS.contentieux
  };

  // Cache the settings
  settingsCache.set(tenantId, settings);
  return settings;
}

/**
 * Sauvegarde les paramètres de relance pour un tenant
 */
export async function saveRelanceSettings(tenantId, settings) {
  const db = getSupabase();
  if (!db) {
    return { success: false, error: 'Base de données non disponible' };
  }

  // Validate settings
  const validatedSettings = {
    r1_jours: parseInt(settings.r1) || DEFAULT_DELAYS.r1,
    r2_jours: parseInt(settings.r2) || DEFAULT_DELAYS.r2,
    r3_jours: parseInt(settings.r3) || DEFAULT_DELAYS.r3,
    r4_jours: parseInt(settings.r4) || DEFAULT_DELAYS.r4,
    r5_jours: parseInt(settings.r5) || DEFAULT_DELAYS.r5,
    contentieux_jours: parseInt(settings.contentieux) || DEFAULT_DELAYS.contentieux
  };

  // Upsert settings
  const { error } = await db
    .from('relance_settings')
    .upsert({
      tenant_id: tenantId,
      ...validatedSettings,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'tenant_id'
    });

  if (error) {
    console.error('[Relances] Erreur sauvegarde settings:', error.message);
    return { success: false, error: error.message };
  }

  // Clear cache for this tenant
  settingsCache.delete(tenantId);

  console.log(`[Relances] ✅ Settings mis à jour pour ${tenantId}:`, validatedSettings);

  return {
    success: true,
    message: 'Paramètres de relance mis à jour',
    settings: {
      r1: validatedSettings.r1_jours,
      r2: validatedSettings.r2_jours,
      r3: validatedSettings.r3_jours,
      r4: validatedSettings.r4_jours,
      r5: validatedSettings.r5_jours,
      contentieux: validatedSettings.contentieux_jours
    }
  };
}

/**
 * Récupère les délais pour un tenant (utilisé par le calcul de niveau)
 */
export async function getTenantDelays(tenantId) {
  return await getRelanceSettings(tenantId);
}

// Export par défaut
export default {
  getFacturesARelancer,
  getStatsRelances,
  envoyerRelance,
  transmettreContentieux,
  traiterRelancesTenant,
  traiterToutesRelances,
  getRelanceSettings,
  saveRelanceSettings,
  getTenantDelays,
  NIVEAUX_RELANCE
};
