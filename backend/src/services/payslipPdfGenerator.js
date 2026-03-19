/**
 * Generateur de bulletin de paie PDF conforme 2026
 * Respecte les mentions obligatoires Article R3243-1 Code du travail
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
// GENERATION PDF
// ============================================

/**
 * Genere un bulletin de paie PDF complet
 * @param {string} tenantId
 * @param {string} bulletinId
 * @returns {Buffer} PDF buffer
 */
export async function generatePayslipPDF(tenantId, bulletinId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!bulletinId) throw new Error('bulletinId requis');

  // Recuperer le bulletin
  const { data: bulletin, error } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('id', bulletinId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !bulletin) throw new Error('Bulletin non trouve');

  // Recuperer infos tenant/employeur
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

  const salarie = {
    nom: `${bulletin.employe_prenom || ''} ${bulletin.employe_nom || ''}`.trim(),
    nir: bulletin.employe_nir ? bulletin.employe_nir.slice(0, 13) : '-',
    poste: bulletin.employe_poste || '-',
    classification: bulletin.employe_classification || '-',
    contrat: (bulletin.type_contrat || 'CDI').toUpperCase(),
    dateEmbauche: bulletin.date_embauche,
    anciennete: bulletin.anciennete_mois || 0,
    adresse: bulletin.employe_adresse || '',
  };

  // Construire le PDF
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 35 });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 70;
    const L = 35;
    let y = 30;

    // === 1. TITRE ===
    renderTitle(doc, L, W, y);
    y += 25;

    // === 2. EN-TETE EMPLOYEUR / SALARIE ===
    y = renderHeader(doc, L, W, y, employeur, salarie, bulletin.periode);
    y += 10;

    // === 3. PERIODE & ELEMENTS BRUT ===
    y = renderSalaryElements(doc, L, W, y, bulletin);
    y += 8;

    // === 4. COTISATIONS ===
    y = renderCotisationsTable(doc, L, W, y, bulletin);
    y += 8;

    // === 5. NETS ===
    y = renderNetSection(doc, L, W, y, bulletin);
    y += 8;

    // === 6. CUMULS ===
    y = renderCumuls(doc, L, W, y, bulletin);
    y += 8;

    // === 7. PIED DE PAGE ===
    renderFooter(doc, L, W, y, bulletin, employeur);

    doc.end();
  });
}

/**
 * Genere le PDF et le pipe directement dans la reponse HTTP
 * @param {string} tenantId
 * @param {string} bulletinId
 * @param {Object} res - Response Express
 */
export async function streamPayslipPDF(tenantId, bulletinId, res) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!bulletinId) throw new Error('bulletinId requis');

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

  const salarie = {
    nom: `${bulletin.employe_prenom || ''} ${bulletin.employe_nom || ''}`.trim(),
    nir: bulletin.employe_nir ? bulletin.employe_nir.slice(0, 13) : '-',
    poste: bulletin.employe_poste || '-',
    classification: bulletin.employe_classification || '-',
    contrat: (bulletin.type_contrat || 'CDI').toUpperCase(),
    dateEmbauche: bulletin.date_embauche,
    anciennete: bulletin.anciennete_mois || 0,
    adresse: bulletin.employe_adresse || '',
  };

  const filename = `bulletin_${bulletin.employe_nom}_${bulletin.employe_prenom}_${bulletin.periode}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 35 });
  doc.pipe(res);

  const W = doc.page.width - 70;
  const L = 35;
  let y = 30;

  renderTitle(doc, L, W, y);
  y += 25;

  y = renderHeader(doc, L, W, y, employeur, salarie, bulletin.periode);
  y += 10;

  y = renderSalaryElements(doc, L, W, y, bulletin);
  y += 8;

  y = renderCotisationsTable(doc, L, W, y, bulletin);
  y += 8;

  y = renderNetSection(doc, L, W, y, bulletin);
  y += 8;

  y = renderCumuls(doc, L, W, y, bulletin);
  y += 8;

  renderFooter(doc, L, W, y, bulletin, employeur);

  doc.end();
}

// ============================================
// SECTIONS DE RENDU
// ============================================

function renderTitle(doc, L, W, y) {
  doc.font('Helvetica-Bold').fontSize(14);
  doc.text('BULLETIN DE PAIE', L, y, { width: W, align: 'center' });
}

function renderHeader(doc, L, W, y, employeur, salarie, periode) {
  const halfW = W / 2 - 8;

  // Employeur (gauche)
  doc.rect(L, y, halfW, 95).stroke('#ccc');
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('EMPLOYEUR', L + 6, y + 6);
  doc.font('Helvetica').fontSize(8);
  doc.text(employeur.nom, L + 6, y + 20, { width: halfW - 12 });
  if (employeur.siret) doc.text(`SIRET: ${employeur.siret}`, L + 6, y + 33);
  if (employeur.naf) doc.text(`Code NAF: ${employeur.naf}`, L + 6, y + 45);
  if (employeur.adresse) doc.text(employeur.adresse, L + 6, y + 57, { width: halfW - 12 });
  if (employeur.idcc) doc.text(`Convention: IDCC ${employeur.idcc}`, L + 6, y + 73, { width: halfW - 12 });
  if (employeur.urssaf) doc.text(`URSSAF: ${employeur.urssaf}`, L + 6, y + 83);

  // Salarie (droite)
  const R = L + halfW + 16;
  doc.rect(R, y, halfW, 95).stroke('#ccc');
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('SALARIE(E)', R + 6, y + 6);
  doc.font('Helvetica').fontSize(8);
  doc.text(salarie.nom, R + 6, y + 20, { width: halfW - 12 });
  doc.text(`N\u00B0 SS: ${salarie.nir}`, R + 6, y + 33);
  doc.text(`Emploi: ${salarie.poste}`, R + 6, y + 45);
  doc.text(`Classification: ${salarie.classification}`, R + 6, y + 57);
  doc.text(`Contrat: ${salarie.contrat}`, R + 6, y + 69);
  if (salarie.dateEmbauche) doc.text(`Entree: ${formatDate(salarie.dateEmbauche)} (${salarie.anciennete} mois)`, R + 6, y + 81);

  y += 102;

  // Bandeau periode
  doc.rect(L, y, W, 22).fill('#f0f4f8').stroke('#d0d5dd');
  doc.fill('#000').font('Helvetica-Bold').fontSize(10);
  doc.text(`Periode: ${formatPeriode(periode).toUpperCase()}`, L + 8, y + 6, { width: W - 16, align: 'center' });
  y += 22;

  return y;
}

function renderSalaryElements(doc, L, W, y, bulletin) {
  // En-tete section
  doc.rect(L, y, W, 18).fill('#e5e7eb').stroke('#d1d5db');
  doc.fill('#000').font('Helvetica-Bold').fontSize(8);
  doc.text('REMUNERATION', L + 6, y + 5);
  doc.text('Quantite', L + 250, y + 5, { width: 55, align: 'right' });
  doc.text('Taux', L + 310, y + 5, { width: 50, align: 'right' });
  doc.text('Montant', L + 365, y + 5, { width: 65, align: 'right' });
  y += 18;

  doc.font('Helvetica').fontSize(8);

  // Salaire de base
  doc.text('Salaire de base', L + 6, y + 4);
  doc.text(`${bulletin.heures_normales || 151.67} h`, L + 250, y + 4, { width: 55, align: 'right' });
  doc.text(fmtE(Math.round((bulletin.salaire_base || 0) / (bulletin.heures_normales || 151.67))), L + 310, y + 4, { width: 50, align: 'right' });
  doc.text(fmtE(bulletin.salaire_base), L + 365, y + 4, { width: 65, align: 'right' });
  y += 15;

  // HS 25%
  if (bulletin.heures_supp_25 > 0) {
    doc.text('Heures supplementaires 25%', L + 6, y + 4);
    doc.text(`${bulletin.heures_supp_25} h`, L + 250, y + 4, { width: 55, align: 'right' });
    doc.text('125%', L + 310, y + 4, { width: 50, align: 'right' });
    doc.text(fmtE(bulletin.montant_hs_25), L + 365, y + 4, { width: 65, align: 'right' });
    y += 15;
  }

  // HS 50%
  if (bulletin.heures_supp_50 > 0) {
    doc.text('Heures supplementaires 50%', L + 6, y + 4);
    doc.text(`${bulletin.heures_supp_50} h`, L + 250, y + 4, { width: 55, align: 'right' });
    doc.text('150%', L + 310, y + 4, { width: 50, align: 'right' });
    doc.text(fmtE(bulletin.montant_hs_50), L + 365, y + 4, { width: 65, align: 'right' });
    y += 15;
  }

  // Primes
  if (bulletin.primes && Array.isArray(bulletin.primes)) {
    for (const prime of bulletin.primes) {
      if (prime.montant > 0) {
        doc.text(prime.nom || prime.code || 'Prime', L + 6, y + 4);
        doc.text(fmtE(prime.montant), L + 365, y + 4, { width: 65, align: 'right' });
        y += 15;
      }
    }
  }

  // Total brut
  y += 3;
  doc.rect(L, y, W, 18).fill('#dcfce7').stroke('#22c55e');
  doc.fill('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('SALAIRE BRUT', L + 6, y + 4);
  doc.text(fmtE(bulletin.brut_total), L + 365, y + 4, { width: 65, align: 'right' });
  y += 18;

  return y;
}

function renderCotisationsTable(doc, L, W, y, bulletin) {
  // En-tete
  doc.rect(L, y, W, 18).fill('#e5e7eb').stroke('#d1d5db');
  doc.fill('#000').font('Helvetica-Bold').fontSize(7);
  doc.text('COTISATIONS ET CONTRIBUTIONS', L + 6, y + 5);
  doc.text('Base', L + 220, y + 5, { width: 55, align: 'right' });
  doc.text('Taux S.', L + 278, y + 5, { width: 40, align: 'right' });
  doc.text('Salarie', L + 320, y + 5, { width: 52, align: 'right' });
  doc.text('Taux P.', L + 375, y + 5, { width: 40, align: 'right' });
  doc.text('Employeur', L + 418, y + 5, { width: 55, align: 'right' });
  y += 18;

  const brut = bulletin.brut_total || 0;
  const pmss = TAUX_2026.pmss;
  const basePlaf = Math.min(brut, pmss);
  const tranche2 = Math.max(0, brut - pmss);
  const baseCSG = Math.round(brut * 0.9825);

  // Grouper cotisations par categorie pour affichage conforme
  const categories = [
    { section: 'SANTE', items: [
      { nom: 'Maladie, maternite, invalidite, deces', base: brut, txS: 0, txP: 7.00 },
    ]},
    { section: 'ACCIDENTS DU TRAVAIL', items: [
      { nom: 'Accidents du travail - Maladies prof.', base: brut, txS: 0, txP: 2.08 },
    ]},
    { section: 'RETRAITE', items: [
      { nom: 'Securite sociale plafonnee', base: basePlaf, txS: 6.90, txP: 8.55 },
      { nom: 'Securite sociale deplafonnee', base: brut, txS: 0.40, txP: 2.02 },
      { nom: 'Complementaire T1 (AGIRC-ARRCO)', base: basePlaf, txS: 3.15, txP: 4.72 },
      ...(tranche2 > 0 ? [{ nom: 'Complementaire T2 (AGIRC-ARRCO)', base: tranche2, txS: 8.64, txP: 12.95 }] : []),
      { nom: 'CEG Tranche 1', base: basePlaf, txS: 0.86, txP: 1.29 },
      ...(tranche2 > 0 ? [{ nom: 'CEG Tranche 2', base: tranche2, txS: 1.08, txP: 1.62 }] : []),
    ]},
    { section: 'FAMILLE', items: [
      { nom: 'Allocations familiales', base: brut, txS: 0, txP: 3.45 },
    ]},
    { section: 'CHOMAGE', items: [
      { nom: 'Assurance chomage', base: basePlaf, txS: 0, txP: 4.05 },
      { nom: 'AGS (garantie des salaires)', base: basePlaf, txS: 0, txP: 0.20 },
    ]},
    { section: 'CSG / CRDS', items: [
      { nom: 'CSG deductible de l\'impot sur le revenu', base: baseCSG, txS: 6.80, txP: 0 },
      { nom: 'CSG non deductible', base: baseCSG, txS: 2.40, txP: 0 },
      { nom: 'CRDS', base: baseCSG, txS: 0.50, txP: 0 },
    ]},
    { section: 'AUTRES', items: [
      { nom: 'FNAL', base: basePlaf, txS: 0, txP: 0.10 },
      { nom: 'CSA (solidarite autonomie)', base: brut, txS: 0, txP: 0.30 },
      { nom: 'Formation professionnelle', base: brut, txS: 0, txP: 0.55 },
      { nom: 'Taxe d\'apprentissage', base: brut, txS: 0, txP: 0.68 },
      { nom: 'Dialogue social', base: brut, txS: 0, txP: 0.016 },
    ]},
  ];

  let totalS = 0, totalP = 0;
  doc.font('Helvetica').fontSize(7);

  for (const cat of categories) {
    // Nom section
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#374151');
    doc.text(cat.section, L + 6, y + 3, { width: 200 });
    y += 12;
    doc.font('Helvetica').fontSize(7).fillColor('#000');

    for (const item of cat.items) {
      const mS = Math.round(item.base * item.txS / 100);
      const mP = Math.round(item.base * item.txP / 100);
      totalS += mS;
      totalP += mP;

      doc.text(item.nom, L + 12, y + 3, { width: 205 });
      doc.text(fmt(item.base), L + 220, y + 3, { width: 55, align: 'right' });
      doc.text(item.txS > 0 ? `${item.txS}%` : '-', L + 278, y + 3, { width: 40, align: 'right' });
      doc.text(mS > 0 ? fmt(mS) : '-', L + 320, y + 3, { width: 52, align: 'right' });
      doc.text(item.txP > 0 ? `${item.txP}%` : '-', L + 375, y + 3, { width: 40, align: 'right' });
      doc.text(mP > 0 ? fmt(mP) : '-', L + 418, y + 3, { width: 55, align: 'right' });
      y += 13;
    }
  }

  // Reduction Fillon
  const fillon = bulletin.reduction_fillon || 0;
  if (fillon > 0) {
    y += 2;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#059669');
    doc.text('ALLEGEMENTS DE COTISATIONS', L + 6, y + 3);
    y += 12;
    doc.font('Helvetica').fontSize(7).fillColor('#000');
    doc.text('Reduction generale (ex-Fillon)', L + 12, y + 3);
    doc.text(`-${fmt(fillon)}`, L + 418, y + 3, { width: 55, align: 'right' });
    totalP -= fillon;
    y += 13;
  }

  // Total cotisations
  y += 2;
  doc.rect(L, y, W, 18).fill('#fee2e2').stroke('#ef4444');
  doc.fill('#000').font('Helvetica-Bold').fontSize(8);
  doc.text('TOTAL COTISATIONS', L + 6, y + 4);
  doc.text(fmtE(totalS), L + 320, y + 4, { width: 52, align: 'right' });
  doc.text(fmtE(totalP), L + 418, y + 4, { width: 55, align: 'right' });
  y += 18;

  return y;
}

function renderNetSection(doc, L, W, y, bulletin) {
  const brut = bulletin.brut_total || 0;
  const totalS = bulletin.total_cotisations_salariales || 0;
  const netSocial = bulletin.net_social || (brut - totalS);
  const netImposable = bulletin.net_imposable || netSocial;
  const netAvantIR = bulletin.net_avant_ir || netSocial;
  const tauxIR = bulletin.taux_ir || 0;
  const montantIR = bulletin.montant_ir || 0;
  const netAPayer = bulletin.net_a_payer || (netAvantIR - montantIR);

  // Net social
  doc.rect(L, y, W, 20).fill('#dbeafe').stroke('#3b82f6');
  doc.fill('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('MONTANT NET SOCIAL', L + 6, y + 5);
  doc.text(fmtE(netSocial), L + 370, y + 5, { width: 100, align: 'right' });
  y += 24;

  // Net imposable
  doc.font('Helvetica').fontSize(8);
  doc.text(`Net imposable: ${fmtE(netImposable)}`, L + 6, y + 2);
  y += 14;

  // PAS
  doc.text(`Prelevement a la source (taux: ${tauxIR}%)`, L + 6, y + 2);
  doc.text(montantIR > 0 ? `- ${fmtE(montantIR)}` : '-', L + 370, y + 2, { width: 100, align: 'right' });
  y += 18;

  // NET A PAYER (grosse barre verte)
  doc.rect(L, y, W, 26).fill('#16a34a').stroke('#16a34a');
  doc.fill('#fff').font('Helvetica-Bold').fontSize(13);
  doc.text('NET A PAYER', L + 8, y + 6);
  doc.text(fmtE(netAPayer), L + 350, y + 6, { width: 120, align: 'right' });
  y += 26;

  // Cout employeur
  y += 4;
  const totalP = bulletin.total_cotisations_patronales || 0;
  const coutTotal = brut + totalP - (bulletin.reduction_fillon || 0);
  doc.fill('#000').font('Helvetica').fontSize(7);
  doc.text(`Total verse par l'employeur: ${fmtE(coutTotal)}  (brut ${fmtE(brut)} + charges patronales ${fmtE(totalP)}${bulletin.reduction_fillon > 0 ? ` - allegements ${fmtE(bulletin.reduction_fillon)}` : ''})`, L + 6, y + 2, { width: W - 12 });
  y += 14;

  // Date paiement
  doc.text(`Date de paiement: dernier jour ouvrable du mois`, L + 6, y + 2);
  y += 14;

  return y;
}

function renderCumuls(doc, L, W, y, bulletin) {
  const halfW = W / 2 - 6;

  // Cumuls annuels (gauche)
  doc.rect(L, y, halfW, 48).stroke('#d1d5db');
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('CUMULS ANNUELS', L + 6, y + 6);
  doc.font('Helvetica').fontSize(7);
  doc.text(`Brut cumule: ${fmtE(bulletin.cumul_brut || bulletin.brut_total || 0)}`, L + 6, y + 20);
  doc.text(`Net imposable cumule: ${fmtE(bulletin.cumul_net_imposable || bulletin.net_imposable || 0)}`, L + 6, y + 32);
  doc.text(`PAS cumule: ${fmtE(bulletin.cumul_ir || bulletin.montant_ir || 0)}`, L + 6, y + 44);

  // Conges payes (droite)
  const R = L + halfW + 12;
  doc.rect(R, y, halfW, 48).stroke('#d1d5db');
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('CONGES PAYES', R + 6, y + 6);
  doc.font('Helvetica').fontSize(7);
  doc.text(`Acquis: ${bulletin.cp_acquis || 0} jours`, R + 6, y + 20);
  doc.text(`Pris: ${bulletin.cp_pris || 0} jours`, R + 100, y + 20);
  doc.text(`Solde: ${bulletin.cp_solde || 0} jours`, R + 6, y + 32);

  y += 48;
  return y;
}

function renderFooter(doc, L, W, y, bulletin, employeur) {
  // Mentions legales obligatoires
  doc.rect(L, y, W, 60).stroke('#d1d5db');
  doc.font('Helvetica').fontSize(6).fillColor('#555');

  const mentions = [
    'Dans votre interet, conservez ce bulletin de paie sans limitation de duree.',
    'Le montant net social correspond au revenu net apres deduction de l\'ensemble des prelevements sociaux obligatoires.',
    'Plus d\'informations sur www.mesdroitssociaux.gouv.fr',
    'En cas de litige, le salarie peut saisir le Conseil de Prud\'hommes dans un delai de 3 ans.',
    'Pour toute question concernant ce bulletin, adressez-vous au service des ressources humaines.',
  ];

  let my = y + 6;
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
