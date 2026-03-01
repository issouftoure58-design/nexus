/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   PDF Service - Multi-Tenant Production-Ready                     ║
 * ║   Generates PDF documents as Buffers for cloud compatibility      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// ============================================
// TENANT DATA FETCHING
// ============================================

/**
 * Fetches tenant configuration for PDF branding
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Tenant configuration
 */
async function getTenantConfig(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, settings')
    .eq('id', tenantId)
    .single();

  if (error) {
    logger.error('Error fetching tenant config for PDF', { tenantId, error: error.message });
    // Return default config if tenant not found
    return {
      name: 'NEXUS',
      slug: 'nexus',
      settings: {}
    };
  }

  return tenant;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Formats a date string to French locale
 * @param {string|Date} dateStr - Date to format
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formats amount from cents to euros string
 * @param {number} cents - Amount in cents
 * @returns {string} Formatted amount
 */
function formatMontant(cents) {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',') + ' EUR';
}

/**
 * Formats amount (already in euros) to string
 * @param {number} euros - Amount in euros
 * @returns {string} Formatted amount
 */
function formatMontantEuros(euros) {
  return (euros || 0).toFixed(2).replace('.', ',') + ' EUR';
}

// ============================================
// CORE PDF GENERATION (Returns Buffer)
// ============================================

/**
 * Generates a PDF invoice from data
 * @param {string} tenantId - Tenant ID
 * @param {Object} data - Invoice data
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generateFacture(tenantId, data) {
  if (!tenantId) throw new Error('tenant_id requis');

  const {
    numero,
    date,
    client,
    services,
    total,
    acompte = 0,
    notes,
    tenant: tenantInfo
  } = data;

  const filename = `facture_${numero || Date.now()}.pdf`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('Invoice PDF generated', { tenantId, numero: numero || 'N/A', filename, size: buffer.length });
        resolve({
          success: true,
          buffer,
          filename,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', (err) => {
        logger.error('PDF stream error', { tenantId, error: err.message });
        reject({ success: false, error: err.message });
      });

      // Header
      const businessName = tenantInfo?.name || 'NEXUS';
      doc.fontSize(24).fillColor('#0891b2').text(businessName, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text('Gestion Professionnelle', { align: 'center' });
      doc.moveDown(2);

      // Title
      doc.fontSize(18).fillColor('#000').text('FACTURE', { align: 'center' });
      doc.moveDown();

      // Invoice info
      doc.fontSize(10).fillColor('#333');
      doc.text(`Facture N: ${numero || 'FAC-' + Date.now()}`);
      doc.text(`Date: ${date || new Date().toLocaleDateString('fr-FR')}`);
      doc.moveDown();

      // Client
      if (client) {
        doc.fontSize(12).fillColor('#000').text('Client:');
        doc.fontSize(10).fillColor('#333');
        doc.text(`${client.nom || 'Non specifie'}`);
        if (client.adresse) doc.text(client.adresse);
        if (client.telephone) doc.text(`Tel: ${client.telephone}`);
        if (client.email) doc.text(`Email: ${client.email}`);
      }
      doc.moveDown(2);

      // Services table
      doc.fontSize(12).fillColor('#000').text('Prestations:', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableLeft = 50;

      // Table headers
      doc.fontSize(10).fillColor('#666');
      doc.text('Description', tableLeft, tableTop);
      doc.text('Prix', 450, tableTop, { width: 100, align: 'right' });

      doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke('#ccc');

      // Table rows
      let yPosition = tableTop + 25;
      doc.fillColor('#333');

      if (Array.isArray(services)) {
        services.forEach(service => {
          doc.text(service.nom || service.description || 'Prestation', tableLeft, yPosition);
          doc.text(`${service.prix || 0} EUR`, 450, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        });
      } else {
        doc.text('Prestation', tableLeft, yPosition);
        doc.text(`${total || 0} EUR`, 450, yPosition, { width: 100, align: 'right' });
        yPosition += 20;
      }

      // Separator line
      doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#ccc');
      yPosition += 10;

      // Total
      doc.fontSize(12).fillColor('#000');
      doc.text('Total:', 350, yPosition);
      doc.text(`${total || 0} EUR`, 450, yPosition, { width: 100, align: 'right' });
      yPosition += 20;

      if (acompte > 0) {
        doc.fontSize(10).fillColor('#666');
        doc.text('Acompte verse:', 350, yPosition);
        doc.text(`-${acompte} EUR`, 450, yPosition, { width: 100, align: 'right' });
        yPosition += 15;

        doc.fontSize(12).fillColor('#0891b2');
        doc.text('Reste a payer:', 350, yPosition);
        doc.text(`${(total || 0) - acompte} EUR`, 450, yPosition, { width: 100, align: 'right' });
      }

      // Notes
      if (notes) {
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#666').text('Notes:', { underline: true });
        doc.text(notes);
      }

      // Footer
      doc.moveDown(3);
      doc.fontSize(8).fillColor('#999');
      doc.text(`${businessName} - Document genere automatiquement`, { align: 'center' });
      doc.text(`Tenant: ${tenantId}`, { align: 'center' });

      doc.end();

    } catch (error) {
      logger.error('PDF generation error', { tenantId, error: error.message });
      reject({ success: false, error: error.message });
    }
  });
}

/**
 * Generates a quote PDF from data
 * @param {string} tenantId - Tenant ID
 * @param {Object} data - Quote data
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generateDevis(tenantId, data) {
  if (!tenantId) throw new Error('tenant_id requis');

  const {
    numero,
    date,
    validite = '30 jours',
    client,
    services,
    total,
    notes,
    tenant: tenantInfo
  } = data;

  const filename = `devis_${numero || Date.now()}.pdf`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('Quote PDF generated', { tenantId, numero: numero || 'N/A', filename, size: buffer.length });
        resolve({
          success: true,
          buffer,
          filename,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', (err) => {
        logger.error('PDF stream error', { tenantId, error: err.message });
        reject({ success: false, error: err.message });
      });

      // Header
      const businessName = tenantInfo?.name || 'NEXUS';
      doc.fontSize(24).fillColor('#0891b2').text(businessName, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text('Gestion Professionnelle', { align: 'center' });
      doc.moveDown(2);

      // Title
      doc.fontSize(18).fillColor('#000').text('DEVIS', { align: 'center' });
      doc.moveDown();

      // Quote info
      doc.fontSize(10).fillColor('#333');
      doc.text(`Devis N: ${numero || 'DEV-' + Date.now()}`);
      doc.text(`Date: ${date || new Date().toLocaleDateString('fr-FR')}`);
      doc.text(`Validite: ${validite}`);
      doc.moveDown();

      // Client
      if (client) {
        doc.fontSize(12).fillColor('#000').text('Client:');
        doc.fontSize(10).fillColor('#333');
        doc.text(`${client.nom || 'Non specifie'}`);
        if (client.telephone) doc.text(`Tel: ${client.telephone}`);
        if (client.email) doc.text(`Email: ${client.email}`);
      }
      doc.moveDown(2);

      // Services table
      doc.fontSize(12).fillColor('#000').text('Prestations proposees:', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableLeft = 50;

      // Headers
      doc.fontSize(10).fillColor('#666');
      doc.text('Description', tableLeft, tableTop);
      doc.text('Prix', 450, tableTop, { width: 100, align: 'right' });

      doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke('#ccc');

      let yPosition = tableTop + 25;
      doc.fillColor('#333');

      if (Array.isArray(services)) {
        services.forEach(service => {
          doc.text(service.nom || service.description || 'Prestation', tableLeft, yPosition);
          doc.text(`${service.prix || 0} EUR`, 450, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        });
      }

      doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#ccc');
      yPosition += 10;

      // Total
      doc.fontSize(12).fillColor('#0891b2');
      doc.text('Total estime:', 350, yPosition);
      doc.text(`${total || 0} EUR`, 450, yPosition, { width: 100, align: 'right' });

      // Notes
      if (notes) {
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#666').text('Notes:', { underline: true });
        doc.text(notes);
      }

      // Conditions
      doc.moveDown(3);
      doc.fontSize(9).fillColor('#666');
      doc.text('Ce devis est valable ' + validite + ' a compter de sa date d\'emission.');

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999');
      doc.text(`${businessName} - Document genere automatiquement`, { align: 'center' });

      doc.end();

    } catch (error) {
      logger.error('PDF generation error', { tenantId, error: error.message });
      reject({ success: false, error: error.message });
    }
  });
}

/**
 * Generates a report PDF from data
 * @param {string} tenantId - Tenant ID
 * @param {Object} data - Report data
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generateRapport(tenantId, data) {
  if (!tenantId) throw new Error('tenant_id requis');

  const {
    titre,
    periode,
    sections,
    stats,
    tenant: tenantInfo
  } = data;

  const filename = `rapport_${periode || Date.now()}.pdf`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('Report PDF generated', { tenantId, titre, filename, size: buffer.length });
        resolve({
          success: true,
          buffer,
          filename,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', (err) => {
        logger.error('PDF stream error', { tenantId, error: err.message });
        reject({ success: false, error: err.message });
      });

      // Header
      const businessName = tenantInfo?.name || 'NEXUS';
      doc.fontSize(24).fillColor('#0891b2').text(businessName, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text('Rapport d\'activite', { align: 'center' });
      doc.moveDown(2);

      // Title
      doc.fontSize(18).fillColor('#000').text(titre || 'Rapport', { align: 'center' });
      doc.fontSize(12).fillColor('#666').text(`Periode: ${periode || 'Non specifiee'}`, { align: 'center' });
      doc.moveDown(2);

      // Key stats
      if (stats) {
        doc.fontSize(14).fillColor('#000').text('Chiffres cles', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333');

        if (stats.ca) doc.text(`- Chiffre d'affaires: ${stats.ca}`);
        if (stats.nbRdv) doc.text(`- Nombre de RDV: ${stats.nbRdv}`);
        if (stats.nbClients) doc.text(`- Clients: ${stats.nbClients}`);
        doc.moveDown();
      }

      // Sections
      if (Array.isArray(sections)) {
        sections.forEach(section => {
          doc.fontSize(12).fillColor('#0891b2').text(section.titre || 'Section', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor('#333').text(section.contenu || '');
          doc.moveDown();
        });
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999');
      doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
      doc.text(`Tenant: ${tenantId}`, { align: 'center' });

      doc.end();

    } catch (error) {
      logger.error('PDF generation error', { tenantId, error: error.message });
      reject({ success: false, error: error.message });
    }
  });
}

// ============================================
// DATABASE-DRIVEN PDF GENERATION
// ============================================

/**
 * Generates an invoice PDF by fetching data from database
 * @param {string} tenantId - Tenant ID
 * @param {number|string} factureId - Invoice ID
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generateInvoicePDF(tenantId, factureId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!factureId) throw new Error('facture_id requis');

  try {
    // Fetch invoice from database
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        clients:client_id (id, nom, prenom, email, telephone, adresse)
      `)
      .eq('id', factureId)
      .eq('tenant_id', tenantId)
      .single();

    if (factureError || !facture) {
      logger.error('Invoice not found for PDF generation', { tenantId, factureId, error: factureError?.message });
      return { success: false, error: 'Facture non trouvee' };
    }

    // Fetch tenant config
    const tenant = await getTenantConfig(tenantId);

    const filename = `facture_${facture.numero || factureId}.pdf`;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info('Invoice PDF generated from DB', {
            tenantId,
            factureId,
            numero: facture.numero,
            size: buffer.length
          });
          resolve({
            success: true,
            buffer,
            filename,
            contentType: 'application/pdf',
            facture
          });
        });
        doc.on('error', (err) => {
          logger.error('PDF stream error', { tenantId, factureId, error: err.message });
          reject({ success: false, error: err.message });
        });

        // Header
        doc.fontSize(24).fillColor('#0891b2').text(tenant.name, { align: 'center' });
        doc.moveDown(2);

        // Title with status
        doc.fontSize(18).fillColor('#000').text('FACTURE', { align: 'center' });
        doc.fontSize(10).fillColor('#666').text(`Statut: ${facture.statut?.toUpperCase() || 'N/A'}`, { align: 'center' });
        doc.moveDown();

        // Invoice info box
        doc.fontSize(10).fillColor('#333');
        doc.text(`Facture N: ${facture.numero}`);
        doc.text(`Date: ${formatDate(facture.date_facture)}`);
        doc.text(`Echeance: ${formatDate(facture.date_echeance)}`);
        doc.moveDown();

        // Client section
        doc.fontSize(12).fillColor('#0891b2').text('CLIENT', { underline: true });
        doc.fontSize(10).fillColor('#333');

        const clientName = facture.clients
          ? `${facture.clients.prenom || ''} ${facture.clients.nom || ''}`.trim()
          : facture.client_nom || 'Non specifie';
        doc.text(clientName);

        if (facture.client_adresse || facture.clients?.adresse) {
          doc.text(facture.client_adresse || facture.clients.adresse);
        }
        if (facture.client_telephone || facture.clients?.telephone) {
          doc.text(`Tel: ${facture.client_telephone || facture.clients.telephone}`);
        }
        if (facture.client_email || facture.clients?.email) {
          doc.text(`Email: ${facture.client_email || facture.clients.email}`);
        }
        doc.moveDown(2);

        // Services table
        doc.fontSize(12).fillColor('#0891b2').text('PRESTATIONS', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const tableLeft = 50;

        // Table headers
        doc.fontSize(10).fillColor('#666');
        doc.text('Description', tableLeft, tableTop);
        doc.text('Date', 300, tableTop);
        doc.text('Montant HT', 420, tableTop, { width: 100, align: 'right' });

        doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke('#0891b2');

        let yPosition = tableTop + 25;
        doc.fillColor('#333');

        // Service line
        doc.text(facture.service_nom || 'Prestation', tableLeft, yPosition, { width: 240 });
        doc.text(formatDate(facture.date_prestation), 300, yPosition);
        doc.text(formatMontant(facture.montant_ht - (facture.frais_deplacement || 0)), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 20;

        // Travel fees if any
        if (facture.frais_deplacement > 0) {
          doc.text('Frais de deplacement', tableLeft, yPosition);
          doc.text('-', 300, yPosition);
          doc.text(formatMontant(facture.frais_deplacement), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        }

        doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#ccc');
        yPosition += 15;

        // Totals section
        doc.fontSize(10);
        doc.text('Total HT:', 350, yPosition);
        doc.text(formatMontant(facture.montant_ht), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 18;

        doc.text(`TVA (${facture.taux_tva || 20}%):`, 350, yPosition);
        doc.text(formatMontant(facture.montant_tva), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 18;

        doc.fontSize(12).fillColor('#0891b2');
        doc.text('Total TTC:', 350, yPosition);
        doc.text(formatMontant(facture.montant_ttc), 420, yPosition, { width: 100, align: 'right' });

        // Payment status
        if (facture.statut === 'payee' && facture.date_paiement) {
          doc.moveDown(3);
          doc.fontSize(11).fillColor('#065f46');
          doc.text(`Payee le ${formatDate(facture.date_paiement)}`, { align: 'center' });
          if (facture.mode_paiement) {
            doc.fontSize(9).text(`Mode: ${facture.mode_paiement.toUpperCase()}`, { align: 'center' });
          }
        }

        // Service description
        if (facture.service_description) {
          doc.moveDown(2);
          doc.fontSize(9).fillColor('#666').text('Notes:', { underline: true });
          doc.text(facture.service_description);
        }

        // Footer
        doc.moveDown(4);
        doc.fontSize(8).fillColor('#999');
        doc.text(`${tenant.name}`, { align: 'center' });
        doc.text(`Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });

        doc.end();

      } catch (error) {
        logger.error('PDF generation error', { tenantId, factureId, error: error.message });
        reject({ success: false, error: error.message });
      }
    });

  } catch (error) {
    logger.error('Error generating invoice PDF', { tenantId, factureId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generates a quote PDF by fetching data from database
 * @param {string} tenantId - Tenant ID
 * @param {number|string} devisId - Quote ID
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generateQuotePDF(tenantId, devisId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!devisId) throw new Error('devis_id requis');

  try {
    // Fetch quote from database
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select(`
        *,
        clients:client_id (id, nom, prenom, email, telephone, adresse)
      `)
      .eq('id', devisId)
      .eq('tenant_id', tenantId)
      .single();

    if (devisError || !devis) {
      logger.error('Quote not found for PDF generation', { tenantId, devisId, error: devisError?.message });
      return { success: false, error: 'Devis non trouve' };
    }

    // Fetch quote lines
    const { data: lignes } = await supabase
      .from('devis_lignes')
      .select('*')
      .eq('devis_id', devisId)
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true });

    // Fetch tenant config
    const tenant = await getTenantConfig(tenantId);

    const filename = `devis_${devis.numero || devisId}.pdf`;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info('Quote PDF generated from DB', {
            tenantId,
            devisId,
            numero: devis.numero,
            size: buffer.length
          });
          resolve({
            success: true,
            buffer,
            filename,
            contentType: 'application/pdf',
            devis
          });
        });
        doc.on('error', (err) => {
          logger.error('PDF stream error', { tenantId, devisId, error: err.message });
          reject({ success: false, error: err.message });
        });

        // Header
        doc.fontSize(24).fillColor('#0891b2').text(tenant.name, { align: 'center' });
        doc.moveDown(2);

        // Title with status
        doc.fontSize(18).fillColor('#000').text('DEVIS', { align: 'center' });
        doc.fontSize(10).fillColor('#666').text(`Statut: ${devis.statut?.toUpperCase() || 'BROUILLON'}`, { align: 'center' });
        doc.moveDown();

        // Quote info
        doc.fontSize(10).fillColor('#333');
        doc.text(`Devis N: ${devis.numero}`);
        doc.text(`Date: ${formatDate(devis.date_devis || devis.created_at)}`);

        const dateValidite = devis.date_validite || (() => {
          const d = new Date(devis.date_devis || devis.created_at);
          d.setDate(d.getDate() + (devis.validite_jours || 30));
          return d;
        })();
        doc.text(`Valable jusqu'au: ${formatDate(dateValidite)}`);
        doc.moveDown();

        // Client section
        doc.fontSize(12).fillColor('#0891b2').text('CLIENT', { underline: true });
        doc.fontSize(10).fillColor('#333');

        const clientName = devis.clients
          ? `${devis.clients.prenom || ''} ${devis.clients.nom || ''}`.trim()
          : devis.client_nom || 'Non specifie';
        doc.text(clientName);

        if (devis.client_adresse || devis.clients?.adresse) {
          doc.text(devis.client_adresse || devis.clients.adresse);
        }
        if (devis.client_telephone || devis.clients?.telephone) {
          doc.text(`Tel: ${devis.client_telephone || devis.clients.telephone}`);
        }
        if (devis.client_email || devis.clients?.email) {
          doc.text(`Email: ${devis.client_email || devis.clients.email}`);
        }

        if (devis.lieu) {
          doc.moveDown(0.5);
          doc.text(`Lieu d'intervention: ${devis.lieu}`);
        }
        doc.moveDown(2);

        // Services table
        doc.fontSize(12).fillColor('#0891b2').text('PRESTATIONS PROPOSEES', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const tableLeft = 50;

        // Table headers
        doc.fontSize(10).fillColor('#666');
        doc.text('Description', tableLeft, tableTop);
        doc.text('Duree', 320, tableTop);
        doc.text('Prix HT', 420, tableTop, { width: 100, align: 'right' });

        doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke('#0891b2');

        let yPosition = tableTop + 25;
        doc.fillColor('#333');

        // Service lines
        if (lignes && lignes.length > 0) {
          lignes.forEach(ligne => {
            // Check if we need a new page
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }

            doc.text(ligne.service_nom || 'Prestation', tableLeft, yPosition, { width: 260 });
            doc.text(ligne.duree_minutes ? `${ligne.duree_minutes} min` : '-', 320, yPosition);
            doc.text(formatMontant(ligne.prix_unitaire_ht || ligne.montant_ht), 420, yPosition, { width: 100, align: 'right' });
            yPosition += 20;
          });
        } else if (devis.service_nom) {
          // Fallback to main service if no lines
          doc.text(devis.service_nom, tableLeft, yPosition, { width: 260 });
          doc.text(devis.duree_minutes ? `${devis.duree_minutes} min` : '-', 320, yPosition);
          doc.text(formatMontant(devis.montant_ht), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        }

        // Travel fees
        if (devis.frais_deplacement > 0) {
          doc.text('Frais de deplacement', tableLeft, yPosition);
          doc.text('-', 320, yPosition);
          doc.text(formatMontant(devis.frais_deplacement), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        }

        doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#ccc');
        yPosition += 15;

        // Totals section
        doc.fontSize(10);
        doc.text('Total HT:', 350, yPosition);
        doc.text(formatMontant(devis.montant_ht), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 18;

        doc.text(`TVA (${devis.taux_tva || 20}%):`, 350, yPosition);
        doc.text(formatMontant(devis.montant_tva), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 18;

        doc.fontSize(12).fillColor('#0891b2');
        doc.text('Total TTC:', 350, yPosition);
        doc.text(formatMontant(devis.montant_ttc), 420, yPosition, { width: 100, align: 'right' });

        // Notes
        if (devis.notes) {
          doc.moveDown(2);
          doc.fontSize(9).fillColor('#666').text('Notes:', { underline: true });
          doc.text(devis.notes);
        }

        // Conditions
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#666');
        doc.text(`Ce devis est valable ${devis.validite_jours || 30} jours a compter de sa date d'emission.`);
        doc.text('Signature et mention "Bon pour accord":');
        doc.moveDown(3);
        doc.text('Date: ________________    Signature: ________________');

        // Footer
        doc.moveDown(3);
        doc.fontSize(8).fillColor('#999');
        doc.text(`${tenant.name}`, { align: 'center' });
        doc.text(`Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });

        doc.end();

      } catch (error) {
        logger.error('PDF generation error', { tenantId, devisId, error: error.message });
        reject({ success: false, error: error.message });
      }
    });

  } catch (error) {
    logger.error('Error generating quote PDF', { tenantId, devisId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generates a payslip PDF by fetching data from database
 * @param {string} tenantId - Tenant ID
 * @param {number|string} ficheId - Payslip ID
 * @returns {Promise<{success: boolean, buffer?: Buffer, filename?: string, error?: string}>}
 */
export async function generatePayslipPDF(tenantId, ficheId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!ficheId) throw new Error('fiche_id requis');

  try {
    // Fetch payslip from database
    const { data: fiche, error: ficheError } = await supabase
      .from('fiches_paie')
      .select('*')
      .eq('id', ficheId)
      .eq('tenant_id', tenantId)
      .single();

    if (ficheError || !fiche) {
      logger.error('Payslip not found for PDF generation', { tenantId, ficheId, error: ficheError?.message });
      return { success: false, error: 'Fiche de paie non trouvee' };
    }

    // Fetch tenant config
    const tenant = await getTenantConfig(tenantId);

    const filename = `fiche_paie_${fiche.numero || fiche.periode || ficheId}.pdf`;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info('Payslip PDF generated from DB', {
            tenantId,
            ficheId,
            numero: fiche.numero,
            size: buffer.length
          });
          resolve({
            success: true,
            buffer,
            filename,
            contentType: 'application/pdf',
            fiche
          });
        });
        doc.on('error', (err) => {
          logger.error('PDF stream error', { tenantId, ficheId, error: err.message });
          reject({ success: false, error: err.message });
        });

        // Header
        doc.fontSize(24).fillColor('#0891b2').text(tenant.name, { align: 'center' });
        doc.fontSize(10).fillColor('#666').text('Bulletin de Paie', { align: 'center' });
        doc.moveDown(2);

        // Title
        doc.fontSize(16).fillColor('#000').text('FICHE DE PAIE', { align: 'center' });
        doc.moveDown();

        // Period info
        doc.fontSize(12).fillColor('#0891b2');
        doc.text(`Periode: ${fiche.periode || fiche.mois || 'Non specifiee'}`, { align: 'center' });
        doc.moveDown(2);

        // Employee section
        doc.fontSize(12).fillColor('#0891b2').text('SALARIE', { underline: true });
        doc.fontSize(10).fillColor('#333');
        doc.text(`Nom: ${fiche.employe_nom || fiche.nom || 'Non specifie'}`);
        if (fiche.employe_matricule || fiche.matricule) {
          doc.text(`Matricule: ${fiche.employe_matricule || fiche.matricule}`);
        }
        if (fiche.poste) {
          doc.text(`Poste: ${fiche.poste}`);
        }
        doc.moveDown(2);

        // Earnings table
        doc.fontSize(12).fillColor('#0891b2').text('REMUNERATION', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const tableLeft = 50;

        // Table headers
        doc.fontSize(10).fillColor('#666');
        doc.text('Designation', tableLeft, tableTop);
        doc.text('Base', 250, tableTop);
        doc.text('Taux', 320, tableTop);
        doc.text('Montant', 420, tableTop, { width: 100, align: 'right' });

        doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke('#0891b2');

        let yPosition = tableTop + 25;
        doc.fillColor('#333');

        // Salary base
        doc.text('Salaire de base', tableLeft, yPosition);
        doc.text(fiche.heures_travaillees ? `${fiche.heures_travaillees}h` : '-', 250, yPosition);
        doc.text(fiche.taux_horaire ? `${fiche.taux_horaire} EUR/h` : '-', 320, yPosition);
        doc.text(formatMontantEuros(fiche.salaire_brut || fiche.montant_brut), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 20;

        // Overtime if any
        if (fiche.heures_sup && fiche.heures_sup > 0) {
          doc.text('Heures supplementaires', tableLeft, yPosition);
          doc.text(`${fiche.heures_sup}h`, 250, yPosition);
          doc.text(fiche.taux_heures_sup ? `${fiche.taux_heures_sup} EUR/h` : '-', 320, yPosition);
          doc.text(formatMontantEuros(fiche.montant_heures_sup), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        }

        // Bonuses if any
        if (fiche.primes && fiche.primes > 0) {
          doc.text('Primes', tableLeft, yPosition);
          doc.text('-', 250, yPosition);
          doc.text('-', 320, yPosition);
          doc.text(formatMontantEuros(fiche.primes), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 20;
        }

        doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#ccc');
        yPosition += 15;

        // Gross salary
        doc.fontSize(11);
        doc.text('Salaire Brut:', 300, yPosition);
        doc.text(formatMontantEuros(fiche.salaire_brut || fiche.montant_brut), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 25;

        // Deductions section
        doc.fontSize(12).fillColor('#0891b2').text('COTISATIONS', tableLeft, yPosition, { underline: true });
        yPosition += 20;

        doc.fontSize(10).fillColor('#333');

        // Social charges
        if (fiche.cotisations_salariales || fiche.charges_salariales) {
          doc.text('Cotisations salariales', tableLeft, yPosition);
          doc.text('-' + formatMontantEuros(fiche.cotisations_salariales || fiche.charges_salariales), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 18;
        }

        // CSG/CRDS if detailed
        if (fiche.csg) {
          doc.text('CSG/CRDS', tableLeft, yPosition);
          doc.text('-' + formatMontantEuros(fiche.csg), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 18;
        }

        // Other deductions
        if (fiche.autres_retenues && fiche.autres_retenues > 0) {
          doc.text('Autres retenues', tableLeft, yPosition);
          doc.text('-' + formatMontantEuros(fiche.autres_retenues), 420, yPosition, { width: 100, align: 'right' });
          yPosition += 18;
        }

        doc.moveTo(tableLeft, yPosition).lineTo(550, yPosition).stroke('#0891b2');
        yPosition += 15;

        // Net salary
        doc.fontSize(14).fillColor('#0891b2');
        doc.text('NET A PAYER:', 300, yPosition);
        doc.text(formatMontantEuros(fiche.salaire_net || fiche.montant_net), 420, yPosition, { width: 100, align: 'right' });
        yPosition += 30;

        // Payment info
        if (fiche.date_paiement || fiche.mode_paiement) {
          doc.fontSize(10).fillColor('#333');
          if (fiche.mode_paiement) {
            doc.text(`Mode de paiement: ${fiche.mode_paiement}`, tableLeft, yPosition);
            yPosition += 15;
          }
          if (fiche.date_paiement) {
            doc.text(`Date de paiement: ${formatDate(fiche.date_paiement)}`, tableLeft, yPosition);
            yPosition += 15;
          }
        }

        // Employer charges (optional info)
        if (fiche.cotisations_patronales || fiche.charges_patronales) {
          doc.moveDown(2);
          doc.fontSize(9).fillColor('#666');
          doc.text(`Cotisations patronales: ${formatMontantEuros(fiche.cotisations_patronales || fiche.charges_patronales)}`);
          doc.text(`Cout total employeur: ${formatMontantEuros((fiche.salaire_brut || 0) + (fiche.cotisations_patronales || fiche.charges_patronales || 0))}`);
        }

        // Footer
        doc.moveDown(3);
        doc.fontSize(8).fillColor('#999');
        doc.text('Ce document est un bulletin de paie. Conservez-le sans limitation de duree.', { align: 'center' });
        doc.text(`${tenant.name}`, { align: 'center' });
        doc.text(`Document genere le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });

        doc.end();

      } catch (error) {
        logger.error('PDF generation error', { tenantId, ficheId, error: error.message });
        reject({ success: false, error: error.message });
      }
    });

  } catch (error) {
    logger.error('Error generating payslip PDF', { tenantId, ficheId, error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  // Core generation functions (with data)
  generateFacture,
  generateDevis,
  generateRapport,

  // Database-driven generation
  generateInvoicePDF,
  generateQuotePDF,
  generatePayslipPDF,

  // Utility
  getTenantConfig
};
