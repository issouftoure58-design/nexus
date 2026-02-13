/**
 * Routes API pour Comptabilité P&L
 * Plan PRO Feature
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { calculatePnL, calculatePnLPeriode, calculatePnLAnnee, comparePnL } from '../services/comptaService.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// Appliquer authentification
router.use(authenticateAdmin);

/**
 * GET /api/admin/compta/pnl
 * Calcule P&L pour un mois
 */
router.get('/pnl', async (req, res) => {
  try {
    const { mois, annee } = req.query;

    const currentDate = new Date();
    const targetMois = parseInt(mois) || (currentDate.getMonth() + 1);
    const targetAnnee = parseInt(annee) || currentDate.getFullYear();

    const pnl = await calculatePnL(req.admin.tenant_id, targetMois, targetAnnee);

    res.json(pnl);
  } catch (error) {
    console.error('[COMPTA] Erreur get P&L:', error);
    res.status(500).json({ error: 'Erreur calcul P&L' });
  }
});

/**
 * GET /api/admin/compta/pnl/periode
 * P&L sur plusieurs mois
 */
router.get('/pnl/periode', async (req, res) => {
  try {
    const { moisDebut, anneeDebut, moisFin, anneeFin } = req.query;

    if (!moisDebut || !anneeDebut || !moisFin || !anneeFin) {
      return res.status(400).json({
        error: 'Paramètres requis: moisDebut, anneeDebut, moisFin, anneeFin'
      });
    }

    const results = await calculatePnLPeriode(
      req.admin.tenant_id,
      parseInt(moisDebut),
      parseInt(anneeDebut),
      parseInt(moisFin),
      parseInt(anneeFin)
    );

    res.json(results);
  } catch (error) {
    console.error('[COMPTA] Erreur get P&L période:', error);
    res.status(500).json({ error: 'Erreur calcul P&L période' });
  }
});

/**
 * GET /api/admin/compta/pnl/annee
 * P&L pour une année complète
 */
router.get('/pnl/annee', async (req, res) => {
  try {
    const { annee } = req.query;
    const targetAnnee = parseInt(annee) || new Date().getFullYear();

    const results = await calculatePnLAnnee(req.admin.tenant_id, targetAnnee);

    res.json(results);
  } catch (error) {
    console.error('[COMPTA] Erreur get P&L année:', error);
    res.status(500).json({ error: 'Erreur calcul P&L année' });
  }
});

/**
 * GET /api/admin/compta/pnl/compare
 * Compare P&L entre deux périodes
 */
router.get('/pnl/compare', async (req, res) => {
  try {
    const { mois1, annee1, mois2, annee2 } = req.query;

    if (!mois1 || !annee1 || !mois2 || !annee2) {
      return res.status(400).json({
        error: 'Paramètres requis: mois1, annee1, mois2, annee2'
      });
    }

    const comparison = await comparePnL(
      req.admin.tenant_id,
      { mois: parseInt(mois1), annee: parseInt(annee1) },
      { mois: parseInt(mois2), annee: parseInt(annee2) }
    );

    res.json(comparison);
  } catch (error) {
    console.error('[COMPTA] Erreur compare P&L:', error);
    res.status(500).json({ error: 'Erreur comparaison P&L' });
  }
});

/**
 * GET /api/admin/compta/pnl/export-pdf
 * Export PDF du P&L
 */
router.get('/pnl/export-pdf', async (req, res) => {
  try {
    const { mois, annee } = req.query;

    const currentDate = new Date();
    const targetMois = parseInt(mois) || (currentDate.getMonth() + 1);
    const targetAnnee = parseInt(annee) || currentDate.getFullYear();

    const pnl = await calculatePnL(req.admin.tenant_id, targetMois, targetAnnee);

    // Créer PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=PnL-${targetMois}-${targetAnnee}.pdf`);

    doc.pipe(res);

    // En-tête
    doc.fontSize(24).font('Helvetica-Bold').text('Compte de Résultat', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${pnl.periode.nomMois} ${targetAnnee}`, { align: 'center' });
    doc.moveDown(2);

    // Ligne de séparation
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Section REVENUS
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#059669').text('REVENUS');
    doc.fontSize(12).font('Helvetica').fillColor('black');
    doc.moveDown(0.5);

    doc.text(`Factures payées : ${pnl.revenus.nbFactures}`);
    doc.text(`Montant HT : ${pnl.revenus.ht} €`);
    doc.text(`TVA collectée : ${pnl.revenus.tva} €`);
    doc.font('Helvetica-Bold').text(`TOTAL REVENUS : ${pnl.revenus.total} €`);
    doc.moveDown();

    // Section DÉPENSES
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#DC2626').text('DÉPENSES');
    doc.fontSize(12).font('Helvetica').fillColor('black');
    doc.moveDown(0.5);

    // Détail par catégorie
    Object.entries(pnl.depenses.parCategorie).forEach(([cat, data]) => {
      doc.text(`${cat} : ${data.total} € (${data.count} opération(s))`);
    });

    doc.moveDown(0.5);
    doc.text(`TVA déductible : ${pnl.depenses.tva} €`);
    doc.font('Helvetica-Bold').text(`TOTAL DÉPENSES : ${pnl.depenses.total} €`);
    doc.moveDown();

    // Ligne de séparation
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Section RÉSULTAT
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1D4ED8').text('RÉSULTAT');
    doc.fontSize(12).font('Helvetica').fillColor('black');
    doc.moveDown(0.5);

    doc.text(`Résultat brut (HT) : ${pnl.resultat.brut} €`);

    const resultatColor = parseFloat(pnl.resultat.net) >= 0 ? '#059669' : '#DC2626';
    doc.font('Helvetica-Bold').fontSize(14).fillColor(resultatColor);
    doc.text(`RÉSULTAT NET : ${pnl.resultat.net} €`);

    doc.font('Helvetica').fontSize(12).fillColor('black');
    doc.text(`Marge brute : ${pnl.resultat.margeBrute}%`);
    doc.text(`Marge nette : ${pnl.resultat.margeNette}%`);
    doc.moveDown();

    // Section TVA
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#7C3AED').text('TVA');
    doc.fontSize(12).font('Helvetica').fillColor('black');
    doc.moveDown(0.5);

    doc.text(`TVA collectée : ${pnl.tva.collectee} €`);
    doc.text(`TVA déductible : ${pnl.tva.deductible} €`);

    const tvaColor = parseFloat(pnl.tva.nette) >= 0 ? '#DC2626' : '#059669';
    const tvaLabel = parseFloat(pnl.tva.nette) >= 0 ? 'À payer' : 'Crédit TVA';
    doc.font('Helvetica-Bold').fillColor(tvaColor);
    doc.text(`${tvaLabel} : ${Math.abs(parseFloat(pnl.tva.nette)).toFixed(2)} €`);

    doc.moveDown(2);

    // Pied de page
    doc.fontSize(10).font('Helvetica').fillColor('gray');
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
    doc.text('NEXUS - Plateforme de gestion', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('[COMPTA] Erreur export PDF:', error);
    res.status(500).json({ error: 'Erreur export PDF' });
  }
});

/**
 * GET /api/admin/compta/dashboard
 * Dashboard comptabilité avec résumé
 */
router.get('/dashboard', async (req, res) => {
  try {
    const currentDate = new Date();
    const moisActuel = currentDate.getMonth() + 1;
    const anneeActuelle = currentDate.getFullYear();

    // P&L du mois en cours
    const pnlMoisActuel = await calculatePnL(req.admin.tenant_id, moisActuel, anneeActuelle);

    // P&L du mois précédent pour comparaison
    let moisPrecedent = moisActuel - 1;
    let anneePrecedente = anneeActuelle;
    if (moisPrecedent === 0) {
      moisPrecedent = 12;
      anneePrecedente -= 1;
    }
    const pnlMoisPrecedent = await calculatePnL(req.admin.tenant_id, moisPrecedent, anneePrecedente);

    // Calcul variations
    const variationRevenus = pnlMoisPrecedent.revenus.total !== '0.00'
      ? (((parseFloat(pnlMoisActuel.revenus.total) - parseFloat(pnlMoisPrecedent.revenus.total)) / parseFloat(pnlMoisPrecedent.revenus.total)) * 100).toFixed(1)
      : 0;

    const variationResultat = pnlMoisPrecedent.resultat.net !== '0.00'
      ? (((parseFloat(pnlMoisActuel.resultat.net) - parseFloat(pnlMoisPrecedent.resultat.net)) / Math.abs(parseFloat(pnlMoisPrecedent.resultat.net))) * 100).toFixed(1)
      : 0;

    res.json({
      moisActuel: pnlMoisActuel,
      moisPrecedent: pnlMoisPrecedent,
      variations: {
        revenus: variationRevenus,
        resultat: variationResultat
      },
      indicateurs: {
        rentable: parseFloat(pnlMoisActuel.resultat.net) > 0,
        tendance: parseFloat(variationResultat) > 0 ? 'hausse' : parseFloat(variationResultat) < 0 ? 'baisse' : 'stable'
      }
    });
  } catch (error) {
    console.error('[COMPTA] Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur dashboard comptabilité' });
  }
});

export default router;
