import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TAUX_COTISATIONS = {
  maladie_employeur: 13.00,
  vieillesse_plafonnee_employeur: 8.55,
  vieillesse_plafonnee_salarie: 6.90,
  vieillesse_deplafonnee_employeur: 2.02,
  vieillesse_deplafonnee_salarie: 0.40,
  allocations_familiales: 5.25,
  accidents_travail: 2.00,
  chomage_employeur: 4.05,
  ags: 0.15,
  retraite_t1_employeur: 4.72,
  retraite_t1_salarie: 3.15,
  ceg_t1_employeur: 1.29,
  ceg_t1_salarie: 0.86,
  csg_deductible: 6.80,
  csg_non_deductible: 2.40,
  crds: 0.50,
  plafond_ss_mensuel: 394100
};

async function genererPaie(tenantId, periode) {
  console.log(`\n💰 Génération paie ${periode} pour ${tenantId}\n`);

  const [year, month] = periode.split('-');
  const dateDepense = `${year}-${month}-01`;
  const dateEcriture = `${year}-${month}-28`;
  const exercice = parseInt(year);

  // Récupérer les membres actifs
  const { data: membres, error: membreErr } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  if (membreErr) {
    console.error('Erreur récup membres:', membreErr);
    return;
  }

  if (!membres || membres.length === 0) {
    console.log('Aucun employé actif');
    return;
  }

  console.log(`👥 ${membres.length} employé(s) actif(s)`);

  let totalSalairesNets = 0;
  let totalCotisationsPatronales = 0;
  let totalCotisationsSalariales = 0;
  const detailParMembre = [];

  for (const membre of membres) {
    const salaireBrut = membre.salaire_mensuel || 0;
    if (salaireBrut === 0) continue;

    const plafondSS = TAUX_COTISATIONS.plafond_ss_mensuel;
    const tranche1 = Math.min(salaireBrut, plafondSS);

    const cotisPatronales = Math.round(
      salaireBrut * (TAUX_COTISATIONS.maladie_employeur +
                   TAUX_COTISATIONS.vieillesse_deplafonnee_employeur +
                   TAUX_COTISATIONS.allocations_familiales +
                   TAUX_COTISATIONS.accidents_travail +
                   TAUX_COTISATIONS.chomage_employeur +
                   TAUX_COTISATIONS.ags) / 100 +
      tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_employeur +
                  TAUX_COTISATIONS.retraite_t1_employeur +
                  TAUX_COTISATIONS.ceg_t1_employeur) / 100
    );

    const cotisSalariales = Math.round(
      salaireBrut * (TAUX_COTISATIONS.vieillesse_deplafonnee_salarie) / 100 +
      tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_salarie +
                  TAUX_COTISATIONS.retraite_t1_salarie +
                  TAUX_COTISATIONS.ceg_t1_salarie) / 100 +
      salaireBrut * 0.9825 * (TAUX_COTISATIONS.csg_deductible +
                            TAUX_COTISATIONS.csg_non_deductible +
                            TAUX_COTISATIONS.crds) / 100
    );

    const salaireNet = salaireBrut - cotisSalariales;

    totalSalairesNets += salaireNet;
    totalCotisationsPatronales += cotisPatronales;
    totalCotisationsSalariales += cotisSalariales;

    detailParMembre.push({
      membre_id: membre.id,
      nom: `${membre.prenom} ${membre.nom}`,
      brut: salaireBrut,
      cotisations_salariales: cotisSalariales,
      cotisations_patronales: cotisPatronales,
      net: salaireNet
    });

    console.log(`  ${membre.prenom} ${membre.nom}: Brut ${(salaireBrut/100).toFixed(2)}€ → Net ${(salaireNet/100).toFixed(2)}€`);
  }

  const totalCotisations = totalCotisationsPatronales + totalCotisationsSalariales;

  // Créer dépense salaires
  const { data: depSalaires, error: errSal } = await supabase
    .from('depenses')
    .insert({
      tenant_id: tenantId,
      categorie: 'salaires',
      libelle: `Salaires nets - ${month}/${year}`,
      description: `Paie du mois de ${month}/${year} - ${membres.length} salarié(s)`,
      montant: totalSalairesNets,
      montant_ttc: totalSalairesNets,
      taux_tva: 0,
      deductible_tva: false,
      date_depense: dateDepense,
      recurrence: 'ponctuelle',
      payee: false
    })
    .select()
    .single();

  if (errSal) {
    console.error('Erreur dépense salaires:', errSal);
    return;
  }

  // Créer dépense cotisations
  const { data: depCotis, error: errCot } = await supabase
    .from('depenses')
    .insert({
      tenant_id: tenantId,
      categorie: 'cotisations_sociales',
      libelle: `Cotisations sociales - ${month}/${year}`,
      description: `Charges sociales: ${(totalCotisationsPatronales/100).toFixed(2)}€ patron + ${(totalCotisationsSalariales/100).toFixed(2)}€ salarié`,
      montant: totalCotisations,
      montant_ttc: totalCotisations,
      taux_tva: 0,
      deductible_tva: false,
      date_depense: dateDepense,
      recurrence: 'ponctuelle',
      payee: false
    })
    .select()
    .single();

  if (errCot) {
    console.error('Erreur dépense cotisations:', errCot);
    return;
  }

  // Créer journal de paie
  const { data: journal, error: errJournal } = await supabase
    .from('rh_journal_paie')
    .upsert({
      tenant_id: tenantId,
      periode,
      total_brut: detailParMembre.reduce((s, m) => s + m.brut, 0),
      total_net: totalSalairesNets,
      total_cotisations_patronales: totalCotisationsPatronales,
      total_cotisations_salariales: totalCotisationsSalariales,
      nb_salaries: detailParMembre.length,
      detail: detailParMembre,
      depense_salaires_id: depSalaires.id,
      depense_cotisations_id: depCotis.id
    }, {
      onConflict: 'tenant_id,periode'
    })
    .select()
    .single();

  if (errJournal) {
    console.error('Erreur journal paie:', errJournal);
    return;
  }

  // Générer écritures comptables PA
  const brutTotal = detailParMembre.reduce((s, m) => s + m.brut, 0);

  // Supprimer anciennes écritures PA pour cette période
  await supabase
    .from('ecritures_comptables')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'PA')
    .eq('periode', periode);

  const ecrituresPA = [
    {
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '641',
      compte_libelle: 'Rémunérations personnel',
      libelle: `Salaires bruts ${periode}`,
      debit: brutTotal,
      credit: 0,
      paie_journal_id: journal?.id,
      periode,
      exercice
    },
    {
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '645',
      compte_libelle: 'Charges sociales',
      libelle: `Cotisations patronales ${periode}`,
      debit: totalCotisationsPatronales,
      credit: 0,
      paie_journal_id: journal?.id,
      periode,
      exercice
    },
    {
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '421',
      compte_libelle: 'Personnel - Rémunérations dues',
      libelle: `Salaires nets à payer ${periode}`,
      debit: 0,
      credit: totalSalairesNets,
      paie_journal_id: journal?.id,
      periode,
      exercice
    },
    {
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '431',
      compte_libelle: 'Sécurité sociale',
      libelle: `Cotisations sociales ${periode}`,
      debit: 0,
      credit: totalCotisations,
      paie_journal_id: journal?.id,
      periode,
      exercice
    }
  ];

  const { data: ecritures, error: errEcr } = await supabase
    .from('ecritures_comptables')
    .insert(ecrituresPA)
    .select();

  if (errEcr) {
    console.error('Erreur écritures PA:', errEcr);
  }

  console.log(`\n✅ Paie générée avec succès!`);
  console.log(`\n📊 TOTAUX:`);
  console.log(`   Brut total: ${(brutTotal/100).toFixed(2)} €`);
  console.log(`   Net total: ${(totalSalairesNets/100).toFixed(2)} €`);
  console.log(`   Cotisations patronales: ${(totalCotisationsPatronales/100).toFixed(2)} €`);
  console.log(`   Cotisations salariales: ${(totalCotisationsSalariales/100).toFixed(2)} €`);
  console.log(`   Coût total entreprise: ${((brutTotal + totalCotisationsPatronales)/100).toFixed(2)} €`);
  console.log(`\n📝 ${ecritures?.length || 0} écritures comptables créées dans le journal PA`);
}

genererPaie('nexus-test', '2026-02').catch(console.error);
