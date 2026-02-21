/**
 * Job Stock Alertes
 * Vérifie les niveaux de stock et envoie des alertes
 * Plan PRO Feature
 *
 * Utilise la table existante alertes_stock avec:
 * - type_alerte: 'stock_bas', 'stock_zero', 'peremption_proche'
 * - niveau: 'info', 'warning', 'urgent'
 * - vue/resolue pour le statut
 */

import { supabase } from '../config/supabase.js';
import { sendEmail } from '../services/emailService.js';

/**
 * Vérifie tous les produits et crée des alertes si nécessaire
 */
export async function checkStockLevels() {
  console.log('[STOCK-ALERTES] Démarrage vérification stock...');

  try {
    // Récupérer tous les produits avec alertes actives
    const { data: produits, error: errProduits } = await supabase
      .from('produits')
      .select('id, tenant_id, nom, reference, stock_actuel, stock_minimum, seuil_alerte, alerte_active')
      .eq('alerte_active', true)
      .eq('actif', true)
      .order('tenant_id');

    if (errProduits) {
      console.error('[STOCK-ALERTES] Erreur récupération produits:', errProduits);
      return { success: false, error: errProduits.message };
    }

    const alertesCreees = [];

    // Vérifier chaque produit
    for (const produit of produits || []) {
      const seuil = produit.seuil_alerte || produit.stock_minimum || 10;
      const stockActuel = produit.stock_actuel || 0;

      // Vérifier si alerte nécessaire
      if (stockActuel <= seuil) {
        // Vérifier si alerte non résolue existe déjà
        const { data: existingAlerte } = await supabase
          .from('alertes_stock')
          .select('id')
          .eq('tenant_id', produit.tenant_id)  // 🔒 TENANT ISOLATION
          .eq('produit_id', produit.id)
          .eq('resolue', false)
          .single();

        if (!existingAlerte) {
          // Déterminer le type et niveau d'alerte
          const type_alerte = stockActuel === 0 ? 'stock_zero' : 'stock_bas';
          const niveau = stockActuel === 0 ? 'urgent' : (stockActuel <= seuil / 2 ? 'warning' : 'info');
          const message = stockActuel === 0
            ? `Rupture de stock: ${produit.nom}`
            : `Stock bas: ${produit.nom} (${stockActuel}/${seuil})`;

          // Créer l'alerte
          const { data: newAlerte, error: errAlerte } = await supabase
            .from('alertes_stock')
            .insert({
              tenant_id: produit.tenant_id,
              produit_id: produit.id,
              type_alerte,
              niveau,
              message
            })
            .select()
            .single();

          if (errAlerte) {
            console.error(`[STOCK-ALERTES] Erreur création alerte pour produit ${produit.id}:`, errAlerte);
            continue;
          }

          alertesCreees.push({
            alerte: newAlerte,
            produit,
            stockActuel,
            seuil
          });

          console.log(`[STOCK-ALERTES] Alerte créée: ${produit.nom} (${type_alerte}/${niveau}) - Stock: ${stockActuel}/${seuil}`);
        }
      }
    }

    console.log(`[STOCK-ALERTES] Terminé - ${alertesCreees.length} alertes créées`);

    return {
      success: true,
      alertes_creees: alertesCreees.length,
      details: {
        alertes: alertesCreees.map(a => ({
          produit: a.produit.nom,
          type: a.alerte.type_alerte,
          niveau: a.alerte.niveau,
          stock: a.stockActuel
        }))
      }
    };
  } catch (error) {
    console.error('[STOCK-ALERTES] Erreur générale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un email d'alerte stock (optionnel - si configuré)
 */
async function sendStockAlertEmail(tenantId, alertes) {
  try {
    // Récupérer info tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, email')
      .eq('id', tenantId)
      .single();

    if (!tenant?.email) {
      console.log(`[STOCK-ALERTES] Pas d'email configuré pour tenant ${tenantId}`);
      return;
    }

    const salonName = tenant?.name || 'Votre salon';

    // Construire le contenu de l'email
    const ruptures = alertes.filter(a => a.alerte.type_alerte === 'stock_zero');
    const seuilsBas = alertes.filter(a => a.alerte.type_alerte === 'stock_bas');

    let htmlContent = `
      <h2>Alerte Stock - ${salonName}</h2>
      <p>Des produits nécessitent votre attention :</p>
    `;

    if (ruptures.length > 0) {
      htmlContent += `
        <h3 style="color: #DC2626;">🚨 Ruptures de stock (${ruptures.length})</h3>
        <ul>
          ${ruptures.map(r => `
            <li>
              <strong>${r.produit.nom}</strong>
              ${r.produit.reference ? `(Réf: ${r.produit.reference})` : ''}
              - Stock: 0
            </li>
          `).join('')}
        </ul>
      `;
    }

    if (seuilsBas.length > 0) {
      htmlContent += `
        <h3 style="color: #F59E0B;">⚠️ Stock bas (${seuilsBas.length})</h3>
        <ul>
          ${seuilsBas.map(s => `
            <li>
              <strong>${s.produit.nom}</strong>
              ${s.produit.reference ? `(Réf: ${s.produit.reference})` : ''}
              - Stock: ${s.stockActuel} / Seuil: ${s.seuil}
            </li>
          `).join('')}
        </ul>
      `;
    }

    htmlContent += `
      <p style="margin-top: 20px;">
        <a href="${process.env.FRONTEND_URL || 'https://app.nexus.com'}/admin/stock"
           style="background: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Gérer le stock
        </a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;">
      <p style="color: #6B7280; font-size: 12px;">
        Cette notification est générée automatiquement par NEXUS.<br>
        Vous pouvez modifier vos préférences de notification dans les paramètres.
      </p>
    `;

    const subject = ruptures.length > 0
      ? `🚨 URGENT: ${ruptures.length} rupture(s) de stock - ${salonName}`
      : `⚠️ Alerte stock: ${seuilsBas.length} produit(s) à réapprovisionner - ${salonName}`;

    await sendEmail({
      to: tenant.email,
      subject,
      html: htmlContent
    });

    console.log(`[STOCK-ALERTES] Email envoyé à ${tenant.email} pour tenant ${tenantId}`);
  } catch (err) {
    console.error(`[STOCK-ALERTES] Erreur envoi email:`, err.message);
  }
}

/**
 * Récupère le résumé des alertes pour un tenant
 */
export async function getAlertsSummary(tenantId) {
  if (!tenantId) {
    console.error('[STOCK-ALERTES] getAlertsSummary requires tenantId');
    return { total: 0, ruptures: 0, seuils_bas: 0, alertes: [] };
  }

  try {
    const { data, error } = await supabase
      .from('alertes_stock')
      .select(`
        *,
        produits (id, nom, reference, stock_actuel)
      `)
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('resolue', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const ruptures = (data || []).filter(a => a.type_alerte === 'stock_zero');
    const seuilsBas = (data || []).filter(a => a.type_alerte === 'stock_bas');

    return {
      total: data?.length || 0,
      ruptures: ruptures.length,
      seuils_bas: seuilsBas.length,
      alertes: data || []
    };
  } catch (error) {
    console.error('[STOCK-ALERTES] Erreur getSummary:', error);
    return { total: 0, ruptures: 0, seuils_bas: 0, alertes: [] };
  }
}

/**
 * Marque une alerte comme vue
 * @param {string} alerteId - ID de l'alerte
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
export async function marquerVue(alerteId, tenantId) {
  if (!tenantId) {
    console.error('[STOCK-ALERTES] marquerVue requires tenantId');
    return { success: false, error: 'tenant_id requis' };
  }

  try {
    const { data, error } = await supabase
      .from('alertes_stock')
      .update({ vue: true })
      .eq('id', alerteId)
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .select()
      .single();

    if (error) throw error;
    return { success: true, alerte: data };
  } catch (error) {
    console.error('[STOCK-ALERTES] Erreur marquerVue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Résout une alerte (stock réapprovisionné)
 * @param {string} alerteId - ID de l'alerte
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
export async function resoudreAlerte(alerteId, tenantId) {
  if (!tenantId) {
    console.error('[STOCK-ALERTES] resoudreAlerte requires tenantId');
    return { success: false, error: 'tenant_id requis' };
  }

  try {
    const { data, error } = await supabase
      .from('alertes_stock')
      .update({
        resolue: true,
        date_resolution: new Date().toISOString()
      })
      .eq('id', alerteId)
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .select()
      .single();

    if (error) throw error;

    console.log(`[STOCK-ALERTES] Alerte ${alerteId} résolue`);
    return { success: true, alerte: data };
  } catch (error) {
    console.error('[STOCK-ALERTES] Erreur resoudreAlerte:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Résout toutes les alertes d'un produit (après réapprovisionnement)
 * @param {string} produitId - ID du produit
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
export async function resoudreAlerteProduit(produitId, tenantId) {
  if (!tenantId) {
    console.error('[STOCK-ALERTES] resoudreAlerteProduit requires tenantId');
    return { success: false, error: 'tenant_id requis' };
  }

  try {
    const { data, error } = await supabase
      .from('alertes_stock')
      .update({
        resolue: true,
        date_resolution: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('produit_id', produitId)
      .eq('resolue', false)
      .select();

    if (error) throw error;

    console.log(`[STOCK-ALERTES] ${data?.length || 0} alertes résolues pour produit ${produitId}`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('[STOCK-ALERTES] Erreur resoudreAlerteProduit:', error);
    return { success: false, error: error.message };
  }
}

export default {
  checkStockLevels,
  getAlertsSummary,
  marquerVue,
  resoudreAlerte,
  resoudreAlerteProduit
};
