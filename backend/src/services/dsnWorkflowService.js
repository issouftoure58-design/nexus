/**
 * Service Workflow DSN
 * Gestion du cycle de vie DSN: brouillon → validee → soumise → acceptee/rejetee
 * DSN evenementielles (arret, fin contrat, reprise)
 */

import { supabase } from '../config/supabase.js';
import { generateDSN } from './dsnGenerator.js';
import { validerDSN, genererRapport } from './dsnValidator.js';

// Etats valides et transitions
const TRANSITIONS = {
  brouillon: ['validee', 'annulee'],
  validee: ['soumise', 'brouillon', 'annulee'],
  soumise: ['en_traitement', 'annulee'],
  en_traitement: ['acceptee', 'rejetee'],
  acceptee: [],
  rejetee: ['brouillon'],
  annulee: [],
};

/**
 * Cree un brouillon DSN
 * @param {string} tenantId
 * @param {string} periode - YYYY-MM
 * @param {string} nature - 01=mensuelle, 02=arret, 04=fin contrat
 * @param {Object} options - membreId, evenement (pour evenementielles)
 * @returns {Object} DSN avec status brouillon
 */
export async function createDSNDraft(tenantId, periode, nature = '01', options = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('periode requis');

  // Generer le contenu DSN
  const result = await generateDSN(tenantId, periode, nature, options);

  // Sauvegarder en brouillon
  const { data: dsn, error } = await supabase
    .from('rh_dsn_historique')
    .insert({
      tenant_id: tenantId,
      periode,
      type_declaration: nature === '01' ? 'mensuelle' : 'evenementielle',
      nature_envoi: nature,
      nature,
      nb_salaries: result.stats.individus,
      total_brut: 0, // Sera recalcule
      total_cotisations: 0,
      statut: 'generee',
      workflow_status: 'brouillon',
      fichier_nom: result.filename,
      contenu_dsn: result.content,
      membre_id: options.membreId || null,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: dsn.id,
    status: 'brouillon',
    content: result.content,
    stats: result.stats,
    filename: result.filename,
  };
}

/**
 * Valide une DSN (passage brouillon → validee)
 * @param {string} tenantId
 * @param {string} dsnId
 * @returns {Object} Rapport de validation
 */
export async function validateDSN(tenantId, dsnId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!dsnId) throw new Error('dsnId requis');

  // Recuperer la DSN
  const { data: dsn, error } = await supabase
    .from('rh_dsn_historique')
    .select('*')
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !dsn) throw new Error('DSN non trouvee');

  // Verifier la transition
  const currentStatus = dsn.workflow_status || 'brouillon';
  if (!TRANSITIONS[currentStatus]?.includes('validee')) {
    throw new Error(`Transition impossible: ${currentStatus} → validee`);
  }

  // Valider avec le validateur existant
  const validationResult = validerDSN(dsn.contenu_dsn);
  const rapport = genererRapport(validationResult);

  const newStatus = validationResult.valide ? 'validee' : 'brouillon';

  // Mettre a jour
  const { data: updated, error: updateErr } = await supabase
    .from('rh_dsn_historique')
    .update({
      workflow_status: newStatus,
      validation_report: {
        valide: validationResult.valide,
        erreurs: validationResult.erreurs,
        avertissements: validationResult.avertissements,
        stats: validationResult.stats,
        rapport,
        validated_at: new Date().toISOString(),
      },
      statut: newStatus === 'validee' ? 'validee' : 'erreur',
    })
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  return {
    id: dsnId,
    status: newStatus,
    validationReport: {
      valide: validationResult.valide,
      erreurs: validationResult.erreurs.length,
      avertissements: validationResult.avertissements.length,
      details: validationResult,
      rapport,
    },
  };
}

/**
 * Soumet une DSN (passage validee → soumise)
 * En production, cela enverrait a net-entreprises.fr
 * @param {string} tenantId
 * @param {string} dsnId
 * @returns {Object} Reference de depot
 */
export async function submitDSN(tenantId, dsnId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!dsnId) throw new Error('dsnId requis');

  const { data: dsn, error } = await supabase
    .from('rh_dsn_historique')
    .select('*')
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !dsn) throw new Error('DSN non trouvee');

  const currentStatus = dsn.workflow_status || 'brouillon';
  if (!TRANSITIONS[currentStatus]?.includes('soumise')) {
    throw new Error(`Transition impossible: ${currentStatus} → soumise. La DSN doit etre validee.`);
  }

  // En production: appel API net-entreprises.fr
  // Pour l'instant: simulation avec reference
  const referenceDepot = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const { data: updated, error: updateErr } = await supabase
    .from('rh_dsn_historique')
    .update({
      workflow_status: 'soumise',
      statut: 'soumise',
      reference_depot: referenceDepot,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  return {
    id: dsnId,
    status: 'soumise',
    submittedAt: updated.submitted_at,
    referenceDepot,
    message: 'DSN soumise avec succes. Reference de depot: ' + referenceDepot,
  };
}

/**
 * Traite un retour URSSAF (ARC = Accuse de Reception, ARE = Avis de Rejet)
 * @param {string} tenantId
 * @param {string} dsnId
 * @param {Object} retour - { type: 'arc'|'are', contenu, erreurs? }
 * @returns {Object} DSN mise a jour
 */
export async function processRetour(tenantId, dsnId, retour) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!dsnId) throw new Error('dsnId requis');

  const { data: dsn, error } = await supabase
    .from('rh_dsn_historique')
    .select('*')
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !dsn) throw new Error('DSN non trouvee');

  const isAccepted = retour.type === 'arc';
  const newStatus = isAccepted ? 'acceptee' : 'rejetee';

  const updateData = {
    workflow_status: newStatus,
    statut: isAccepted ? 'acceptee' : 'rejetee',
  };

  if (isAccepted) {
    updateData.retour_arc = {
      date: new Date().toISOString(),
      contenu: retour.contenu || 'Accuse de reception confirme',
      reference: retour.reference || dsn.reference_depot,
    };
  } else {
    updateData.retour_are = {
      date: new Date().toISOString(),
      contenu: retour.contenu || 'Rejet',
      erreurs: retour.erreurs || [],
      motif: retour.motif || 'Erreur dans la declaration',
    };
  }

  const { data: updated, error: updateErr } = await supabase
    .from('rh_dsn_historique')
    .update(updateData)
    .eq('id', dsnId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  return {
    id: dsnId,
    status: newStatus,
    retourDetails: isAccepted ? updated.retour_arc : updated.retour_are,
  };
}

/**
 * Genere une DSN evenementielle (arret de travail, fin de contrat, reprise)
 * @param {string} tenantId
 * @param {string} membreId
 * @param {string} nature - 02=arret, 04=fin contrat, 05=reprise
 * @param {Object} evenement - Details de l'evenement
 * @returns {Object} DSN draft
 */
export async function generateDSNEvenementielle(tenantId, membreId, nature, evenement) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!membreId) throw new Error('membreId requis');
  if (!['02', '04', '05'].includes(nature)) {
    throw new Error('Nature DSN evenementielle invalide. Utiliser 02 (arret), 04 (fin contrat) ou 05 (reprise)');
  }

  // La periode est le mois de l'evenement
  const dateEvt = evenement.date_debut || evenement.date_fin || new Date().toISOString().slice(0, 10);
  const periode = dateEvt.slice(0, 7);

  return createDSNDraft(tenantId, periode, nature, {
    membreId,
    evenement,
  });
}

/**
 * Retourne le calendrier DSN pour une annee
 * Echeances: 5 du mois suivant (≥50 salaries) ou 15 du mois suivant (<50)
 * @param {string} tenantId
 * @param {number} annee
 * @returns {Array} Calendrier avec statuts
 */
export async function getDSNCalendar(tenantId, annee) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Determiner l'effectif
  const { count: effectif } = await supabase
    .from('rh_membres')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  const echeanceJour = (effectif || 0) >= 50 ? 5 : 15;

  // Recuperer les DSN existantes de l'annee
  const { data: dsns } = await supabase
    .from('rh_dsn_historique')
    .select('id, periode, workflow_status, statut, submitted_at, nature')
    .eq('tenant_id', tenantId)
    .gte('periode', `${annee}-01`)
    .lte('periode', `${annee}-12`)
    .eq('nature', '01') // Mensuelle uniquement
    .order('periode');

  const dsnMap = new Map();
  (dsns || []).forEach(d => {
    // Garder la plus recente par periode
    if (!dsnMap.has(d.periode) || d.submitted_at > dsnMap.get(d.periode).submitted_at) {
      dsnMap.set(d.periode, d);
    }
  });

  const calendar = [];
  const now = new Date();

  for (let m = 1; m <= 12; m++) {
    const periode = `${annee}-${String(m).padStart(2, '0')}`;
    const moisSuivant = m === 12 ? 1 : m + 1;
    const anneeSuivante = m === 12 ? annee + 1 : annee;
    const echeance = new Date(anneeSuivante, moisSuivant - 1, echeanceJour);

    const dsn = dsnMap.get(periode);
    const enRetard = !dsn && echeance < now;

    calendar.push({
      periode,
      echeance: echeance.toISOString().slice(0, 10),
      echeanceJour,
      status: dsn?.workflow_status || (enRetard ? 'en_retard' : 'a_faire'),
      dsnId: dsn?.id || null,
      submittedAt: dsn?.submitted_at || null,
    });
  }

  return calendar;
}

/**
 * Recupere les DSN evenementielles d'un employe
 */
export async function getDSNEvenementielles(tenantId, membreId = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  let query = supabase
    .from('rh_dsn_historique')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('nature', ['02', '04', '05'])
    .order('created_at', { ascending: false });

  if (membreId) query = query.eq('membre_id', membreId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export default {
  createDSNDraft,
  validateDSN,
  submitDSN,
  processRetour,
  generateDSNEvenementielle,
  getDSNCalendar,
  getDSNEvenementielles,
};
