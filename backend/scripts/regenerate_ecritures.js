import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapping catégories dépenses vers comptes
const COMPTE_DEPENSE = {
  fournitures: { numero: '601', libelle: 'Achats fournitures' },
  loyer: { numero: '613', libelle: 'Loyers' },
  charges: { numero: '606', libelle: 'Électricité/Eau' },
  telecom: { numero: '626', libelle: 'Télécom/Internet' },
  assurance: { numero: '616', libelle: 'Assurances' },
  transport: { numero: '625', libelle: 'Déplacements' },
  marketing: { numero: '623', libelle: 'Publicité' },
  bancaire: { numero: '627', libelle: 'Frais bancaires' },
  formation: { numero: '618', libelle: 'Formation' },
  materiel: { numero: '615', libelle: 'Entretien matériel' },
  logiciel: { numero: '651', libelle: 'Abonnements' },
  comptabilite: { numero: '622', libelle: 'Honoraires' },
  taxes: { numero: '635', libelle: 'Impôts et taxes' },
  salaires: { numero: '641', libelle: 'Rémunérations personnel' },
  cotisations_sociales: { numero: '645', libelle: 'Charges sociales' },
  autre: { numero: '658', libelle: 'Charges diverses' }
};

async function regenerateAll() {
  console.log('🔄 Suppression des anciennes écritures...');

  // Supprimer toutes les écritures existantes
  const { error: delErr } = await supabase
    .from('ecritures_comptables')
    .delete()
    .neq('id', 0);

  if (delErr) {
    console.error('Erreur suppression:', delErr);
  }

  // Récupérer tous les tenants
  const { data: tenants } = await supabase.from('tenants').select('id');

  for (const tenant of tenants || []) {
    const tenantId = tenant.id;
    console.log(`\n📁 Tenant: ${tenantId}`);

    // Récupérer factures
    const { data: factures } = await supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId);

    const nbFactures = factures ? factures.length : 0;
    console.log(`  📄 ${nbFactures} factures`);

    for (const f of factures || []) {
      const ecritures = [];
      const dateFacture = f.date_facture;
      const periode = dateFacture ? dateFacture.slice(0, 7) : '2026-01';
      const exercice = dateFacture ? parseInt(dateFacture.slice(0, 4)) : 2026;
      const montantTTC = f.montant_ttc || 0;
      const montantHT = f.montant_ht || montantTTC;
      const montantTVA = f.montant_tva || 0;

      // Journal VT
      ecritures.push({
        tenant_id: tenantId, journal_code: 'VT', date_ecriture: dateFacture,
        numero_piece: f.numero, compte_numero: '411', compte_libelle: 'Clients',
        libelle: `Facture ${f.numero} - ${f.client_nom || 'Client'}`,
        debit: montantTTC, credit: 0, facture_id: f.id, periode, exercice
      });
      ecritures.push({
        tenant_id: tenantId, journal_code: 'VT', date_ecriture: dateFacture,
        numero_piece: f.numero, compte_numero: '706', compte_libelle: 'Prestations de services',
        libelle: `Facture ${f.numero}`, debit: 0, credit: montantHT,
        facture_id: f.id, periode, exercice
      });
      if (montantTVA > 0) {
        ecritures.push({
          tenant_id: tenantId, journal_code: 'VT', date_ecriture: dateFacture,
          numero_piece: f.numero, compte_numero: '44571', compte_libelle: 'TVA collectée',
          libelle: `TVA ${f.numero}`, debit: 0, credit: montantTVA,
          facture_id: f.id, periode, exercice
        });
      }

      // Si payée -> Journal BQ
      if (f.statut === 'payee') {
        const datePaiement = f.date_paiement ? f.date_paiement.split('T')[0] : dateFacture;
        const periodePaie = datePaiement ? datePaiement.slice(0, 7) : periode;
        ecritures.push({
          tenant_id: tenantId, journal_code: 'BQ', date_ecriture: datePaiement,
          numero_piece: f.numero, compte_numero: '512', compte_libelle: 'Banque',
          libelle: `Encaissement ${f.numero}`, debit: montantTTC, credit: 0,
          facture_id: f.id, periode: periodePaie, exercice
        });
        ecritures.push({
          tenant_id: tenantId, journal_code: 'BQ', date_ecriture: datePaiement,
          numero_piece: f.numero, compte_numero: '411', compte_libelle: 'Clients',
          libelle: `Règlement ${f.numero}`, debit: 0, credit: montantTTC,
          facture_id: f.id, periode: periodePaie, exercice
        });
      }

      if (ecritures.length > 0) {
        await supabase.from('ecritures_comptables').insert(ecritures);
      }
    }

    // Récupérer dépenses
    const { data: depenses } = await supabase
      .from('depenses')
      .select('*')
      .eq('tenant_id', tenantId);

    const nbDepenses = depenses ? depenses.length : 0;
    console.log(`  💸 ${nbDepenses} dépenses`);

    for (const d of depenses || []) {
      const ecritures = [];
      const dateDepense = d.date_depense;
      const periode = dateDepense ? dateDepense.slice(0, 7) : '2026-01';
      const exercice = dateDepense ? parseInt(dateDepense.slice(0, 4)) : 2026;
      const montantTTC = d.montant_ttc || d.montant || 0;
      const montantHT = d.montant || montantTTC;
      const montantTVA = d.montant_tva || 0;
      const compteCharge = COMPTE_DEPENSE[d.categorie] || COMPTE_DEPENSE.autre;

      // Journal AC
      ecritures.push({
        tenant_id: tenantId, journal_code: 'AC', date_ecriture: dateDepense,
        numero_piece: `DEP-${d.id}`, compte_numero: compteCharge.numero,
        compte_libelle: compteCharge.libelle, libelle: d.libelle || d.categorie,
        debit: montantHT, credit: 0, depense_id: d.id, periode, exercice
      });
      if (montantTVA > 0 && d.deductible_tva !== false) {
        ecritures.push({
          tenant_id: tenantId, journal_code: 'AC', date_ecriture: dateDepense,
          numero_piece: `DEP-${d.id}`, compte_numero: '44566',
          compte_libelle: 'TVA déductible', libelle: `TVA ${d.libelle || d.categorie}`,
          debit: montantTVA, credit: 0, depense_id: d.id, periode, exercice
        });
      }
      ecritures.push({
        tenant_id: tenantId, journal_code: 'AC', date_ecriture: dateDepense,
        numero_piece: `DEP-${d.id}`, compte_numero: '401',
        compte_libelle: 'Fournisseurs', libelle: d.libelle || d.categorie,
        debit: 0, credit: montantTTC, depense_id: d.id, periode, exercice
      });

      // Si payée -> Journal BQ
      if (d.payee !== false) {
        const datePaiement = d.date_paiement ? d.date_paiement.split('T')[0] : dateDepense;
        const periodePaie = datePaiement ? datePaiement.slice(0, 7) : periode;
        ecritures.push({
          tenant_id: tenantId, journal_code: 'BQ', date_ecriture: datePaiement,
          numero_piece: `DEP-${d.id}`, compte_numero: '401',
          compte_libelle: 'Fournisseurs', libelle: `Règlement ${d.libelle || d.categorie}`,
          debit: montantTTC, credit: 0, depense_id: d.id, periode: periodePaie, exercice
        });
        ecritures.push({
          tenant_id: tenantId, journal_code: 'BQ', date_ecriture: datePaiement,
          numero_piece: `DEP-${d.id}`, compte_numero: '512',
          compte_libelle: 'Banque', libelle: `Paiement ${d.libelle || d.categorie}`,
          debit: 0, credit: montantTTC, depense_id: d.id, periode: periodePaie, exercice
        });
      }

      if (ecritures.length > 0) {
        await supabase.from('ecritures_comptables').insert(ecritures);
      }
    }
  }

  // Compter les écritures générées
  const { count } = await supabase
    .from('ecritures_comptables')
    .select('*', { count: 'exact', head: true });

  console.log(`\n✅ Régénération terminée: ${count} écritures créées`);
}

regenerateAll().catch(console.error);
