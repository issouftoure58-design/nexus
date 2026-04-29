/**
 * Setup données DSN réalistes pour test-salon-business
 * 4 salariés : 3 CDI + 1 alternance
 * Bulletins de paie pour décembre 2025 (P25V01) + avril 2026 (P26V01)
 * Puis génération DSN + validation interne + DSN-Val externe
 *
 * Données corrigées après passage DSN-Val officiel v2026.1:
 * - SIREN Luhn-valid (443061841), SIRET (44306184100013)
 * - IBAN mod97-valid (FR7630006000011234567890189)
 * - OPS URSSAF IDF (78861779300013)
 * - Code risque AT coiffure (930DB)
 * - Retraite complémentaire RETA (pas RETC)
 * - Dispositif apprentissage 64 (pas 21)
 * - Fichiers écrits en ISO-8859-1
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TENANT = 'test-salon-business';

// ============================================
// ÉTAPE 1 : Corriger rh_dsn_parametres
// ============================================
async function fixParams() {
  console.log('\n=== ÉTAPE 1 : Correction rh_dsn_parametres ===');
  const { error } = await supabase.from('rh_dsn_parametres')
    .update({
      // SIREN/SIRET Luhn-valid
      siren: '443061841',
      siret: '44306184100013',
      nic: '00013',
      // Coordonnées bancaires valides
      bic: 'BNPAFRPP',
      iban: 'FR7630006000011234567890189',
      // URSSAF Ile-de-France (OPS valide pour DSN-Val)
      urssaf_siret: '78861779300013',
      // Norme et contact
      version_norme: 'P25V01',
      contact_tel: '0143000001',
      // RETA (Agirc-Arrco fusionné) — RETC interdit avec non-cadres
      code_regime_retraite: 'RETA',
      // code_risque_at est sur rh_membres, pas rh_dsn_parametres
      // Adresse sans accents pour sécurité encodage
      adresse_siege: '15 rue de la Beaute',
      adresse_etablissement: '15 rue de la Beaute',
    })
    .eq('tenant_id', TENANT);
  console.log(error ? `  ERREUR: ${error.message}` : '  OK');
}

// ============================================
// ÉTAPE 2 : Corriger les membres RH
// ============================================
async function fixMembres() {
  console.log('\n=== ÉTAPE 2 : Correction rh_membres ===');
  // PAS de complement_pcs ('99' invalide, ce champ est optionnel pour coiffure)
  const common = {
    emplois_multiples: '03',
    employeurs_multiples: '03',
    statut_categoriel: '04',  // non-cadre
    statut_conventionnel: '06', // employé
    regime_at: '200',
    code_risque_at: '930DB',  // coiffure
  };

  const updates = [
    { id: 118, data: { ...common, sexe: '01', nir: '1850375108042', lieu_naissance: 'Paris', quotite_contrat: 151.67, salaire_mensuel: 240000 } },
    { id: 117, data: { ...common, sexe: '02', nir: '2920793008018', lieu_naissance: 'Bobigny', quotite_contrat: 151.67, salaire_mensuel: 220000 } },
    { id: 120, data: { ...common, sexe: '01', nir: '1901194023456', lieu_naissance: 'Creteil', quotite_contrat: 151.67, salaire_mensuel: 210000 } },
    { id: 119, data: {
      ...common,
      sexe: '02',
      nir: '2040575112033',
      lieu_naissance: 'Paris',
      quotite_contrat: 151.67,
      salaire_mensuel: 110000,
      type_contrat: 'apprentissage',
      dispositif_politique: '64',  // contrat d'apprentissage (PAS '21' qui est CUI-CIE)
    } },
  ];

  for (const u of updates) {
    const { error } = await supabase.from('rh_membres').update(u.data).eq('id', u.id);
    console.log(error ? `  ERREUR ${u.id}: ${error.message}` : `  OK — membre ${u.id}`);
  }
}

// ============================================
// ÉTAPE 3 : Créer les bulletins de paie
// ============================================
async function createBulletins(periode) {
  console.log(`\n=== ÉTAPE 3 : Création bulletins ${periode} ===`);
  await supabase.from('rh_bulletins_paie').delete().eq('tenant_id', TENANT).eq('periode', periode);

  const salaries = [
    { membre_id: 118, nom: 'PLANTUS', prenom: 'Marc', nir: '1850375108042', poste: 'Coiffeur senior', salaire_base: 240000, brut_total: 240000, cot_sal: 55200, cot_pat: 103200, net_imposable: 191200, net_social: 185000, taux_ir: 7.50 },
    { membre_id: 117, nom: 'FREGER', prenom: 'Marie', nir: '2920793008018', poste: 'Coiffeuse Coloriste', salaire_base: 220000, brut_total: 220000, cot_sal: 50600, cot_pat: 94600, net_imposable: 175340, net_social: 170000, taux_ir: 5.00 },
    { membre_id: 120, nom: 'FRIPON', prenom: 'Franck', nir: '1901194023456', poste: 'Barbier', salaire_base: 210000, brut_total: 210000, cot_sal: 48300, cot_pat: 90300, net_imposable: 167370, net_social: 162000, taux_ir: 3.50 },
    { membre_id: 119, nom: 'ROSE', prenom: 'Milly', nir: '2040575112033', poste: 'Apprentie coiffeuse', salaire_base: 110000, brut_total: 110000, cot_sal: 0, cot_pat: 0, net_imposable: 0, net_social: 110000, taux_ir: 0 },
  ];

  for (const s of salaries) {
    const montant_ir = Math.round(s.net_imposable * (s.taux_ir / 100));
    const net_a_payer = (s.brut_total - s.cot_sal) - montant_ir;

    const { error } = await supabase.from('rh_bulletins_paie').insert({
      tenant_id: TENANT,
      membre_id: s.membre_id,
      periode,
      employe_nom: s.nom,
      employe_prenom: s.prenom,
      employe_nir: s.nir,
      employe_poste: s.poste,
      type_contrat: s.membre_id === 119 ? 'apprentissage' : 'cdi',
      salaire_base: s.salaire_base,
      heures_normales: 151.67,
      heures_supp_25: 0,
      montant_hs_25: 0,
      heures_supp_50: 0,
      montant_hs_50: 0,
      primes: 0,
      avantages_nature: 0,
      brut_total: s.brut_total,
      cotisations_salariales: JSON.stringify([
        { code: '074', label: 'Maladie', base: s.brut_total, taux_sal: 0, montant_sal: 0 },
        { code: '076', label: 'Vieillesse plafonnee', base: s.brut_total, taux_sal: 6.90, montant_sal: Math.round(s.brut_total * 0.069) },
        { code: '075', label: 'Vieillesse deplafonnee', base: s.brut_total, taux_sal: 0.40, montant_sal: Math.round(s.brut_total * 0.004) },
        { code: '040', label: 'Retraite T1', base: s.brut_total, taux_sal: 3.15, montant_sal: Math.round(s.brut_total * 0.0315) },
        { code: '048', label: 'CEG T1', base: s.brut_total, taux_sal: 0.86, montant_sal: Math.round(s.brut_total * 0.0086) },
        { code: '072', label: 'CSG deductible', base: Math.round(s.brut_total * 0.9825), taux_sal: 6.80, montant_sal: Math.round(s.brut_total * 0.9825 * 0.068) },
        { code: '079', label: 'CRDS + CSG non ded', base: Math.round(s.brut_total * 0.9825), taux_sal: 2.90, montant_sal: Math.round(s.brut_total * 0.9825 * 0.029) },
      ]),
      total_cotisations_salariales: s.cot_sal,
      cotisations_patronales: JSON.stringify([
        { code: '074', label: 'Maladie', base: s.brut_total, taux_pat: 7.00, montant_pat: Math.round(s.brut_total * 0.07) },
        { code: '076', label: 'Vieillesse plafonnee', base: s.brut_total, taux_pat: 8.55, montant_pat: Math.round(s.brut_total * 0.0855) },
        { code: '075', label: 'Vieillesse deplafonnee', base: s.brut_total, taux_pat: 2.02, montant_pat: Math.round(s.brut_total * 0.0202) },
        { code: '100', label: 'Allocations familiales', base: s.brut_total, taux_pat: 3.45, montant_pat: Math.round(s.brut_total * 0.0345) },
        { code: '049', label: 'AT/MP', base: s.brut_total, taux_pat: 1.10, montant_pat: Math.round(s.brut_total * 0.011) },
        { code: '040', label: 'Retraite T1', base: s.brut_total, taux_pat: 4.72, montant_pat: Math.round(s.brut_total * 0.0472) },
        { code: '048', label: 'CEG T1', base: s.brut_total, taux_pat: 1.29, montant_pat: Math.round(s.brut_total * 0.0129) },
        { code: '068', label: 'CSA', base: s.brut_total, taux_pat: 0.30, montant_pat: Math.round(s.brut_total * 0.003) },
        { code: '105', label: 'Dialogue social', base: s.brut_total, taux_pat: 0.016, montant_pat: Math.round(s.brut_total * 0.00016) },
      ]),
      total_cotisations_patronales: s.cot_pat,
      net_avant_ir: s.brut_total - s.cot_sal,
      montant_ir,
      taux_ir: s.taux_ir,
      net_a_payer,
      net_imposable: s.net_imposable,
      net_social: s.net_social,
      statut: 'valide',
    });

    console.log(error ? `  ERREUR ${s.nom}: ${error.message}` : `  OK — ${s.nom} ${s.prenom} (brut: ${(s.brut_total/100).toFixed(2)}€)`);
  }
}

// ============================================
// ÉTAPE 4 : Générer + Valider DSN
// ============================================
async function generateAndValidate(periode) {
  console.log(`\n=== Generation DSN ${periode} ===`);
  const { generateDSN } = await import('../services/dsnGenerator.js');
  const { validerDSN, genererRapport } = await import('../services/dsnValidator.js');

  try {
    const result = await generateDSN(TENANT, periode);
    console.log(`  Fichier: ${result.filename} | Lignes: ${result.stats.lignes} | Individus: ${result.stats.individus}`);

    const outputPath = `/tmp/${result.filename}`;
    // IMPORTANT: écrire en ISO-8859-1 (pas UTF-8) — DSN-Val exige cet encodage
    writeFileSync(outputPath, result.contentISO);
    console.log(`  Ecrit (ISO-8859-1): ${outputPath}`);

    // Valider avec notre validateur interne
    const validation = validerDSN(result.content);
    console.log(genererRapport(validation));

    if (validation.valide) {
      console.log(`  DSN ${periode} VALIDE (interne) — soumettez ${outputPath} a DSN-Val`);
    } else {
      console.log(`  DSN ${periode} — ${validation.erreurs.length} erreurs internes`);
    }
    return { validation, path: outputPath };
  } catch (err) {
    console.error('ERREUR generation:', err.message);
    console.error(err.stack);
  }
}

// ============================================
// EXÉCUTION
// ============================================
await fixParams();
await fixMembres();

// Décembre 2025 — norme P25V01
await createBulletins('2025-12');
await generateAndValidate('2025-12');

// Avril 2026 — norme P26V01
await createBulletins('2026-04');
await generateAndValidate('2026-04');

console.log('\nFichiers DSN dans /tmp/ — soumettez-les a DSN-Val pour verification');
