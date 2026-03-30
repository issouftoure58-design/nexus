/**
 * Service Exercices Comptables
 * Gestion exercices, périodes, clôture et réouverture
 */

import { supabase } from '../config/supabase.js';

/**
 * Crée un exercice comptable + 12 périodes mensuelles
 */
export async function createExercice(tenantId, { date_debut, date_fin, code }) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!date_debut || !date_fin || !code) throw new Error('date_debut, date_fin et code requis');

  // Vérifier qu'il n'y a pas de chevauchement
  const { data: existing } = await supabase
    .from('exercices_comptables')
    .select('id, code, date_debut, date_fin')
    .eq('tenant_id', tenantId)
    .or(`and(date_debut.lte.${date_fin},date_fin.gte.${date_debut})`);

  if (existing && existing.length > 0) {
    throw new Error(`Chevauchement avec l'exercice ${existing[0].code} (${existing[0].date_debut} → ${existing[0].date_fin})`);
  }

  const { data: exercice, error } = await supabase
    .from('exercices_comptables')
    .insert({
      tenant_id: tenantId,
      code,
      date_debut,
      date_fin,
      statut: 'ouvert'
    })
    .select()
    .single();

  if (error) throw error;

  // Créer les périodes mensuelles
  const periodes = [];
  const start = new Date(date_debut);
  const end = new Date(date_fin);
  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const periode = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    periodes.push({
      tenant_id: tenantId,
      exercice_id: exercice.id,
      periode,
      verrouillee: false
    });
    current.setMonth(current.getMonth() + 1);
  }

  if (periodes.length > 0) {
    const { error: periodeError } = await supabase
      .from('periodes_comptables')
      .upsert(periodes, { onConflict: 'tenant_id,periode' });

    if (periodeError) {
      console.error('[EXERCICE] Erreur création périodes:', periodeError);
    }
  }

  return { exercice, nb_periodes: periodes.length };
}

/**
 * Auto-init : retourne l'exercice courant ou en crée un pour l'année en cours
 */
export async function getOuCreerExerciceCourant(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Chercher exercice ouvert
  const { data: ouvert } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'ouvert')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ouvert) return ouvert;

  // Aucun exercice ouvert — vérifier s'il en existe au moins un
  const { data: tous } = await supabase
    .from('exercices_comptables')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (tous && tous.length > 0) {
    // Des exercices existent mais tous clôturés — pas d'auto-création
    return null;
  }

  // Aucun exercice du tout → créer EX-{année courante}
  const annee = new Date().getFullYear();
  const code = `EX-${annee}`;
  const { exercice } = await createExercice(tenantId, {
    date_debut: `${annee}-01-01`,
    date_fin: `${annee}-12-31`,
    code
  });

  return exercice;
}

/**
 * Liste tous les exercices d'un tenant
 */
export async function listExercices(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date_debut', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Récupère l'exercice ouvert courant
 */
export async function getExerciceOuvert(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'ouvert')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Vérifie si une période est verrouillée
 */
export async function isPeriodeVerrouillee(tenantId, periode) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) return false;

  const { data } = await supabase
    .from('periodes_comptables')
    .select('verrouillee')
    .eq('tenant_id', tenantId)
    .eq('periode', periode)
    .maybeSingle();

  return data?.verrouillee === true;
}

/**
 * Verrouille une période comptable
 */
export async function verrouillerPeriode(tenantId, periode, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('période requise');

  const { data, error } = await supabase
    .from('periodes_comptables')
    .update({
      verrouillee: true,
      date_verrouillage: new Date().toISOString(),
      verrouille_par: adminId
    })
    .eq('tenant_id', tenantId)
    .eq('periode', periode)
    .select()
    .single();

  if (error) throw error;
  return { success: true, periode: data };
}

/**
 * Déverrouille une période comptable
 */
export async function deverrouillerPeriode(tenantId, periode, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('période requise');

  const { data, error } = await supabase
    .from('periodes_comptables')
    .update({
      verrouillee: false,
      date_verrouillage: null,
      verrouille_par: null
    })
    .eq('tenant_id', tenantId)
    .eq('periode', periode)
    .select()
    .single();

  if (error) throw error;
  return { success: true, periode: data };
}

/**
 * Liste les périodes d'un exercice avec statut verrouillage
 */
export async function listPeriodes(tenantId, exerciceId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('periodes_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('exercice_id', exerciceId)
    .order('periode', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Vérification pré-clôture
 */
export async function verifierPreCloture(tenantId, exerciceId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const warnings = [];
  const errors = [];

  // Récupérer l'exercice
  const { data: exercice } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId)
    .single();

  if (!exercice) {
    errors.push('Exercice introuvable');
    return { ok: false, warnings, errors };
  }

  if (exercice.statut === 'cloture') {
    errors.push('Exercice déjà clôturé');
    return { ok: false, warnings, errors };
  }

  const annee = new Date(exercice.date_debut).getFullYear();

  // Vérifier écritures équilibrées par pièce
  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('numero_piece, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('exercice', annee);

  if (!ecritures || ecritures.length === 0) {
    warnings.push('Aucune écriture trouvée pour cet exercice');
  } else {
    // Vérifier équilibre global
    const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      errors.push(`Écritures déséquilibrées: débit=${totalDebit} crédit=${totalCredit} diff=${totalDebit - totalCredit}`);
    }

    // Vérifier équilibre par pièce
    const pieces = {};
    ecritures.forEach(e => {
      const key = e.numero_piece || 'SANS_PIECE';
      if (!pieces[key]) pieces[key] = { debit: 0, credit: 0 };
      pieces[key].debit += e.debit || 0;
      pieces[key].credit += e.credit || 0;
    });

    Object.entries(pieces).forEach(([piece, totaux]) => {
      if (totaux.debit !== totaux.credit) {
        warnings.push(`Pièce ${piece} déséquilibrée: D=${totaux.debit} C=${totaux.credit}`);
      }
    });
  }

  // Vérifier écritures non lettrées sur comptes tiers
  const { data: nonLettrees } = await supabase
    .from('ecritures_comptables')
    .select('id, compte_numero')
    .eq('tenant_id', tenantId)
    .eq('exercice', annee)
    .is('lettrage', null)
    .or('compte_numero.like.411%,compte_numero.like.401%');

  if (nonLettrees && nonLettrees.length > 0) {
    warnings.push(`${nonLettrees.length} écritures non lettrées sur comptes tiers (411/401)`);
  }

  // Vérifier périodes non verrouillées
  const { data: periodesOuvertes } = await supabase
    .from('periodes_comptables')
    .select('periode')
    .eq('tenant_id', tenantId)
    .eq('exercice_id', exerciceId)
    .eq('verrouillee', false);

  if (periodesOuvertes && periodesOuvertes.length > 0) {
    warnings.push(`${periodesOuvertes.length} période(s) non verrouillée(s): ${periodesOuvertes.map(p => p.periode).join(', ')}`);
  }

  // Vérifier clôture RH (provisions CP)
  const { data: clotureRH } = await supabase
    .from('rh_cloture_annuelle')
    .select('statut')
    .eq('tenant_id', tenantId)
    .eq('annee', annee)
    .eq('statut', 'cloturee')
    .single();

  if (!clotureRH) {
    warnings.push('Clôture RH non effectuée — provisions CP non comptabilisées');
  }

  // Vérifier facturation
  const { data: facturesBrouillon } = await supabase
    .from('factures')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('date_facture', `${annee}-01-01`)
    .lte('date_facture', `${annee}-12-31`)
    .eq('statut', 'brouillon');

  if (facturesBrouillon && facturesBrouillon.length > 0) {
    warnings.push(`${facturesBrouillon.length} facture(s) en brouillon sur ${annee}`);
  }

  // Vérifier trous de numérotation (obligation légale)
  const { data: facturesEmises } = await supabase
    .from('factures')
    .select('numero')
    .eq('tenant_id', tenantId)
    .gte('date_facture', `${annee}-01-01`)
    .lte('date_facture', `${annee}-12-31`)
    .neq('statut', 'brouillon')
    .order('numero', { ascending: true });

  if (facturesEmises && facturesEmises.length > 1) {
    const numeros = facturesEmises
      .map(f => parseInt(f.numero?.replace(/\D/g, '') || '0'))
      .filter(n => n > 0)
      .sort((a, b) => a - b);

    for (let i = 1; i < numeros.length; i++) {
      if (numeros[i] - numeros[i - 1] > 1) {
        warnings.push(`Trou de numérotation factures détecté entre ${numeros[i - 1]} et ${numeros[i]}`);
        break;
      }
    }
  }

  // Vérifier factures impayées (créances douteuses)
  const { data: facturesImpayees } = await supabase
    .from('factures')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('date_facture', `${annee}-01-01`)
    .lte('date_facture', `${annee}-12-31`)
    .in('statut', ['generee', 'envoyee']);

  if (facturesImpayees && facturesImpayees.length > 0) {
    warnings.push(`${facturesImpayees.length} facture(s) impayée(s) sur ${annee} — vérifier provisions créances douteuses`);
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    stats: {
      nb_ecritures: ecritures?.length || 0,
      nb_non_lettrees: nonLettrees?.length || 0,
      nb_periodes_ouvertes: periodesOuvertes?.length || 0
    }
  };
}

/**
 * Clôturer un exercice — verrouille, calcule résultat, écriture OD, crée N+1, génère AN
 */
export async function cloturerExercice(tenantId, exerciceId, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: exercice } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId)
    .single();

  if (!exercice) throw new Error('Exercice introuvable');
  if (exercice.statut === 'cloture') throw new Error('Exercice déjà clôturé');

  const annee = new Date(exercice.date_debut).getFullYear();
  const dateFinExercice = exercice.date_fin;

  // 1. Pré-vérification (écritures équilibrées)
  const verif = await verifierPreCloture(tenantId, exerciceId);
  if (!verif.ok) {
    throw new Error(`Impossible de clôturer : ${verif.errors.join(', ')}`);
  }

  // 2. Verrouiller toutes les périodes
  await supabase
    .from('periodes_comptables')
    .update({
      verrouillee: true,
      date_verrouillage: new Date().toISOString(),
      verrouille_par: adminId
    })
    .eq('tenant_id', tenantId)
    .eq('exercice_id', exerciceId)
    .eq('verrouillee', false);

  // 3. Calculer résultat (produits classe 7 - charges classe 6)
  const resultat = await calculerResultat(tenantId, annee);

  // 4. Écriture OD de clôture (890/120 ou 890/129)
  if (resultat.montant !== 0) {
    const ecritureResultat = [];
    if (resultat.type === 'benefice') {
      ecritureResultat.push({
        tenant_id: tenantId,
        journal_code: 'OD',
        date_ecriture: dateFinExercice,
        numero_piece: `CLOTURE-${annee}`,
        compte_numero: '120',
        compte_libelle: 'Résultat de l\'exercice (bénéfice)',
        libelle: `Affectation résultat exercice ${annee}`,
        debit: 0,
        credit: resultat.montant,
        periode: `${annee}-12`,
        exercice: annee
      });
      ecritureResultat.push({
        tenant_id: tenantId,
        journal_code: 'OD',
        date_ecriture: dateFinExercice,
        numero_piece: `CLOTURE-${annee}`,
        compte_numero: '890',
        compte_libelle: 'Bilan d\'ouverture / de clôture',
        libelle: `Solde de clôture exercice ${annee}`,
        debit: resultat.montant,
        credit: 0,
        periode: `${annee}-12`,
        exercice: annee
      });
    } else {
      ecritureResultat.push({
        tenant_id: tenantId,
        journal_code: 'OD',
        date_ecriture: dateFinExercice,
        numero_piece: `CLOTURE-${annee}`,
        compte_numero: '129',
        compte_libelle: 'Résultat de l\'exercice (perte)',
        libelle: `Affectation résultat exercice ${annee}`,
        debit: Math.abs(resultat.montant),
        credit: 0,
        periode: `${annee}-12`,
        exercice: annee
      });
      ecritureResultat.push({
        tenant_id: tenantId,
        journal_code: 'OD',
        date_ecriture: dateFinExercice,
        numero_piece: `CLOTURE-${annee}`,
        compte_numero: '890',
        compte_libelle: 'Bilan d\'ouverture / de clôture',
        libelle: `Solde de clôture exercice ${annee}`,
        debit: 0,
        credit: Math.abs(resultat.montant),
        periode: `${annee}-12`,
        exercice: annee
      });
    }

    await supabase
      .from('ecritures_comptables')
      .insert(ecritureResultat);
  }

  // 5. Mettre à jour exercice → clôturé
  const { data: updated, error } = await supabase
    .from('exercices_comptables')
    .update({
      statut: 'cloture',
      date_cloture: new Date().toISOString(),
      cloture_par: adminId,
      resultat_net: resultat.montant,
      resultat_type: resultat.type,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId)
    .select()
    .single();

  if (error) throw error;

  // 6. Créer exercice N+1 s'il n'existe pas
  const nextYear = annee + 1;
  const nextCode = `EX-${nextYear}`;
  let exerciceSuivant = null;

  const { data: existant } = await supabase
    .from('exercices_comptables')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', nextCode)
    .maybeSingle();

  if (!existant) {
    try {
      const result = await createExercice(tenantId, {
        date_debut: `${nextYear}-01-01`,
        date_fin: `${nextYear}-12-31`,
        code: nextCode
      });
      exerciceSuivant = result.exercice;
    } catch (err) {
      console.error('[EXERCICE] Erreur création exercice suivant:', err.message);
    }
  } else {
    // Récupérer l'exercice suivant existant pour le retourner
    const { data: suivant } = await supabase
      .from('exercices_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', existant.id)
      .single();
    exerciceSuivant = suivant;
  }

  // 7. Supprimer les anciens AN de N+1 (idempotent) puis regénérer
  await supabase
    .from('ecritures_comptables')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'AN')
    .eq('exercice', nextYear);

  const anResult = await genererANouveaux(tenantId, annee, nextYear);

  // Marquer AN comme générés
  await supabase
    .from('exercices_comptables')
    .update({ an_generes: true })
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId);

  return {
    success: true,
    exercice: updated,
    resultat: {
      montant_centimes: resultat.montant,
      montant_euros: (resultat.montant / 100).toFixed(2),
      type: resultat.type
    },
    exercice_suivant: exerciceSuivant,
    a_nouveaux: anResult
  };
}

/**
 * Rouvrir un exercice clôturé — déverrouille périodes, supprime écriture OD, remet statut ouvert
 */
export async function rouvrirExercice(tenantId, exerciceId, adminId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: exercice } = await supabase
    .from('exercices_comptables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId)
    .single();

  if (!exercice) throw new Error('Exercice introuvable');
  if (exercice.statut !== 'cloture') throw new Error('Seul un exercice clôturé peut être rouvert');

  const annee = new Date(exercice.date_debut).getFullYear();

  // 1. Déverrouiller toutes les périodes
  await supabase
    .from('periodes_comptables')
    .update({
      verrouillee: false,
      date_verrouillage: null,
      verrouille_par: null
    })
    .eq('tenant_id', tenantId)
    .eq('exercice_id', exerciceId);

  // 2. Supprimer l'écriture OD de clôture (CLOTURE-{annee})
  await supabase
    .from('ecritures_comptables')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('numero_piece', `CLOTURE-${annee}`)
    .eq('exercice', annee);

  // 3. Remettre statut ouvert + reset résultat
  const { data: updated, error } = await supabase
    .from('exercices_comptables')
    .update({
      statut: 'ouvert',
      date_cloture: null,
      cloture_par: null,
      resultat_net: null,
      resultat_type: null,
      an_generes: false,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', exerciceId)
    .select()
    .single();

  if (error) throw error;

  // Note: on ne touche PAS aux AN de N+1 — ils seront écrasés à la re-clôture

  return {
    success: true,
    exercice: updated
  };
}

// ─── Helpers internes ───

/**
 * Calcule le résultat net (produits - charges) en centimes
 */
async function calculerResultat(tenantId, annee) {
  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('compte_numero, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('exercice', annee);

  let produits = 0; // classe 7 — solde créditeur
  let charges = 0;  // classe 6 — solde débiteur

  (ecritures || []).forEach(e => {
    const classe = e.compte_numero?.charAt(0);
    if (classe === '7') {
      produits += (e.credit || 0) - (e.debit || 0);
    } else if (classe === '6') {
      charges += (e.debit || 0) - (e.credit || 0);
    }
  });

  const montant = produits - charges; // positif = bénéfice
  return {
    montant, // centimes
    type: montant >= 0 ? 'benefice' : 'perte',
    produits,
    charges
  };
}

/**
 * Génère les à-nouveaux pour le nouvel exercice (comptes bilan classes 1-5)
 * Note: les anciens AN doivent être supprimés AVANT d'appeler cette fonction
 */
async function genererANouveaux(tenantId, exercicePrecedent, nouvelExercice) {
  const dateAN = `${nouvelExercice}-01-01`;
  const periodeAN = `${nouvelExercice}-01`;

  // Agréger par compte
  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('compte_numero, compte_libelle, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('exercice', exercicePrecedent);

  const comptes = {};
  (ecritures || []).forEach(e => {
    if (!comptes[e.compte_numero]) {
      comptes[e.compte_numero] = { numero: e.compte_numero, libelle: e.compte_libelle, debit: 0, credit: 0 };
    }
    comptes[e.compte_numero].debit += e.debit || 0;
    comptes[e.compte_numero].credit += e.credit || 0;
  });

  const soldes = Object.values(comptes)
    .map(c => ({ ...c, solde: c.debit - c.credit }))
    .filter(c => c.solde !== 0);

  // Comptes bilan (classes 1-5)
  const comptesBilan = soldes.filter(c => ['1', '2', '3', '4', '5'].includes(c.numero.charAt(0)));

  const ecrituresAN = comptesBilan.map(c => ({
    tenant_id: tenantId,
    journal_code: 'AN',
    date_ecriture: dateAN,
    numero_piece: `AN-${nouvelExercice}`,
    compte_numero: c.numero,
    compte_libelle: c.libelle,
    libelle: `À nouveau ${c.libelle}`,
    debit: c.solde > 0 ? c.solde : 0,
    credit: c.solde < 0 ? Math.abs(c.solde) : 0,
    periode: periodeAN,
    exercice: nouvelExercice
  }));

  // Résultat → 120 (bénéfice) ou 129 (perte)
  const comptesResultat = soldes.filter(c => ['6', '7'].includes(c.numero.charAt(0)));
  let resultat = 0;
  comptesResultat.forEach(c => {
    if (c.numero.charAt(0) === '7') {
      resultat += (c.credit - c.debit);
    } else {
      resultat -= (c.debit - c.credit);
    }
  });

  // Vérifier équilibre et ajuster
  const totalDebit = ecrituresAN.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ecrituresAN.reduce((s, e) => s + e.credit, 0);

  if (totalDebit !== totalCredit) {
    const diff = totalDebit - totalCredit;
    if (diff > 0) {
      ecrituresAN.push({
        tenant_id: tenantId,
        journal_code: 'AN',
        date_ecriture: dateAN,
        numero_piece: `AN-${nouvelExercice}`,
        compte_numero: '120',
        compte_libelle: 'Report à nouveau (bénéfice)',
        libelle: `Résultat exercice ${exercicePrecedent}`,
        debit: 0,
        credit: diff,
        periode: periodeAN,
        exercice: nouvelExercice
      });
    } else {
      ecrituresAN.push({
        tenant_id: tenantId,
        journal_code: 'AN',
        date_ecriture: dateAN,
        numero_piece: `AN-${nouvelExercice}`,
        compte_numero: '129',
        compte_libelle: 'Report à nouveau (perte)',
        libelle: `Résultat exercice ${exercicePrecedent}`,
        debit: Math.abs(diff),
        credit: 0,
        periode: periodeAN,
        exercice: nouvelExercice
      });
    }
  }

  if (ecrituresAN.length > 0) {
    const { error } = await supabase
      .from('ecritures_comptables')
      .insert(ecrituresAN);

    if (error) throw error;
  }

  return { nb_ecritures: ecrituresAN.length, resultat_euros: (resultat / 100).toFixed(2) };
}

export default {
  createExercice,
  getOuCreerExerciceCourant,
  listExercices,
  getExerciceOuvert,
  isPeriodeVerrouillee,
  verrouillerPeriode,
  deverrouillerPeriode,
  listPeriodes,
  verifierPreCloture,
  cloturerExercice,
  rouvrirExercice
};
