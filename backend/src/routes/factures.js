/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES FACTURES - Gestion des factures et envoi PDF             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { generateFacture } from '../services/pdfService.js';

const router = express.Router();
router.use(authenticateAdmin);

// ============================================
// HELPER: GÉNÉRATION ÉCRITURES COMPTABLES
// ============================================

/**
 * Formate le compte auxiliaire client (411XXXXX)
 * @param {number} clientId - ID du client
 * @returns {string} Compte auxiliaire formaté (ex: '41100001', '41100042')
 *
 * 🔧 FIXED: Uniformisé avec journaux.js - 5 chiffres pour le suffix
 */
function getCompteAuxiliaireClient(clientId) {
  if (!clientId) return '41100000'; // Compte collectif par défaut
  // Format: 411 + ID client sur 5 chiffres (ex: 41100001)
  return `411${String(clientId).padStart(5, '0')}`;
}

/**
 * Génère les écritures comptables pour une facture (VT + BQ si payée)
 */
async function genererEcrituresFacture(tenantId, factureId) {
  try {
    // Récupérer la facture
    const { data: facture, error: errFact } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('tenant_id', tenantId)
      .single();

    if (errFact || !facture) {
      console.error('[FACTURES] Facture non trouvée pour écritures:', factureId);
      return;
    }

    // GUARD: ne jamais appeler genererEcrituresFacture sur un avoir
    if (facture.type === 'avoir') {
      console.log(`[FACTURES] Facture ${factureId} est un avoir — genererEcrituresFacture ignoré`);
      return;
    }

    // IMMUTABILITE: si des écritures VT existent déjà, ne pas les recréer
    const { data: existingEcritures } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('facture_id', factureId)
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'VT')
      .limit(1);

    if (existingEcritures && existingEcritures.length > 0) {
      console.log(`[FACTURES] Écritures VT déjà existantes pour facture ${factureId} — immutable`);
      return;
    }

    const dateFacture = facture.date_facture;
    const periode = dateFacture?.slice(0, 7);
    const exercice = parseInt(dateFacture?.slice(0, 4)) || new Date().getFullYear();
    const montantTTC = facture.montant_ttc || 0;
    const montantHT = facture.montant_ht || montantTTC;
    const montantTVA = facture.montant_tva || (montantTTC - montantHT);

    const ecritures = [];

    // Journal VT - Écriture de vente
    // Débit 411XXX Client (compte auxiliaire)
    const compteClient = getCompteAuxiliaireClient(facture.client_id);
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: compteClient,
      compte_libelle: `Client ${facture.client_nom || facture.client_id}`,
      libelle: `Facture ${facture.numero} - ${facture.client_nom || 'Client'}`,
      debit: montantTTC,
      credit: 0,
      facture_id: factureId,
      periode,
      exercice
    });

    // Crédit 706 Prestations
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '706',
      compte_libelle: 'Prestations de services',
      libelle: `Facture ${facture.numero}`,
      debit: 0,
      credit: montantHT,
      facture_id: factureId,
      periode,
      exercice
    });

    // Crédit 44571 TVA collectée
    if (montantTVA > 0) {
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'VT',
        date_ecriture: dateFacture,
        numero_piece: facture.numero,
        compte_numero: '44571',
        compte_libelle: 'TVA collectée',
        libelle: `TVA ${facture.numero}`,
        debit: 0,
        credit: montantTVA,
        facture_id: factureId,
        periode,
        exercice
      });
    }

    // Si facture payée, écriture banque
    if (facture.statut === 'payee') {
      const datePaiement = facture.date_paiement?.split('T')[0] || dateFacture;
      const periodePaie = datePaiement?.slice(0, 7);

      // Journal BQ - Encaissement
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Encaissement ${facture.numero} - ${facture.client_nom || 'Client'}`,
        debit: montantTTC,
        credit: 0,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      });

      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: compteClient,
        compte_libelle: `Client ${facture.client_nom || facture.client_id}`,
        libelle: `Règlement ${facture.numero}`,
        debit: 0,
        credit: montantTTC,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      });
    }

    if (ecritures.length > 0) {
      const { error } = await supabase
        .from('ecritures_comptables')
        .insert(ecritures);

      if (error) {
        console.error('[FACTURES] Erreur insertion écritures:', error);
      } else {
        console.log(`[FACTURES] ${ecritures.length} écritures générées pour facture ${facture.numero}`);
      }
    }
  } catch (err) {
    console.error('[FACTURES] Erreur génération écritures:', err);
  }
}

// ============================================
// SYSTÈME D'AVOIRS (NOTES DE CRÉDIT)
// ============================================

/**
 * Génère un numéro d'avoir unique
 * Format: AV-{PREFIX}-{YEAR}-{SEQUENCE:5}
 */
async function generateNumeroAvoir(tenantId) {
  const year = new Date().getFullYear();
  const prefix = tenantId.substring(0, 3).toUpperCase();

  const { data: lastAvoir } = await supabase
    .from('factures')
    .select('numero')
    .eq('tenant_id', tenantId)
    .eq('type', 'avoir')
    .like('numero', `AV-${prefix}-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;
  if (lastAvoir?.numero) {
    const match = lastAvoir.numero.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `AV-${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Génère les écritures comptables VT inversées pour un avoir
 * PAS d'écritures BQ/CA (pas de mouvement bancaire)
 */
async function genererEcrituresAvoir(tenantId, avoir, factureOriginale) {
  try {
    const dateAvoir = avoir.date_facture;
    const periode = dateAvoir?.slice(0, 7);
    const exercice = parseInt(dateAvoir?.slice(0, 4)) || new Date().getFullYear();
    const montantTTC = Math.abs(avoir.montant_ttc || 0);
    const montantHT = Math.abs(avoir.montant_ht || montantTTC);
    const montantTVA = Math.abs(avoir.montant_tva || (montantTTC - montantHT));

    const compteClient = getCompteAuxiliaireClient(factureOriginale.client_id);

    const ecritures = [];

    // Journal VT inversé — CREDIT 411XXX (réduire créance client)
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateAvoir,
      numero_piece: avoir.numero,
      compte_numero: compteClient,
      compte_libelle: `Client ${avoir.client_nom || factureOriginale.client_id}`,
      libelle: `Avoir ${avoir.numero} (ref: ${factureOriginale.numero})`,
      debit: 0,
      credit: montantTTC,
      facture_id: avoir.id,
      periode,
      exercice
    });

    // DEBIT 706 Prestations (réduire CA)
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateAvoir,
      numero_piece: avoir.numero,
      compte_numero: '706',
      compte_libelle: 'Prestations de services',
      libelle: `Avoir ${avoir.numero}`,
      debit: montantHT,
      credit: 0,
      facture_id: avoir.id,
      periode,
      exercice
    });

    // DEBIT 44571 TVA collectée (réduire TVA)
    if (montantTVA > 0) {
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'VT',
        date_ecriture: dateAvoir,
        numero_piece: avoir.numero,
        compte_numero: '44571',
        compte_libelle: 'TVA collectée',
        libelle: `TVA avoir ${avoir.numero}`,
        debit: montantTVA,
        credit: 0,
        facture_id: avoir.id,
        periode,
        exercice
      });
    }

    if (ecritures.length > 0) {
      const { error } = await supabase
        .from('ecritures_comptables')
        .insert(ecritures);

      if (error) {
        console.error('[AVOIRS] Erreur insertion écritures avoir:', error);
      } else {
        console.log(`[AVOIRS] ${ecritures.length} écritures VT inversées générées pour avoir ${avoir.numero}`);
      }
    }
  } catch (err) {
    console.error('[AVOIRS] Erreur génération écritures avoir:', err);
  }
}

/**
 * Crée un avoir (note de crédit) pour une facture existante
 * @param {string} tenantId - ID du tenant
 * @param {number} factureOrigineId - ID de la facture originale
 * @param {string} motif - Motif de l'avoir (obligatoire)
 * @returns {Promise<{success: boolean, avoir?: object, error?: string}>}
 */
export async function createAvoir(tenantId, factureOrigineId, motif) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!factureOrigineId) throw new Error('facture_origine_id requis');
  if (!motif || !motif.trim()) throw new Error('motif requis');

  try {
    // 1. Lire facture originale (🔒 TENANT ISOLATION)
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureOrigineId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return { success: false, error: 'Facture originale non trouvée' };
    }

    // 2. Validations
    if (facture.type === 'avoir') {
      return { success: false, error: 'Impossible de créer un avoir sur un avoir' };
    }

    if (facture.avoir_emis) {
      return { success: false, error: 'Un avoir total a déjà été émis pour cette facture' };
    }

    const statutsEmis = ['generee', 'envoyee', 'payee'];
    if (!statutsEmis.includes(facture.statut)) {
      return { success: false, error: `Impossible de créer un avoir sur une facture en statut "${facture.statut}"` };
    }

    // 3. Calculer le net restant (facture - avoirs partiels existants)
    const { data: avoirsExistants } = await supabase
      .from('factures')
      .select('montant_ttc, montant_ht, montant_tva')
      .eq('facture_origine_id', factureOrigineId)
      .eq('tenant_id', tenantId)
      .eq('type', 'avoir');

    // Somme des avoirs partiels déjà émis (montants négatifs en DB)
    const totalAvoirsTTC = (avoirsExistants || []).reduce((sum, a) => sum + Math.abs(a.montant_ttc || 0), 0);
    const totalAvoirsHT = (avoirsExistants || []).reduce((sum, a) => sum + Math.abs(a.montant_ht || 0), 0);
    const totalAvoirsTVA = (avoirsExistants || []).reduce((sum, a) => sum + Math.abs(a.montant_tva || 0), 0);

    // Net restant à annuler
    const netTTC = (facture.montant_ttc || 0) - totalAvoirsTTC;
    const netHT = (facture.montant_ht || 0) - totalAvoirsHT;
    const netTVA = (facture.montant_tva || 0) - totalAvoirsTVA;

    if (netTTC <= 0) {
      console.log(`[AVOIRS] Facture ${facture.numero} déjà entièrement couverte par des avoirs partiels (net: ${netTTC/100}€)`);
      // Marquer avoir_emis même si net = 0
      await supabase.from('factures').update({ avoir_emis: true }).eq('id', factureOrigineId).eq('tenant_id', tenantId);
      return { success: true, avoir: null, message: 'Facture déjà couverte par des avoirs existants' };
    }

    // 4. Générer numéro d'avoir
    const numero = await generateNumeroAvoir(tenantId);

    // 5. Insérer l'avoir pour le NET restant (pas le montant total de la facture)
    const avoirDescription = totalAvoirsTTC > 0
      ? `Avoir ref. ${facture.numero} — ${motif.trim()} (net après ${avoirsExistants.length} avoir(s) partiel(s))`
      : facture.service_description;

    const { data: avoir, error: insertError } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        type: 'avoir',
        facture_origine_id: factureOrigineId,
        motif_avoir: motif.trim(),
        reservation_id: facture.reservation_id,
        client_id: facture.client_id,
        client_nom: facture.client_nom,
        client_email: facture.client_email,
        client_telephone: facture.client_telephone,
        client_adresse: facture.client_adresse,
        service_nom: facture.service_nom,
        service_description: avoirDescription,
        date_prestation: facture.date_prestation,
        montant_ht: -netHT,
        taux_tva: facture.taux_tva,
        montant_tva: -netTVA,
        montant_ttc: -netTTC,
        frais_deplacement: 0,
        statut: 'generee',
        date_facture: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 6. Marquer facture originale comme avoir_emis (total)
    const { error: updateError } = await supabase
      .from('factures')
      .update({ avoir_emis: true })
      .eq('id', factureOrigineId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[AVOIRS] Erreur marquage avoir_emis:', updateError);
    }

    // 7. Générer écritures VT inversées (pas de BQ/CA)
    await genererEcrituresAvoir(tenantId, avoir, facture);

    const logExtra = totalAvoirsTTC > 0
      ? ` (net: ${(netTTC/100).toFixed(2)}€ après ${(totalAvoirsTTC/100).toFixed(2)}€ d'avoirs partiels)`
      : '';
    console.log(`[AVOIRS] Avoir ${numero} créé pour facture ${facture.numero}${logExtra} (motif: ${motif})`);
    return { success: true, avoir };
  } catch (error) {
    console.error('[AVOIRS] Erreur création avoir:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Crée un avoir PARTIEL (note de crédit pour la différence uniquement)
 * Utilisé quand le prix d'une prestation baisse après facturation
 * @param {string} tenantId
 * @param {number} factureOrigineId - ID de la facture originale
 * @param {number} montantDiffTTC - Montant de la baisse en centimes (positif)
 * @param {string} motif - Ex: "Correction prix: 120.00€ → 100.00€"
 */
export async function createAvoirPartiel(tenantId, factureOrigineId, montantDiffTTC, motif) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!factureOrigineId) throw new Error('facture_origine_id requis');
  if (!montantDiffTTC || montantDiffTTC <= 0) throw new Error('montant_diff_ttc doit être positif');

  try {
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureOrigineId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return { success: false, error: 'Facture originale non trouvée' };
    }

    if (facture.type === 'avoir') {
      return { success: false, error: 'Impossible de créer un avoir sur un avoir' };
    }

    if (facture.avoir_emis) {
      return { success: false, error: 'Un avoir total a déjà été émis pour cette facture' };
    }

    const statutsEmis = ['generee', 'envoyee', 'payee'];
    if (!statutsEmis.includes(facture.statut)) {
      return { success: false, error: `Facture non émise (statut: ${facture.statut})` };
    }

    // Vérifier que le montant ne dépasse pas le net restant
    const { data: avoirsExistants } = await supabase
      .from('factures')
      .select('montant_ttc')
      .eq('facture_origine_id', factureOrigineId)
      .eq('tenant_id', tenantId)
      .eq('type', 'avoir');

    const totalAvoirsTTC = (avoirsExistants || []).reduce((sum, a) => sum + Math.abs(a.montant_ttc || 0), 0);
    const netRestant = (facture.montant_ttc || 0) - totalAvoirsTTC;

    if (montantDiffTTC > netRestant) {
      return { success: false, error: `Montant trop élevé. Net restant: ${(netRestant/100).toFixed(2)}€` };
    }

    // Calculer HT/TVA proportionnellement
    const tauxTVA = facture.taux_tva || 20;
    const diffHT = Math.round(montantDiffTTC / (1 + tauxTVA / 100));
    const diffTVA = montantDiffTTC - diffHT;

    const numero = await generateNumeroAvoir(tenantId);

    const { data: avoir, error: insertError } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        type: 'avoir',
        facture_origine_id: factureOrigineId,
        motif_avoir: motif,
        reservation_id: facture.reservation_id,
        client_id: facture.client_id,
        client_nom: facture.client_nom,
        client_email: facture.client_email,
        client_telephone: facture.client_telephone,
        client_adresse: facture.client_adresse,
        service_nom: facture.service_nom,
        service_description: `Avoir partiel ref. ${facture.numero} — ${motif}`,
        date_prestation: facture.date_prestation,
        montant_ht: -diffHT,
        taux_tva: tauxTVA,
        montant_tva: -diffTVA,
        montant_ttc: -montantDiffTTC,
        frais_deplacement: 0,
        statut: 'generee',
        date_facture: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Avoir partiel : NE PAS marquer avoir_emis (facture toujours partiellement valide)
    await genererEcrituresAvoir(tenantId, avoir, facture);

    console.log(`[AVOIRS] Avoir partiel ${numero}: -${(montantDiffTTC/100).toFixed(2)}€ (ref: ${facture.numero})`);
    return { success: true, avoir };
  } catch (error) {
    console.error('[AVOIRS] Erreur création avoir partiel:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Crée une facture COMPLÉMENTAIRE (supplément)
 * Utilisé quand le prix d'une prestation augmente après facturation
 * @param {string} tenantId
 * @param {number} factureOrigineId - ID de la facture originale
 * @param {number} montantDiffTTC - Montant de la hausse en centimes (positif)
 * @param {string} motif - Ex: "Augmentation prix: 100.00€ → 120.00€"
 */
export async function createFactureComplementaire(tenantId, factureOrigineId, montantDiffTTC, motif) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!factureOrigineId) throw new Error('facture_origine_id requis');
  if (!montantDiffTTC || montantDiffTTC <= 0) throw new Error('montant_diff_ttc doit être positif');

  try {
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureOrigineId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return { success: false, error: 'Facture originale non trouvée' };
    }

    // Calculer HT/TVA proportionnellement
    const tauxTVA = facture.taux_tva || 20;
    const diffHT = Math.round(montantDiffTTC / (1 + tauxTVA / 100));
    const diffTVA = montantDiffTTC - diffHT;

    const numero = await generateNumeroFacture(tenantId);

    const { data: complement, error: insertError } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        type: 'facture',
        facture_origine_id: factureOrigineId,
        reservation_id: facture.reservation_id,
        client_id: facture.client_id,
        client_nom: facture.client_nom,
        client_email: facture.client_email,
        client_telephone: facture.client_telephone,
        client_adresse: facture.client_adresse,
        service_nom: facture.service_nom,
        service_description: `Complément ref. ${facture.numero} — ${motif}`,
        date_prestation: facture.date_prestation,
        montant_ht: diffHT,
        taux_tva: tauxTVA,
        montant_tva: diffTVA,
        montant_ttc: montantDiffTTC,
        frais_deplacement: 0,
        statut: 'generee',
        date_facture: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Générer écritures VT normales
    await genererEcrituresFacture(tenantId, complement.id);

    console.log(`[FACTURES] Complément ${numero}: +${(montantDiffTTC/100).toFixed(2)}€ (ref: ${facture.numero})`);
    return { success: true, facture: complement };
  } catch (error) {
    console.error('[FACTURES] Erreur création facture complémentaire:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Génère un numéro de facture unique
 * Format: {PREFIX}-{YEAR}-{SEQUENCE:5}
 */
async function generateNumeroFacture(tenantId) {
  const year = new Date().getFullYear();

  // Récupérer le préfixe du tenant (3 premières lettres)
  const prefix = tenantId.substring(0, 3).toUpperCase();

  // Récupérer le dernier numéro de facture de l'année
  const { data: lastFacture } = await supabase
    .from('factures')
    .select('numero')
    .eq('tenant_id', tenantId)
    .like('numero', `${prefix}-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;
  if (lastFacture?.numero) {
    // Extraire le numéro de séquence du dernier numéro
    const match = lastFacture.numero.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Crée automatiquement une facture depuis une réservation
 * @param {number} reservationId - ID de la réservation
 * @param {string} tenantId - ID du tenant
 * @param {object} options - Options
 * @param {string} options.statut - Statut initial ('brouillon', 'generee', 'envoyee', 'payee')
 * @param {boolean} options.updateIfExists - Si true, met à jour la facture existante au lieu de retourner
 */
export async function createFactureFromReservation(reservationId, tenantId, options = {}) {
  const { statut = 'generee', updateIfExists = false } = options;

  try {
    // Vérifier si une facture existe déjà (🔒 TENANT ISOLATION)
    // Filtrer type='facture' pour exclure les avoirs liés à la même réservation
    const { data: existing } = await supabase
      .from('factures')
      .select('id, statut, montant_ttc')
      .eq('reservation_id', reservationId)
      .eq('tenant_id', tenantId)
      .eq('type', 'facture')
      .single();

    if (existing) {
      // IMMUTABILITE: une facture émise ne peut JAMAIS être modifiée
      // Seul un avoir (note de crédit) permet de corriger
      const statutsImmutables = ['generee', 'envoyee', 'payee'];
      if (statutsImmutables.includes(existing.statut)) {
        console.log(`[FACTURES] Facture ${existing.id} immutable (statut: ${existing.statut}) — aucune modification`);
        return { success: true, facture: existing, message: 'Facture déjà existante (immutable)' };
      }

      // Brouillon: autoriser uniquement le changement de statut (pas les montants)
      if (updateIfExists && existing.statut === 'brouillon' && statut !== existing.statut) {
        const { data: updated, error: updateError } = await supabase
          .from('factures')
          .update({ statut, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (updateError) throw updateError;
        console.log(`[FACTURES] Facture brouillon ${existing.id} statut mis à jour: ${existing.statut} → ${statut}`);
        return { success: true, facture: updated, message: 'Facture mise à jour' };
      }

      return { success: true, facture: existing, message: 'Facture déjà existante' };
    }

    // Récupérer la réservation avec les détails
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        clients(id, nom, prenom, email, telephone, type_client, raison_sociale)
      `)
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (resError || !reservation) {
      throw new Error(`Réservation non trouvée: ${resError?.message || 'data is null'}`);
    }

    // Calculer les montants
    // Certaines réservations ont le prix en centimes, d'autres en euros
    // Si prix < 1000, c'est probablement en euros → convertir en centimes
    let prixTTC = reservation.prix_total || reservation.prix_service || 0;
    let fraisDeplacement = reservation.frais_deplacement || 0;

    // Convertir en centimes si le prix semble être en euros (< 1000)
    if (prixTTC > 0 && prixTTC < 1000) {
      prixTTC = prixTTC * 100;
    }
    if (fraisDeplacement > 0 && fraisDeplacement < 1000) {
      fraisDeplacement = fraisDeplacement * 100;
    }

    const tauxTVA = reservation.taux_tva || 20;

    // Total TTC incluant frais déplacement (en centimes)
    const totalTTC = prixTTC + fraisDeplacement;
    const totalHT = Math.round(totalTTC / (1 + tauxTVA / 100));
    const totalTVA = totalTTC - totalHT;

    // Générer le numéro
    const numero = await generateNumeroFacture(tenantId);

    // Créer la facture
    const { data: facture, error } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        reservation_id: reservationId,
        client_id: reservation.client_id,
        client_nom: reservation.clients
          ? (reservation.clients.type_client === 'professionnel' && reservation.clients.raison_sociale
              ? reservation.clients.raison_sociale
              : `${reservation.clients.prenom} ${reservation.clients.nom}`)
          : reservation.client_nom || 'Client',
        client_email: reservation.clients?.email || reservation.client_email,
        client_telephone: reservation.clients?.telephone || reservation.client_telephone,
        client_adresse: null,
        service_nom: reservation.service_nom || 'Prestation',
        service_description: reservation.notes || null,
        date_prestation: reservation.date,
        montant_ht: totalHT,
        taux_tva: tauxTVA,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        frais_deplacement: fraisDeplacement,
        statut: statut,
        date_facture: reservation.date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    // Générer les écritures comptables
    await genererEcrituresFacture(tenantId, facture.id);

    console.log(`[FACTURES] Facture ${numero} créée (statut: ${statut}) pour réservation ${reservationId}`);
    return { success: true, facture };
  } catch (error) {
    console.error('[FACTURES] Erreur création auto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour le statut d'une facture liée à une réservation
 */
export async function updateFactureStatutFromReservation(reservationId, tenantId, newStatut) {
  try {
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('id, statut')
      .eq('reservation_id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      console.log(`[FACTURES] Pas de facture trouvée pour réservation ${reservationId}`);
      return { success: false, error: 'Facture non trouvée' };
    }

    const { data: updated, error } = await supabase
      .from('factures')
      .update({
        statut: newStatut,
        updated_at: new Date().toISOString()
      })
      .eq('id', facture.id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[FACTURES] Facture ${updated.numero} mise à jour: ${facture.statut} → ${newStatut}`);
    return { success: true, facture: updated };
  } catch (error) {
    console.error('[FACTURES] Erreur mise à jour statut:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Supprime ou annule la facture liée à une réservation
 */
export async function cancelFactureFromReservation(reservationId, tenantId, deleteFacture = false) {
  try {
    // Filtrer type='facture' pour exclure les avoirs liés à la même réservation
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('reservation_id', reservationId)
      .eq('tenant_id', tenantId)
      .eq('type', 'facture')
      .single();

    if (fetchError || !facture) {
      console.log(`[FACTURES] Pas de facture à annuler pour réservation ${reservationId}`);
      return { success: true, message: 'Pas de facture associée' };
    }

    // IMMUTABILITE: factures émises nécessitent un avoir
    const statutsImmutables = ['generee', 'envoyee', 'payee'];
    if (statutsImmutables.includes(facture.statut)) {
      console.log(`[FACTURES] Facture ${facture.numero} immutable (${facture.statut}) — avoir requis`);
      return { success: false, requiresAvoir: true, factureId: facture.id, error: 'Facture émise, un avoir est requis pour corriger' };
    }

    // Brouillon: autoriser suppression/annulation
    if (deleteFacture) {
      const { error } = await supabase
        .from('factures')
        .delete()
        .eq('id', facture.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      console.log(`[FACTURES] Facture brouillon ${facture.numero} supprimée`);
      return { success: true, message: 'Facture supprimée' };
    } else {
      const { data: updated, error } = await supabase
        .from('factures')
        .update({
          statut: 'annulee',
          updated_at: new Date().toISOString()
        })
        .eq('id', facture.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      console.log(`[FACTURES] Facture brouillon ${facture.numero} annulée`);
      return { success: true, facture: updated };
    }
  } catch (error) {
    console.error('[FACTURES] Erreur annulation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/factures
 * Liste des factures avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois, statut, limit = 1000 } = req.query;

    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_prestation', { ascending: false })
      .limit(parseInt(limit));

    // Filtre par mois
    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_facture', startDate).lte('date_facture', endDate);
    }

    // Filtre par statut
    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrichir les factures sans service_id avec celui de la réservation
    const reservationIds = data
      .filter(f => !f.service_id && f.reservation_id)
      .map(f => f.reservation_id);

    if (reservationIds.length > 0) {
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, service_id')
        .eq('tenant_id', tenantId)
        .in('id', reservationIds);

      const resMap = new Map(reservations?.map(r => [r.id, r.service_id]) || []);

      data.forEach(f => {
        if (!f.service_id && f.reservation_id && resMap.has(f.reservation_id)) {
          const serviceId = resMap.get(f.reservation_id);
          if (serviceId) {
            f.service_id = serviceId;
          }
        }
      });
    }

    // 2ème passe: matcher par service_nom pour les factures sans service_id
    const facturesSansService = data.filter(f => !f.service_id && f.service_nom);
    if (facturesSansService.length > 0) {
      const serviceNoms = [...new Set(facturesSansService.map(f => f.service_nom))];
      const { data: services } = await supabase
        .from('services')
        .select('id, nom')
        .eq('tenant_id', tenantId)
        .in('nom', serviceNoms);

      if (services && services.length > 0) {
        const serviceMap = new Map(services.map(s => [s.nom.toLowerCase().trim(), s.id]));
        facturesSansService.forEach(f => {
          const serviceId = serviceMap.get(f.service_nom?.toLowerCase().trim());
          if (serviceId) {
            f.service_id = serviceId;
          }
        });
      }
    }

    // Formater les factures
    const factures = data.map(f => ({
      ...f,
      montant_ht_euros: (f.montant_ht / 100).toFixed(2),
      montant_tva_euros: (f.montant_tva / 100).toFixed(2),
      montant_ttc_euros: (f.montant_ttc / 100).toFixed(2),
      frais_deplacement_euros: ((f.frais_deplacement || 0) / 100).toFixed(2)
    }));

    // Stats
    const total_ttc = data.reduce((sum, f) => sum + f.montant_ttc, 0);
    const total_tva = data.reduce((sum, f) => sum + f.montant_tva, 0);
    const nb_envoyees = data.filter(f => f.statut === 'envoyee' || f.statut === 'payee').length;
    const nb_en_attente = data.filter(f => f.statut === 'generee').length;

    res.json({
      success: true,
      factures,
      stats: {
        total: data.length,
        total_ttc_euros: (total_ttc / 100).toFixed(2),
        total_tva_euros: (total_tva / 100).toFixed(2),
        nb_envoyees,
        nb_en_attente
      }
    });
  } catch (error) {
    console.error('[FACTURES] Erreur liste:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/factures/:id
 * Détail d'une facture
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      facture: {
        ...data,
        montant_ht_euros: (data.montant_ht / 100).toFixed(2),
        montant_tva_euros: (data.montant_tva / 100).toFixed(2),
        montant_ttc_euros: (data.montant_ttc / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[FACTURES] Erreur détail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/:id/envoyer
 * Envoyer une facture par email (PDF)
 */
router.post('/:id/envoyer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer la facture
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (!facture.client_email) {
      return res.status(400).json({ success: false, error: 'Pas d\'email client' });
    }

    // TODO: Générer le PDF et l'envoyer par email
    // Pour l'instant, on simule l'envoi

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('factures')
      .update({
        statut: 'envoyee',
        date_envoi: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Facture ${facture.numero} envoyée à ${facture.client_email}`
    });
  } catch (error) {
    console.error('[FACTURES] Erreur envoi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/envoyer-toutes
 * Envoyer toutes les factures en attente
 */
router.post('/envoyer-toutes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.body;

    // Récupérer les factures en attente
    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('statut', 'generee')
      .not('client_email', 'is', null);

    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_facture', startDate).lte('date_facture', endDate);
    }

    const { data: factures, error } = await query;
    if (error) throw error;

    if (!factures || factures.length === 0) {
      return res.json({ success: true, message: 'Aucune facture à envoyer', nb_envoyees: 0 });
    }

    // Envoyer chaque facture
    const resultats = [];
    for (const facture of factures) {
      try {
        // TODO: Générer et envoyer le PDF

        // Mettre à jour le statut
        await supabase
          .from('factures')
          .update({
            statut: 'envoyee',
            date_envoi: new Date().toISOString()
          })
          .eq('id', facture.id);

        resultats.push({ id: facture.id, numero: facture.numero, success: true });
      } catch (err) {
        resultats.push({ id: facture.id, numero: facture.numero, success: false, error: err.message });
      }
    }

    const nbSuccess = resultats.filter(r => r.success).length;

    res.json({
      success: true,
      message: `${nbSuccess}/${factures.length} factures envoyées`,
      nb_envoyees: nbSuccess,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES] Erreur envoi multiple:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/factures/:id/statut
 * Changer le statut d'une facture
 * @param {string} statut - Nouveau statut
 * @param {string} mode_paiement - Mode de paiement (requis si statut = payee): especes, cb, virement, prelevement, cheque
 */
router.patch('/:id/statut', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { statut, mode_paiement } = req.body;

    const statutsValides = ['brouillon', 'generee', 'envoyee', 'payee', 'annulee'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    // Mode de paiement requis pour marquer comme payée
    const modesPaiementValides = ['especes', 'cb', 'virement', 'prelevement', 'cheque'];
    if (statut === 'payee' && mode_paiement && !modesPaiementValides.includes(mode_paiement)) {
      return res.status(400).json({ success: false, error: 'Mode de paiement invalide' });
    }

    const updates = { statut };
    if (statut === 'payee') {
      updates.date_paiement = new Date().toISOString();
      // Mode de paiement par défaut: CB si non spécifié (rétrocompatibilité)
      updates.mode_paiement = mode_paiement || 'cb';
    }

    const { data, error } = await supabase
      .from('factures')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Régénérer les écritures comptables (notamment pour ajouter les écritures BQ/CA si payée)
    // genererEcrituresFacture ignore les avoirs via son guard interne
    await genererEcrituresFacture(tenantId, parseInt(id));

    res.json({ success: true, facture: data });
  } catch (error) {
    console.error('[FACTURES] Erreur changement statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/:id/paiement
 * Enregistrer le paiement d'une facture
 * @body {string} mode_paiement - Mode de paiement: especes, cb, virement, prelevement, cheque
 * @body {string} date_paiement - Date du paiement (optionnel, défaut: maintenant)
 * @body {string} reference_paiement - Référence du paiement (optionnel)
 */
router.post('/:id/paiement', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { mode_paiement, date_paiement, reference_paiement } = req.body;

    // Validation mode de paiement
    const modesPaiementValides = ['especes', 'cb', 'virement', 'prelevement', 'cheque'];
    if (!mode_paiement || !modesPaiementValides.includes(mode_paiement)) {
      return res.status(400).json({
        success: false,
        error: `Mode de paiement requis. Valeurs acceptées: ${modesPaiementValides.join(', ')}`
      });
    }

    // Récupérer la facture
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (facture.statut === 'payee') {
      return res.status(400).json({ success: false, error: 'Cette facture est déjà payée' });
    }

    if (facture.statut === 'annulee') {
      return res.status(400).json({ success: false, error: 'Impossible de payer une facture annulée' });
    }

    // Date de paiement (défaut: maintenant)
    const datePaiementEffective = date_paiement || new Date().toISOString();

    // Mettre à jour la facture
    const { data: factureUpdated, error: updateError } = await supabase
      .from('factures')
      .update({
        statut: 'payee',
        mode_paiement,
        date_paiement: datePaiementEffective,
        reference_paiement: reference_paiement || null
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Générer les écritures comptables BQ ou CA (règlement)
    await genererEcrituresPaiement(tenantId, facture, mode_paiement, datePaiementEffective);

    // Fermer la relance si existante
    await supabase
      .from('relances_factures')
      .update({ statut: 'payee', date_cloture: new Date().toISOString() })
      .eq('facture_id', id)
      .eq('tenant_id', tenantId);

    console.log(`[FACTURES] Paiement enregistré: Facture ${facture.numero} (${mode_paiement})`);

    res.json({
      success: true,
      facture: factureUpdated,
      message: `Paiement de ${(facture.montant_ttc / 100).toFixed(2)}€ enregistré`
    });
  } catch (error) {
    console.error('[FACTURES] Erreur enregistrement paiement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Génère les écritures comptables pour le règlement d'une facture (BQ ou CA)
 */
export async function genererEcrituresPaiement(tenantId, facture, mode_paiement, datePaiement) {
  try {
    // Déterminer le journal et le compte selon le mode de paiement
    const journalCode = mode_paiement === 'especes' ? 'CA' : 'BQ';
    const compteBank = mode_paiement === 'especes' ? '530' : '512';
    const compteLibelle = mode_paiement === 'especes' ? 'Caisse' : 'Banque';

    const dateEcriture = datePaiement?.split('T')[0] || new Date().toISOString().split('T')[0];
    const periode = dateEcriture?.slice(0, 7);
    const exercice = parseInt(dateEcriture?.slice(0, 4)) || new Date().getFullYear();
    const montantTTC = facture.montant_ttc || 0;

    // Compte auxiliaire client (411XXX)
    const compteClient = getCompteAuxiliaireClient(facture.client_id);

    const ecritures = [
      // Débit Banque/Caisse
      {
        tenant_id: tenantId,
        journal_code: journalCode,
        date_ecriture: dateEcriture,
        numero_piece: facture.numero,
        compte_numero: compteBank,
        compte_libelle: compteLibelle,
        libelle: `Règlement ${facture.numero} - ${facture.client_nom || 'Client'}`,
        debit: montantTTC,
        credit: 0,
        facture_id: facture.id,
        periode,
        exercice
      },
      // Crédit Client auxiliaire (solde la créance)
      {
        tenant_id: tenantId,
        journal_code: journalCode,
        date_ecriture: dateEcriture,
        numero_piece: facture.numero,
        compte_numero: compteClient,
        compte_libelle: `Client ${facture.client_nom || facture.client_id}`,
        libelle: `Règlement ${facture.numero}`,
        debit: 0,
        credit: montantTTC,
        facture_id: facture.id,
        periode,
        exercice
      }
    ];

    const { error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures);

    if (error) {
      console.error('[FACTURES] Erreur insertion écritures paiement:', error);
    } else {
      console.log(`[FACTURES] Écritures ${journalCode} générées pour règlement ${facture.numero}`);
    }
  } catch (error) {
    console.error('[FACTURES] Erreur génération écritures paiement:', error);
  }
}

/**
 * POST /api/factures/generer-manquantes
 * Générer les factures UNIQUEMENT pour les réservations TERMINÉES sans facture
 * (Nouveau flux: facture créée seulement quand RDV terminé)
 */
router.post('/generer-manquantes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    console.log(`[FACTURES SYNC] Début sync pour tenant ${tenantId}`);

    // Récupérer UNIQUEMENT les réservations terminées (seules éligibles à facturation)
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, statut, date')
      .eq('tenant_id', tenantId)
      .eq('statut', 'termine')
      .order('date', { ascending: false });

    console.log(`[FACTURES SYNC] ${reservations?.length || 0} réservations trouvées`);

    if (resError) throw resError;

    // Récupérer les réservations qui ont déjà une facture
    const { data: facturesExistantes } = await supabase
      .from('factures')
      .select('reservation_id, id, statut')
      .eq('tenant_id', tenantId)
      .not('reservation_id', 'is', null);

    const facturesMap = new Map(
      facturesExistantes?.map(f => [f.reservation_id, f]) || []
    );

    const resultats = [];

    for (const reservation of reservations || []) {
      const existingFacture = facturesMap.get(reservation.id);

      // Nouveau flux: Toutes les factures sont créées en 'generee'
      // Le paiement est enregistré séparément via POST /factures/:id/paiement
      const statutFacture = 'generee';

      if (!existingFacture) {
        // Pas de facture - créer en 'generee' (en attente de paiement)
        const result = await createFactureFromReservation(reservation.id, tenantId, { statut: statutFacture });

        // Calculer et ajouter date_echeance si création réussie
        if (result.success && result.facture) {
          const dateFacture = new Date(result.facture.date_facture || new Date());
          const dateEcheance = new Date(dateFacture);
          dateEcheance.setDate(dateEcheance.getDate() + 30);

          await supabase
            .from('factures')
            .update({ date_echeance: dateEcheance.toISOString().split('T')[0] })
            .eq('id', result.facture.id);
        }

        resultats.push({
          reservation_id: reservation.id,
          date: reservation.date,
          action: 'created',
          success: result.success,
          numero: result.facture?.numero,
          statut: statutFacture,
          error: result.error
        });
      } else {
        // Facture existe - synchroniser uniquement si annulation
        let nouveauStatut = existingFacture.statut;

        // Note: On ne force plus 'payee' automatiquement
        // Le paiement doit être enregistré explicitement via POST /factures/:id/paiement

        // Réservation annulée → facture annulée
        if (reservation.statut === 'annule' && existingFacture.statut !== 'annulee') {
          nouveauStatut = 'annulee';
        }

        if (nouveauStatut !== existingFacture.statut) {
          await supabase
            .from('factures')
            .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
            .eq('id', existingFacture.id);

          resultats.push({
            reservation_id: reservation.id,
            action: 'updated',
            success: true,
            ancien: existingFacture.statut,
            nouveau: nouveauStatut
          });
        } else {
          resultats.push({
            reservation_id: reservation.id,
            action: 'unchanged',
            success: true
          });
        }
      }
    }

    const nbCreees = resultats.filter(r => r.action === 'created' && r.success).length;
    const nbMisesAJour = resultats.filter(r => r.action === 'updated').length;
    const nbEchecs = resultats.filter(r => r.action === 'created' && !r.success).length;

    console.log(`[FACTURES SYNC] Résultat: ${nbCreees} créées, ${nbMisesAJour} mises à jour, ${nbEchecs} échecs`);

    // Log des échecs s'il y en a
    resultats.filter(r => !r.success).forEach(r => {
      console.error(`[FACTURES SYNC] Échec pour réservation ${r.reservation_id}:`, r.error);
    });

    res.json({
      success: true,
      message: `${nbCreees} facture(s) créée(s), ${nbMisesAJour} mise(s) à jour`,
      nb_creees: nbCreees,
      nb_mises_a_jour: nbMisesAJour,
      nb_echecs: nbEchecs,
      total_reservations: reservations?.length || 0,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES SYNC] Erreur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/sync-statuts
 * Synchronise les statuts des factures avec les réservations
 */
router.post('/sync-statuts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer toutes les factures avec leur réservation associée
    const { data: factures, error: fetchError } = await supabase
      .from('factures')
      .select('id, numero, statut, reservation_id')
      .eq('tenant_id', tenantId)
      .not('reservation_id', 'is', null);

    if (fetchError) throw fetchError;

    const resultats = [];

    for (const facture of factures || []) {
      // Récupérer le statut de la réservation
      const { data: reservation } = await supabase
        .from('reservations')
        .select('statut')
        .eq('id', facture.reservation_id)
        .single();

      if (!reservation) {
        resultats.push({ numero: facture.numero, action: 'skipped', reason: 'Réservation non trouvée' });
        continue;
      }

      // Déterminer le nouveau statut de la facture
      let nouveauStatut = facture.statut;

      if (reservation.statut === 'termine' && facture.statut === 'brouillon') {
        nouveauStatut = 'generee';
      } else if (reservation.statut === 'annule' && facture.statut !== 'payee' && facture.statut !== 'annulee') {
        nouveauStatut = 'annulee';
      } else if (['demande', 'confirme', 'en_attente'].includes(reservation.statut) && facture.statut === 'generee') {
        // Si la réservation n'est pas terminée mais la facture est générée, la repasser en brouillon
        nouveauStatut = 'brouillon';
      }

      if (nouveauStatut !== facture.statut) {
        const { error: updateError } = await supabase
          .from('factures')
          .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
          .eq('id', facture.id);

        if (updateError) {
          resultats.push({ numero: facture.numero, action: 'error', error: updateError.message });
        } else {
          resultats.push({ numero: facture.numero, action: 'updated', ancien: facture.statut, nouveau: nouveauStatut });
        }
      } else {
        resultats.push({ numero: facture.numero, action: 'unchanged' });
      }
    }

    const nbMisesAJour = resultats.filter(r => r.action === 'updated').length;

    res.json({
      success: true,
      message: `${nbMisesAJour} facture(s) mise(s) à jour`,
      total: factures?.length || 0,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES] Erreur sync statuts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/factures/:id/pdf
 * Génère et retourne le PDF d'une facture (téléchargement)
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { download } = req.query;

    // Récupérer la facture avec les détails
    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !facture) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Récupérer les infos du tenant pour l'en-tête
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, slug, email, telephone, adresse, siret')
      .eq('id', tenantId)
      .single();

    // Si download=true, générer et envoyer le PDF
    if (download === 'true') {
      try {
        const pdfResult = await generateFacture({
          numero: facture.numero,
          date: facture.date_facture,
          client: {
            nom: facture.client_nom || 'Client',
            email: facture.client_email,
            telephone: facture.client_telephone,
            adresse: facture.client_adresse
          },
          services: facture.lignes || [{
            nom: facture.description || 'Prestation',
            prix: facture.montant_ttc / 100
          }],
          total: facture.montant_ttc / 100,
          notes: facture.notes
        });

        if (pdfResult.success && pdfResult.path) {
          // Lire le fichier PDF et l'envoyer
          const fs = await import('fs');
          const pdfBuffer = fs.readFileSync(pdfResult.path);

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="facture_${facture.numero}.pdf"`);
          return res.send(pdfBuffer);
        }
      } catch (pdfError) {
        console.error('[FACTURES] Erreur génération PDF:', pdfError);
        // Fallback to HTML
      }
    }

    // Générer le HTML de la facture (fallback ou prévisualisation)
    const html = generateFactureHTML(facture, tenant);

    // Retourner le HTML (le client peut l'imprimer ou le convertir en PDF)
    res.json({
      success: true,
      facture: {
        ...facture,
        montant_ht_euros: (facture.montant_ht / 100).toFixed(2),
        montant_tva_euros: (facture.montant_tva / 100).toFixed(2),
        montant_ttc_euros: (facture.montant_ttc / 100).toFixed(2)
      },
      html,
      tenant: tenant?.name || 'NEXUS'
    });
  } catch (error) {
    console.error('[FACTURES] Erreur génération PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Génère le HTML d'une facture pour impression/PDF
 */
function generateFactureHTML(facture, tenant) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatMontant = (cents) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${facture.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #0891b2; }
    .facture-info { text-align: right; }
    .facture-numero { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
    .facture-date { color: #666; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .partie { width: 45%; }
    .partie-titre { font-weight: bold; color: #0891b2; margin-bottom: 10px; border-bottom: 2px solid #0891b2; padding-bottom: 5px; }
    .partie p { margin: 3px 0; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .table th { background: #0891b2; color: white; padding: 12px; text-align: left; }
    .table td { padding: 12px; border-bottom: 1px solid #eee; }
    .table .montant { text-align: right; }
    .totaux { width: 300px; margin-left: auto; }
    .totaux-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .totaux-row.total { font-size: 16px; font-weight: bold; border-bottom: 2px solid #0891b2; color: #0891b2; }
    .footer { margin-top: 60px; text-align: center; font-size: 10px; color: #999; }
    .statut { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .statut-payee { background: #d1fae5; color: #065f46; }
    .statut-generee { background: #cffafe; color: #0e7490; }
    .statut-brouillon { background: #fef3c7; color: #92400e; }
    .statut-annulee { background: #f3f4f6; color: #6b7280; text-decoration: line-through; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${tenant?.name || 'NEXUS'}</div>
    <div class="facture-info">
      <div class="facture-numero">FACTURE ${facture.numero}</div>
      <div class="facture-date">Date : ${formatDate(facture.date_facture)}</div>
      <div class="statut statut-${facture.statut}">${facture.statut.toUpperCase()}</div>
    </div>
  </div>

  <div class="parties">
    <div class="partie">
      <div class="partie-titre">Émetteur</div>
      <p><strong>${tenant?.name || 'NEXUS'}</strong></p>
      <p>SIRET : À compléter</p>
    </div>
    <div class="partie">
      <div class="partie-titre">Client</div>
      <p><strong>${facture.client_nom || '-'}</strong></p>
      ${facture.client_adresse ? `<p>${facture.client_adresse}</p>` : ''}
      ${facture.client_telephone ? `<p>Tél : ${facture.client_telephone}</p>` : ''}
      ${facture.client_email ? `<p>Email : ${facture.client_email}</p>` : ''}
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Date prestation</th>
        <th class="montant">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${facture.service_nom || 'Prestation'}</strong>
          ${facture.service_description ? `<br><small>${facture.service_description}</small>` : ''}
        </td>
        <td>${formatDate(facture.date_prestation)}</td>
        <td class="montant">${formatMontant(facture.montant_ht - (facture.frais_deplacement || 0))}</td>
      </tr>
      ${facture.frais_deplacement > 0 ? `
      <tr>
        <td>Frais de déplacement</td>
        <td>-</td>
        <td class="montant">${formatMontant(facture.frais_deplacement)}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>

  <div class="totaux">
    <div class="totaux-row">
      <span>Total HT</span>
      <span>${formatMontant(facture.montant_ht)}</span>
    </div>
    <div class="totaux-row">
      <span>TVA (${facture.taux_tva || 20}%)</span>
      <span>${formatMontant(facture.montant_tva)}</span>
    </div>
    <div class="totaux-row total">
      <span>Total TTC</span>
      <span>${formatMontant(facture.montant_ttc)}</span>
    </div>
  </div>

  ${facture.statut === 'payee' && facture.date_paiement ? `
  <p style="margin-top: 20px; color: #065f46; font-weight: bold;">
    ✓ Payée le ${formatDate(facture.date_paiement)}
  </p>
  ` : ''}

  <div class="footer">
    <p>Merci pour votre confiance</p>
  </div>
</body>
</html>
`;
}

// ============================================
// ROUTE: CRÉER UN AVOIR
// ============================================

/**
 * POST /api/factures/:id/avoir
 * Crée un avoir (note de crédit) pour une facture existante
 * @body {string} motif - Motif de l'avoir (obligatoire)
 */
router.post('/:id/avoir', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { motif } = req.body;

    if (!motif || !motif.trim()) {
      return res.status(400).json({ success: false, error: 'Le motif est obligatoire' });
    }

    const result = await createAvoir(tenantId, parseInt(id), motif);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[AVOIRS] Erreur route avoir:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
