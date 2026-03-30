import { supabase } from '../config/supabase.js';

/**
 * Service de clôture annuelle RH
 * Report CP, provisions, snapshots cumuls, écritures comptables OD
 */

// --- Constantes ---
const TAUX_CHARGES_PATRONALES = 0.45; // 45% forfaitaire PME
const JOURS_OUVRABLES_MOIS = 21.67;

/**
 * Vérifie les pré-requis avant clôture RH
 * @returns {{ ok: boolean, warnings: string[], errors: string[], stats: object }}
 */
export async function verifierPreClotureRH(tenantId, annee) {
  if (!tenantId) throw new Error('tenant_id requis');

  const errors = [];
  const warnings = [];

  // 1. Récupérer membres actifs
  const { data: membres } = await supabase
    .from('rh_membres')
    .select('id, nom, prenom, statut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  if (!membres || membres.length === 0) {
    errors.push('Aucun membre actif trouvé');
    return { ok: false, warnings, errors, stats: { nb_membres: 0 } };
  }

  const membreIds = membres.map(m => m.id);

  // 2. Vérifier bulletins complets jan→déc
  const { data: bulletins } = await supabase
    .from('rh_bulletins_paie')
    .select('membre_id, periode, statut')
    .eq('tenant_id', tenantId)
    .gte('periode', `${annee}-01`)
    .lte('periode', `${annee}-12`);

  const bulletinsParMembre = {};
  (bulletins || []).forEach(b => {
    if (!bulletinsParMembre[b.membre_id]) bulletinsParMembre[b.membre_id] = {};
    bulletinsParMembre[b.membre_id][b.periode] = b.statut;
  });

  // Vérifier complétude et statut
  let nbBrouillons = 0;
  for (const m of membres) {
    const bulletinsMembre = bulletinsParMembre[m.id] || {};
    const moisManquants = [];
    for (let mois = 1; mois <= 12; mois++) {
      const periode = `${annee}-${String(mois).padStart(2, '0')}`;
      if (!bulletinsMembre[periode]) {
        moisManquants.push(periode);
      } else if (bulletinsMembre[periode] === 'brouillon') {
        nbBrouillons++;
      }
    }
    if (moisManquants.length > 0) {
      errors.push(`${m.prenom} ${m.nom} : bulletins manquants (${moisManquants.join(', ')})`);
    }
  }

  if (nbBrouillons > 0) {
    errors.push(`${nbBrouillons} bulletin(s) encore en statut brouillon`);
  }

  // 3. Vérifier régularisations non appliquées
  const { data: reguls } = await supabase
    .from('rh_regularisations')
    .select('id, membre_id, type, periode_origine')
    .eq('tenant_id', tenantId)
    .gte('periode_origine', `${annee}-01`)
    .lte('periode_origine', `${annee}-12`)
    .neq('status', 'applique');

  if (reguls && reguls.length > 0) {
    errors.push(`${reguls.length} régularisation(s) non appliquée(s) pour ${annee}`);
  }

  // 4. Warning DSN décembre
  const { data: dsn } = await supabase
    .from('rh_dsn_historique')
    .select('id, workflow_status')
    .eq('tenant_id', tenantId)
    .eq('periode', `${annee}-12`)
    .limit(1);

  if (!dsn || dsn.length === 0 || dsn[0].workflow_status !== 'deposee') {
    warnings.push('DSN décembre non déposée — ne bloque pas la clôture');
  }

  // 5. Warning incohérence cumuls (somme bruts bulletins vs cumul décembre)
  const { data: bulletinsDec } = await supabase
    .from('rh_bulletins_paie')
    .select('membre_id, cumul_brut')
    .eq('tenant_id', tenantId)
    .eq('periode', `${annee}-12`);

  if (bulletinsDec && bulletinsDec.length > 0) {
    for (const bDec of bulletinsDec) {
      const { data: allBulletins } = await supabase
        .from('rh_bulletins_paie')
        .select('salaire_brut')
        .eq('tenant_id', tenantId)
        .eq('membre_id', bDec.membre_id)
        .gte('periode', `${annee}-01`)
        .lte('periode', `${annee}-12`);

      const sommeBruts = (allBulletins || []).reduce((sum, b) => sum + (b.salaire_brut || 0), 0);
      if (bDec.cumul_brut && Math.abs(sommeBruts - bDec.cumul_brut) > 1) {
        const m = membres.find(mem => mem.id === bDec.membre_id);
        const nom = m ? `${m.prenom} ${m.nom}` : `Membre #${bDec.membre_id}`;
        warnings.push(`Incohérence cumul brut ${nom} : somme=${sommeBruts} vs cumul=${bDec.cumul_brut}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    stats: {
      nb_membres: membres.length,
      nb_bulletins: bulletins ? bulletins.length : 0,
      nb_brouillons: nbBrouillons,
      nb_reguls_en_attente: reguls ? reguls.length : 0
    }
  };
}

/**
 * Report des congés payés vers N+1
 * Solde = cp_acquis + cp_report_n1 - cp_pris
 */
export async function reporterCongesPayes(tenantId, annee, membresActifs) {
  if (!tenantId) throw new Error('tenant_id requis');

  const anneeN1 = annee + 1;
  const reports = [];

  for (const membre of membresActifs) {
    // Lire compteur année clôturée
    const { data: compteur } = await supabase
      .from('rh_compteurs_conges')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre.id)
      .eq('annee', annee)
      .single();

    if (!compteur) continue;

    const solde = (compteur.cp_acquis || 0) + (compteur.cp_report_n1 || 0) - (compteur.cp_pris || 0);
    const soldeReporte = Math.max(0, solde);

    // Upsert compteur N+1
    const { data: existant } = await supabase
      .from('rh_compteurs_conges')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre.id)
      .eq('annee', anneeN1)
      .single();

    if (existant) {
      await supabase
        .from('rh_compteurs_conges')
        .update({
          cp_report_n1: soldeReporte,
          cp_acquis: 0,
          rtt_acquis: 0,
          rtt_pris: 0,
          rc_acquis: 0,
          rc_pris: 0,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', existant.id);
    } else {
      await supabase
        .from('rh_compteurs_conges')
        .insert({
          tenant_id: tenantId,
          membre_id: membre.id,
          annee: anneeN1,
          cp_report_n1: soldeReporte,
          cp_acquis: 0,
          cp_pris: 0,
          rtt_acquis: 0,
          rtt_pris: 0,
          rc_acquis: 0,
          rc_pris: 0
        });
    }

    reports.push({
      membre_id: membre.id,
      nom: `${membre.prenom} ${membre.nom}`,
      solde_reporte: soldeReporte
    });
  }

  return reports;
}

/**
 * Calcul provision congés payés
 * Salaire journalier = salaire_mensuel / 21.67 (centimes)
 * Provision = solde_cp × salaire_journalier × 1.45
 */
export async function calculerProvisionCP(tenantId, annee, membresActifs) {
  if (!tenantId) throw new Error('tenant_id requis');

  let montantTotal = 0;
  const detail = [];

  for (const membre of membresActifs) {
    const { data: compteur } = await supabase
      .from('rh_compteurs_conges')
      .select('cp_acquis, cp_pris, cp_report_n1')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre.id)
      .eq('annee', annee)
      .single();

    if (!compteur) continue;

    const soldeCP = (compteur.cp_acquis || 0) + (compteur.cp_report_n1 || 0) - (compteur.cp_pris || 0);
    if (soldeCP <= 0) continue;

    const salaireMensuel = membre.salaire_mensuel || 0; // centimes
    const salaireJournalier = Math.round(salaireMensuel / JOURS_OUVRABLES_MOIS);
    const provision = Math.round(soldeCP * salaireJournalier * (1 + TAUX_CHARGES_PATRONALES));

    montantTotal += provision;
    detail.push({
      membre_id: membre.id,
      nom: `${membre.prenom} ${membre.nom}`,
      solde_cp: soldeCP,
      salaire_journalier: salaireJournalier,
      provision
    });
  }

  return {
    montant_total: montantTotal,
    taux_charges: TAUX_CHARGES_PATRONALES,
    detail
  };
}

/**
 * Génère les écritures comptables de provision CP dans le journal OD
 * Idempotent : supprime les anciennes avant insertion
 */
export async function genererEcritureProvisionCP(tenantId, annee, provisionData) {
  if (!tenantId) throw new Error('tenant_id requis');

  const numeroPiece = `PROV-CP-${annee}`;

  // Supprimer anciennes écritures (idempotent)
  await supabase
    .from('ecritures_comptables')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('numero_piece', numeroPiece);

  if (provisionData.montant_total === 0) return [];

  const dateEcriture = `${annee}-12-31`;
  const ecritures = [
    {
      tenant_id: tenantId,
      journal_code: 'OD',
      date_ecriture: dateEcriture,
      numero_piece: numeroPiece,
      compte_numero: '6412',
      compte_libelle: 'Charges congés payés provision',
      libelle: `Provision congés payés ${annee}`,
      debit: provisionData.montant_total,
      credit: 0,
      periode: `${annee}-12`,
      exercice: annee
    },
    {
      tenant_id: tenantId,
      journal_code: 'OD',
      date_ecriture: dateEcriture,
      numero_piece: numeroPiece,
      compte_numero: '4282',
      compte_libelle: 'Dettes provisions CP',
      libelle: `Provision congés payés ${annee}`,
      debit: 0,
      credit: provisionData.montant_total,
      periode: `${annee}-12`,
      exercice: annee
    }
  ];

  const { data, error } = await supabase
    .from('ecritures_comptables')
    .insert(ecritures)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Orchestrateur de clôture annuelle RH
 */
export async function cloturerRH(tenantId, annee, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!annee) throw new Error('annee requise');

  // 1. Vérifier pas de clôture active
  const { data: existante } = await supabase
    .from('rh_cloture_annuelle')
    .select('id, statut')
    .eq('tenant_id', tenantId)
    .eq('annee', annee)
    .single();

  if (existante && existante.statut === 'cloturee') {
    throw new Error(`Clôture RH ${annee} déjà effectuée`);
  }

  // 2. Pré-vérifications
  const verifs = await verifierPreClotureRH(tenantId, annee);
  if (!verifs.ok) {
    throw new Error(`Pré-vérifications échouées : ${verifs.errors.join(' | ')}`);
  }

  // 3. Récupérer membres actifs avec salaire
  const { data: membres } = await supabase
    .from('rh_membres')
    .select('id, nom, prenom, salaire_mensuel, statut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  // 4. Snapshot cumuls (bulletins décembre + compteurs congés)
  const { data: bulletinsDec } = await supabase
    .from('rh_bulletins_paie')
    .select('membre_id, cumul_brut, cumul_net_imposable, cumul_ir, cumuls, net_social')
    .eq('tenant_id', tenantId)
    .eq('periode', `${annee}-12`);

  const { data: compteurs } = await supabase
    .from('rh_compteurs_conges')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('annee', annee);

  const snapshotCumuls = (membres || []).map(m => {
    const bulletin = (bulletinsDec || []).find(b => b.membre_id === m.id);
    const compteur = (compteurs || []).find(c => c.membre_id === m.id);
    return {
      membre_id: m.id,
      nom: `${m.prenom} ${m.nom}`,
      cumul_brut: bulletin?.cumul_brut || 0,
      cumul_net_imposable: bulletin?.cumul_net_imposable || 0,
      cumul_ir: bulletin?.cumul_ir || 0,
      net_social: bulletin?.net_social || 0,
      cumuls_extra: bulletin?.cumuls || {},
      conges: compteur ? {
        cp_acquis: compteur.cp_acquis,
        cp_pris: compteur.cp_pris,
        cp_report_n1: compteur.cp_report_n1,
        rtt_acquis: compteur.rtt_acquis,
        rtt_pris: compteur.rtt_pris
      } : null
    };
  });

  // 5. Report CP → N+1
  const reportCP = await reporterCongesPayes(tenantId, annee, membres);

  // 6. Calcul + écriture provision CP
  const provisionCP = await calculerProvisionCP(tenantId, annee, membres);
  await genererEcritureProvisionCP(tenantId, annee, provisionCP);

  // 7. Insert/update clôture
  if (existante) {
    // Réouverture précédente → mettre à jour
    const { error } = await supabase
      .from('rh_cloture_annuelle')
      .update({
        statut: 'cloturee',
        snapshot_cumuls: snapshotCumuls,
        provision_cp: provisionCP,
        report_cp: reportCP,
        verifications: verifs,
        cloture_par: adminId,
        date_cloture: new Date().toISOString(),
        rouverte_par: null,
        date_reouverture: null,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('id', existante.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('rh_cloture_annuelle')
      .insert({
        tenant_id: tenantId,
        annee,
        statut: 'cloturee',
        snapshot_cumuls: snapshotCumuls,
        provision_cp: provisionCP,
        report_cp: reportCP,
        verifications: verifs,
        cloture_par: adminId,
        date_cloture: new Date().toISOString()
      });

    if (error) throw error;
  }

  return {
    success: true,
    annee,
    nb_membres: membres.length,
    provision_cp: provisionCP.montant_total,
    nb_reports: reportCP.length,
    snapshot_cumuls: snapshotCumuls.length
  };
}

/**
 * Réouverture d'une clôture RH
 */
export async function rouvrirClotureRH(tenantId, annee, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: cloture } = await supabase
    .from('rh_cloture_annuelle')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('annee', annee)
    .eq('statut', 'cloturee')
    .single();

  if (!cloture) {
    throw new Error(`Aucune clôture RH active pour ${annee}`);
  }

  const anneeN1 = annee + 1;

  // 1. Remettre cp_report_n1 à 0 sur compteurs N+1
  const { data: compteursN1 } = await supabase
    .from('rh_compteurs_conges')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('annee', anneeN1);

  if (compteursN1 && compteursN1.length > 0) {
    await supabase
      .from('rh_compteurs_conges')
      .update({
        cp_report_n1: 0,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('annee', anneeN1);
  }

  // 2. Supprimer écritures provision CP
  await supabase
    .from('ecritures_comptables')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('numero_piece', `PROV-CP-${annee}`);

  // 3. Update statut → rouverte
  const { error } = await supabase
    .from('rh_cloture_annuelle')
    .update({
      statut: 'rouverte',
      rouverte_par: adminId,
      date_reouverture: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', cloture.id);

  if (error) throw error;

  return { success: true, annee, statut: 'rouverte' };
}

/**
 * Statut de clôture RH pour une année
 */
export async function getStatutClotureRH(tenantId, annee) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data } = await supabase
    .from('rh_cloture_annuelle')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('annee', annee)
    .single();

  return data || null;
}
