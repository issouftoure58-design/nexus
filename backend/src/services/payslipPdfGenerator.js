/**
 * Generateur de bulletin de paie PDF conforme 2026
 * Respecte les mentions obligatoires Article R3243-1 Code du travail
 * Optimise pour tenir sur 1 page A4
 */

import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase.js';
import { TAUX_2026 } from './payrollEngine.js';

// ============================================
// HELPERS FORMATAGE
// ============================================

function fmt(cents) {
  if (!cents && cents !== 0) return '0,00';
  const e = (cents / 100).toFixed(2).split('.');
  e[0] = e[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return e.join(',');
}

function fmtE(cents) {
  return fmt(cents) + ' \u20AC';
}

function formatPeriode(p) {
  const [y, m] = p.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR');
}

// ============================================
// CHARGEMENT DONNEES COMMUNES
// ============================================

async function loadBulletinData(tenantId, bulletinId) {
  const { data: bulletin, error } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('id', bulletinId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !bulletin) throw new Error('Bulletin non trouve');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single();

  const { data: dsnParams } = await supabase
    .from('rh_dsn_parametres')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employeur = {
    nom: dsnParams?.raison_sociale || tenant?.name || 'Entreprise',
    siret: dsnParams?.siret || '',
    naf: dsnParams?.code_naf || '',
    adresse: [
      dsnParams?.adresse_etablissement || dsnParams?.adresse_siege,
      `${dsnParams?.code_postal_etablissement || dsnParams?.code_postal_siege || ''} ${dsnParams?.ville_etablissement || dsnParams?.ville_siege || ''}`,
    ].filter(Boolean).join(', '),
    idcc: dsnParams?.idcc || '',
    convention: dsnParams?.convention_nom || '',
    urssaf: dsnParams?.urssaf_code || '',
  };

  // Charger le matricule (id membre) depuis rh_membres
  let matricule = '';
  if (bulletin.membre_id) {
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('id', bulletin.membre_id)
      .eq('tenant_id', tenantId)
      .single();
    if (membre) matricule = String(membre.id).padStart(5, '0');
  }

  const salarie = {
    nom: `${bulletin.employe_prenom || ''} ${bulletin.employe_nom || ''}`.trim(),
    nir: bulletin.employe_nir ? bulletin.employe_nir.slice(0, 13) : '-',
    poste: bulletin.employe_poste || '-',
    classification: bulletin.employe_classification || '-',
    contrat: (bulletin.type_contrat || 'CDI').toUpperCase(),
    dateEmbauche: bulletin.date_embauche,
    anciennete: bulletin.anciennete_mois || 0,
    adresse: bulletin.employe_adresse || '',
    matricule,
  };

  return { bulletin, employeur, salarie };
}

// ============================================
// GENERATION PDF
// ============================================

function buildPDF(doc, bulletin, employeur, salarie) {
  const W = doc.page.width - 70;
  const L = 35;
  let y = 28;

  // === 1. TITRE ===
  doc.font('Helvetica-Bold').fontSize(13);
  doc.text('BULLETIN DE PAIE', L, y, { width: W, align: 'center' });
  y += 24;

  // === 2. EN-TETE EMPLOYEUR / SALARIE ===
  y = renderHeader(doc, L, W, y, employeur, salarie, bulletin.periode);
  y += 8;

  // === 3. ELEMENTS BRUT ===
  y = renderSalaryElements(doc, L, W, y, bulletin);
  y += 6;

  // === 4. COTISATIONS ===
  y = renderCotisationsTable(doc, L, W, y, bulletin);
  y += 6;

  // === 5. NETS ===
  y = renderNetSection(doc, L, W, y, bulletin);
  y += 6;

  // === 6. CUMULS + CONGES ===
  y = renderCumuls(doc, L, W, y, bulletin);
  y += 6;

  // === 7. PIED DE PAGE ===
  renderFooter(doc, L, W, y, bulletin, employeur);
}

/**
 * Genere un bulletin de paie PDF complet
 * @returns {Buffer} PDF buffer
 */
export async function generatePayslipPDF(tenantId, bulletinId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!bulletinId) throw new Error('bulletinId requis');

  const { bulletin, employeur, salarie } = await loadBulletinData(tenantId, bulletinId);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 35 });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    buildPDF(doc, bulletin, employeur, salarie);
    doc.end();
  });
}

/**
 * Genere le PDF et le pipe directement dans la reponse HTTP
 */
export async function streamPayslipPDF(tenantId, bulletinId, res) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!bulletinId) throw new Error('bulletinId requis');

  const { bulletin, employeur, salarie } = await loadBulletinData(tenantId, bulletinId);

  const filename = `bulletin_${bulletin.employe_nom}_${bulletin.employe_prenom}_${bulletin.periode}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 35 });
  doc.pipe(res);

  buildPDF(doc, bulletin, employeur, salarie);
  doc.end();
}

// ============================================
// SECTIONS DE RENDU (optimisees 1 page)
// ============================================

function renderHeader(doc, L, W, y, employeur, salarie, periode) {
  const halfW = W / 2 - 8;
  const boxH = 99;

  // Employeur (gauche)
  doc.rect(L, y, halfW, boxH).stroke('#ccc');
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('EMPLOYEUR', L + 6, y + 5);
  doc.font('Helvetica').fontSize(7.5);
  doc.text(employeur.nom, L + 6, y + 18, { width: halfW - 12 });
  if (employeur.siret) doc.text(`SIRET: ${employeur.siret}`, L + 6, y + 30);
  if (employeur.naf) doc.text(`Code NAF: ${employeur.naf}`, L + 6, y + 41);
  if (employeur.adresse) doc.text(employeur.adresse, L + 6, y + 52, { width: halfW - 12 });
  if (employeur.idcc) doc.text(`Convention: IDCC ${employeur.idcc}`, L + 6, y + 66, { width: halfW - 12 });
  if (employeur.urssaf) doc.text(`URSSAF: ${employeur.urssaf}`, L + 6, y + 77);

  // Salarie (droite)
  const R = L + halfW + 16;
  doc.rect(R, y, halfW, boxH).stroke('#ccc');
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('SALARIE(E)', R + 6, y + 5);
  doc.font('Helvetica').fontSize(7.5);
  doc.text(salarie.nom, R + 6, y + 18, { width: halfW - 12 });
  if (salarie.matricule) doc.text(`Matricule: ${salarie.matricule}`, R + halfW / 2, y + 18, { width: halfW / 2 - 12 });
  doc.text(`N\u00B0 SS: ${salarie.nir}`, R + 6, y + 30);
  doc.text(`Emploi: ${salarie.poste}`, R + 6, y + 41);
  doc.text(`Classification: ${salarie.classification}`, R + 6, y + 52);
  doc.text(`Contrat: ${salarie.contrat}`, R + 6, y + 63);
  if (salarie.dateEmbauche) doc.text(`Entree: ${formatDate(salarie.dateEmbauche)} (${salarie.anciennete} mois)`, R + 6, y + 74);
  if (salarie.adresse) doc.text(salarie.adresse, R + 6, y + 85, { width: halfW - 12 });

  y += boxH + 5;

  // Bandeau periode
  doc.rect(L, y, W, 20).fill('#f0f4f8').stroke('#d0d5dd');
  doc.fill('#000').font('Helvetica-Bold').fontSize(10);
  doc.text(`Periode: ${formatPeriode(periode).toUpperCase()}`, L + 8, y + 5, { width: W - 16, align: 'center' });
  y += 20;

  return y;
}

function renderSalaryElements(doc, L, W, y, bulletin) {
  // En-tete section
  doc.rect(L, y, W, 16).fill('#e5e7eb').stroke('#d1d5db');
  doc.fill('#000').font('Helvetica-Bold').fontSize(7.5);
  doc.text('REMUNERATION', L + 6, y + 4);
  doc.text('Quantite', L + 250, y + 4, { width: 55, align: 'right' });
  doc.text('Taux', L + 310, y + 4, { width: 50, align: 'right' });
  doc.text('Montant', L + 365, y + 4, { width: 65, align: 'right' });
  y += 16;

  doc.font('Helvetica').fontSize(7.5);

  // Salaire de base
  doc.text('Salaire de base', L + 6, y + 4);
  doc.text(`${bulletin.heures_normales || 151.67} h`, L + 250, y + 4, { width: 55, align: 'right' });
  doc.text(fmtE(Math.round((bulletin.salaire_base || 0) / (bulletin.heures_normales || 151.67))), L + 310, y + 4, { width: 50, align: 'right' });
  doc.text(fmtE(bulletin.salaire_base), L + 365, y + 4, { width: 65, align: 'right' });
  y += 14;

  // HS 25%
  if (bulletin.heures_supp_25 > 0) {
    doc.text('Heures supplementaires 25%', L + 6, y + 4);
    doc.text(`${bulletin.heures_supp_25} h`, L + 250, y + 4, { width: 55, align: 'right' });
    doc.text('125%', L + 310, y + 4, { width: 50, align: 'right' });
    doc.text(fmtE(bulletin.montant_hs_25), L + 365, y + 4, { width: 65, align: 'right' });
    y += 14;
  }

  // HS 50%
  if (bulletin.heures_supp_50 > 0) {
    doc.text('Heures supplementaires 50%', L + 6, y + 4);
    doc.text(`${bulletin.heures_supp_50} h`, L + 250, y + 4, { width: 55, align: 'right' });
    doc.text('150%', L + 310, y + 4, { width: 50, align: 'right' });
    doc.text(fmtE(bulletin.montant_hs_50), L + 365, y + 4, { width: 65, align: 'right' });
    y += 14;
  }

  // Primes
  if (bulletin.primes && Array.isArray(bulletin.primes)) {
    for (const prime of bulletin.primes) {
      if (prime.montant > 0) {
        doc.text(prime.nom || prime.code || 'Prime', L + 6, y + 4);
        doc.text(fmtE(prime.montant), L + 365, y + 4, { width: 65, align: 'right' });
        y += 14;
      }
    }
  }

  // Total brut
  y += 3;
  doc.rect(L, y, W, 17).fill('#dcfce7').stroke('#22c55e');
  doc.fill('#000').font('Helvetica-Bold').fontSize(8.5);
  doc.text('SALAIRE BRUT', L + 6, y + 4);
  doc.text(fmtE(bulletin.brut_total), L + 365, y + 4, { width: 65, align: 'right' });
  y += 17;

  return y;
}

function renderCotisationsTable(doc, L, W, y, bulletin) {
  // En-tete
  doc.rect(L, y, W, 16).fill('#e5e7eb').stroke('#d1d5db');
  doc.fill('#000').font('Helvetica-Bold').fontSize(7);
  doc.text('COTISATIONS ET CONTRIBUTIONS', L + 6, y + 4);
  doc.text('Base', L + 215, y + 4, { width: 55, align: 'right' });
  doc.text('Tx S.', L + 273, y + 4, { width: 35, align: 'right' });
  doc.text('Salarie', L + 310, y + 4, { width: 52, align: 'right' });
  doc.text('Tx P.', L + 365, y + 4, { width: 35, align: 'right' });
  doc.text('Employeur', L + 403, y + 4, { width: 55, align: 'right' });
  y += 16;

  const brut = bulletin.brut_total || 0;
  const pmss = TAUX_2026.pmss;
  const basePlaf = Math.min(brut, pmss);
  const tranche2 = Math.max(0, brut - pmss);
  const baseCSG = Math.round(brut * 0.9825);

  // Cotisations groupees par section
  const sections = [
    { label: 'SANTE', items: [
      { nom: 'Maladie, maternite, invalidite, deces', base: brut, txS: 0, txP: TAUX_2026.patronales.maladie.taux },
      { nom: 'Accidents du travail - Maladies prof.', base: brut, txS: 0, txP: TAUX_2026.patronales.accidents_travail.taux },
    ]},
    { label: 'RETRAITE', items: [
      { nom: 'Vieillesse plafonnee', base: basePlaf, txS: TAUX_2026.salariales.vieillesse_plafonnee.taux, txP: TAUX_2026.patronales.vieillesse_plafonnee.taux },
      { nom: 'Vieillesse deplafonnee', base: brut, txS: TAUX_2026.salariales.vieillesse_deplafonnee.taux, txP: TAUX_2026.patronales.vieillesse_deplafonnee.taux },
      { nom: 'Complementaire T1 (AGIRC-ARRCO)', base: basePlaf, txS: TAUX_2026.salariales.retraite_t1.taux, txP: TAUX_2026.patronales.retraite_t1.taux },
      ...(tranche2 > 0 ? [{ nom: 'Complementaire T2 (AGIRC-ARRCO)', base: tranche2, txS: TAUX_2026.salariales.retraite_t2.taux, txP: TAUX_2026.patronales.retraite_t2.taux }] : []),
      { nom: 'CEG T1', base: basePlaf, txS: TAUX_2026.salariales.ceg_t1.taux, txP: TAUX_2026.patronales.ceg_t1.taux },
      ...(tranche2 > 0 ? [{ nom: 'CEG T2', base: tranche2, txS: TAUX_2026.salariales.ceg_t2.taux, txP: TAUX_2026.patronales.ceg_t2.taux }] : []),
      { nom: 'CET (equilibre technique)', base: brut, txS: TAUX_2026.salariales.cet.taux, txP: TAUX_2026.patronales.cet.taux },
    ]},
    { label: 'FAMILLE', items: [
      { nom: 'Allocations familiales', base: brut, txS: 0, txP: TAUX_2026.patronales.allocations_familiales.taux },
    ]},
    { label: 'ASSURANCE CHOMAGE', items: [
      { nom: 'Assurance chomage', base: basePlaf, txS: 0, txP: TAUX_2026.patronales.chomage.taux },
      { nom: 'AGS (garantie des salaires)', base: basePlaf, txS: 0, txP: TAUX_2026.patronales.ags.taux },
    ]},
    { label: 'CSG / CRDS', items: [
      { nom: 'CSG deductible de l\'impot sur le revenu', base: baseCSG, txS: TAUX_2026.salariales.csg_deductible.taux, txP: 0 },
      { nom: 'CSG non deductible + CRDS', base: baseCSG, txS: TAUX_2026.salariales.csg_non_deductible.taux + TAUX_2026.salariales.crds.taux, txP: 0 },
    ]},
    { label: 'AUTRES CONTRIBUTIONS', items: [
      { nom: 'FNAL', base: basePlaf, txS: 0, txP: TAUX_2026.patronales.fnal.taux },
      { nom: 'CSA / Formation / Taxe apprentissage', base: brut, txS: 0, txP: TAUX_2026.patronales.csa.taux + TAUX_2026.patronales.formation.taux + TAUX_2026.patronales.taxe_apprentissage.taux },
    ]},
  ];

  let totalS = 0, totalP = 0;
  const lineH = 11;

  for (const section of sections) {
    // Section header
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#374151');
    doc.text(section.label, L + 6, y + 2);
    y += 10;

    doc.font('Helvetica').fontSize(7).fillColor('#000');
    for (const item of section.items) {
      const mS = Math.round(item.base * item.txS / 100);
      const mP = Math.round(item.base * item.txP / 100);
      totalS += mS;
      totalP += mP;

      doc.text(item.nom, L + 12, y + 2, { width: 200 });
      doc.text(fmt(item.base), L + 215, y + 2, { width: 55, align: 'right' });
      doc.text(item.txS > 0 ? `${item.txS}%` : '-', L + 273, y + 2, { width: 35, align: 'right' });
      doc.text(mS > 0 ? fmt(mS) : '-', L + 310, y + 2, { width: 52, align: 'right' });
      doc.text(item.txP > 0 ? `${Number(item.txP.toFixed(3))}%` : '-', L + 365, y + 2, { width: 35, align: 'right' });
      doc.text(mP > 0 ? fmt(mP) : '-', L + 403, y + 2, { width: 55, align: 'right' });
      y += lineH;
    }
  }

  // Reduction Fillon
  const fillon = bulletin.reduction_fillon || 0;
  if (fillon > 0) {
    y += 2;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#059669');
    doc.text('Reduction generale (ex-Fillon)', L + 6, y + 2);
    doc.text(`-${fmt(fillon)}`, L + 403, y + 2, { width: 55, align: 'right' });
    totalP -= fillon;
    y += lineH;
    doc.fillColor('#000');
  }

  // Total cotisations
  y += 3;
  doc.rect(L, y, W, 16).fill('#fee2e2').stroke('#ef4444');
  doc.fill('#000').font('Helvetica-Bold').fontSize(8);
  doc.text('TOTAL COTISATIONS', L + 6, y + 3);
  doc.text(fmtE(totalS), L + 310, y + 3, { width: 52, align: 'right' });
  doc.text(fmtE(totalP), L + 403, y + 3, { width: 55, align: 'right' });
  y += 16;

  return y;
}

function renderNetSection(doc, L, W, y, bulletin) {
  const brut = bulletin.brut_total || 0;
  const totalS = bulletin.total_cotisations_salariales || 0;
  const netSocial = bulletin.net_social || (brut - totalS);
  const netImposable = bulletin.net_imposable || netSocial;
  const tauxIR = bulletin.taux_ir || 0;
  const montantIR = bulletin.montant_ir || 0;
  const netAPayer = bulletin.net_a_payer || (netSocial - montantIR);

  // Net social
  doc.rect(L, y, W, 18).fill('#dbeafe').stroke('#3b82f6');
  doc.fill('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('MONTANT NET SOCIAL', L + 6, y + 4);
  doc.text(fmtE(netSocial), L + 370, y + 4, { width: 100, align: 'right' });
  y += 22;

  // Net imposable + PAS
  doc.font('Helvetica').fontSize(7.5);
  doc.text(`Net imposable: ${fmtE(netImposable)}`, L + 6, y);
  y += 12;
  doc.text(`Prelevement a la source (taux: ${tauxIR}%)`, L + 6, y);
  doc.text(montantIR > 0 ? `- ${fmtE(montantIR)}` : '-', L + 370, y, { width: 100, align: 'right' });
  y += 16;

  // NET A PAYER
  doc.rect(L, y, W, 24).fill('#16a34a').stroke('#16a34a');
  doc.fill('#fff').font('Helvetica-Bold').fontSize(13);
  doc.text('NET A PAYER', L + 8, y + 5);
  doc.text(fmtE(netAPayer), L + 350, y + 5, { width: 120, align: 'right' });
  y += 24;

  // Cout employeur
  y += 4;
  const totalP = bulletin.total_cotisations_patronales || 0;
  const coutTotal = brut + totalP - (bulletin.reduction_fillon || 0);
  doc.fill('#000').font('Helvetica').fontSize(7);
  doc.text(`Total verse par l'employeur: ${fmtE(coutTotal)}  (brut ${fmtE(brut)} + charges patronales ${fmtE(totalP)}${bulletin.reduction_fillon > 0 ? ` - allegements ${fmtE(bulletin.reduction_fillon)}` : ''})`, L + 6, y, { width: W - 12 });
  y += 12;
  doc.text('Date de paiement: dernier jour ouvrable du mois', L + 6, y);
  y += 12;

  return y;
}

function renderCumuls(doc, L, W, y, bulletin) {
  const halfW = W / 2 - 6;
  const cumuls = bulletin.cumuls || {};
  const hsExo = cumuls.hsExonerees || ((bulletin.montant_hs_25 || 0) + (bulletin.montant_hs_50 || 0));
  const boxH = hsExo > 0 ? 57 : 46;

  // Cumuls annuels (gauche)
  doc.rect(L, y, halfW, boxH).stroke('#d1d5db');
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('CUMULS ANNUELS', L + 6, y + 5);
  doc.font('Helvetica').fontSize(7);
  doc.text(`Brut cumule: ${fmtE(bulletin.cumul_brut || bulletin.brut_total || 0)}`, L + 6, y + 18);
  doc.text(`Net imposable cumule: ${fmtE(bulletin.cumul_net_imposable || bulletin.net_imposable || 0)}`, L + 6, y + 29);
  doc.text(`PAS cumule: ${fmtE(bulletin.cumul_ir || bulletin.montant_ir || 0)}`, L + 6, y + 40);
  if (hsExo > 0) doc.text(`HS exonerees cumul: ${fmtE(hsExo)}`, L + 6, y + 51);

  // Conges payes (droite)
  const R = L + halfW + 12;
  doc.rect(R, y, halfW, boxH).stroke('#d1d5db');
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('CONGES PAYES', R + 6, y + 5);
  doc.font('Helvetica').fontSize(7);
  doc.text(`Acquis: ${bulletin.cp_acquis || 0} jours`, R + 6, y + 18);
  doc.text(`Pris: ${bulletin.cp_pris || 0} jours`, R + 110, y + 18);
  doc.text(`Solde: ${bulletin.cp_solde || 0} jours`, R + 6, y + 29);

  y += boxH;
  return y;
}

function renderFooter(doc, L, W, y, bulletin, employeur) {
  y += 4;
  doc.rect(L, y, W, 50).stroke('#d1d5db');
  doc.font('Helvetica').fontSize(6).fillColor('#555');

  const mentions = [
    'Dans votre interet, conservez ce bulletin de paie sans limitation de duree.',
    'Le montant net social correspond au revenu net apres deduction de l\'ensemble des prelevements sociaux obligatoires.',
    'En cas de litige, le salarie peut saisir le Conseil de Prud\'hommes dans un delai de 3 ans.',
    'Plus d\'informations sur www.mesdroitssociaux.gouv.fr | www.service-public.fr/particuliers/vosdroits/F559',
  ];

  let my = y + 5;
  for (const m of mentions) {
    doc.text(m, L + 6, my, { width: W - 12 });
    my += 9;
  }

  doc.fontSize(5).fillColor('#999');
  doc.text(
    `Document genere le ${new Date().toLocaleDateString('fr-FR')} | NEXUS SIRH | PMSS 2026: 4 005 \u20AC | SMIC 2026: 1 823,03 \u20AC`,
    L + 6, my + 2, { width: W - 12 }
  );
}

export default {
  generatePayslipPDF,
  streamPayslipPDF,
};
