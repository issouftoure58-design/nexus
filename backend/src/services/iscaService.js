/**
 * Service ISCA — Inaltérabilité, Sécurisation, Conservation, Archivage
 * Conformité NF525 / Art. 286-I-3° bis CGI
 *
 * Chaîne de hash SHA-256, piste d'audit, snapshots périodiques
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

/**
 * Calcule le hash SHA-256 d'une facture
 * Contenu hashé : previousHash + numero + date + montants + client_id + tenant_id
 */
export function computeHash(facture, previousHash = '') {
  if (!facture) throw new Error('facture requise');

  const content = [
    previousHash || '0'.repeat(64),
    facture.numero || '',
    facture.date_facture || '',
    String(facture.montant_ht || 0),
    String(facture.montant_tva || 0),
    String(facture.montant_ttc || 0),
    String(facture.client_id || ''),
    facture.tenant_id || ''
  ].join('|');

  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Enregistre le hash dans la chaîne
 */
export async function recordHash(tenantId, factureId, hash) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Récupérer le dernier numéro de séquence
  const { data: last } = await supabase
    .from('factures_hash_chain')
    .select('sequence_num, hash_sha256')
    .eq('tenant_id', tenantId)
    .order('sequence_num', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequenceNum = (last?.sequence_num || 0) + 1;
  const previousHash = last?.hash_sha256 || null;

  const { error } = await supabase
    .from('factures_hash_chain')
    .insert({
      tenant_id: tenantId,
      facture_id: factureId,
      hash_sha256: hash,
      previous_hash: previousHash,
      sequence_num: sequenceNum
    });

  if (error) {
    // Duplicate = déjà hashée, ignorer
    if (error.code === '23505') return;
    throw error;
  }

  // Mettre à jour la facture avec le hash
  await supabase
    .from('factures')
    .update({ hash_sha256: hash })
    .eq('id', factureId)
    .eq('tenant_id', tenantId);
}

/**
 * Vérifie l'intégrité de la chaîne de hash
 */
export async function verifyChain(tenantId, exercice) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Charger la chaîne ordonnée par séquence
  const { data: chain, error } = await supabase
    .from('factures_hash_chain')
    .select('*, facture:factures(numero, date_facture, montant_ht, montant_tva, montant_ttc, client_id, tenant_id)')
    .eq('tenant_id', tenantId)
    .order('sequence_num', { ascending: true });

  if (error) throw error;
  if (!chain || chain.length === 0) {
    return { valid: true, nb_verified: 0, message: 'Aucune facture dans la chaîne' };
  }

  // Filtrer par exercice si spécifié
  let chainToCheck = chain;
  if (exercice) {
    chainToCheck = chain.filter(c =>
      c.facture?.date_facture && c.facture.date_facture.startsWith(String(exercice))
    );
  }

  let previousHash = null;
  for (let i = 0; i < chainToCheck.length; i++) {
    const entry = chainToCheck[i];

    // Vérifier le hash précédent
    if (i > 0 && entry.previous_hash !== previousHash) {
      return {
        valid: false,
        broken_at: entry.sequence_num,
        facture_id: entry.facture_id,
        nb_verified: i,
        message: `Chaîne brisée à la séquence ${entry.sequence_num} : previous_hash ne correspond pas`
      };
    }

    // Recalculer le hash
    if (entry.facture) {
      const expectedHash = computeHash(entry.facture, entry.previous_hash || '');
      if (expectedHash !== entry.hash_sha256) {
        return {
          valid: false,
          broken_at: entry.sequence_num,
          facture_id: entry.facture_id,
          nb_verified: i,
          message: `Hash invalide à la séquence ${entry.sequence_num} : contenu modifié`
        };
      }
    }

    previousHash = entry.hash_sha256;
  }

  return {
    valid: true,
    nb_verified: chainToCheck.length,
    message: `Chaîne intègre — ${chainToCheck.length} factures vérifiées`
  };
}

/**
 * Crée un snapshot mensuel pour archivage
 */
export async function createSnapshot(tenantId, periode) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('période requise (YYYY-MM)');

  // Récupérer les factures de la période
  const { data: factures, error } = await supabase
    .from('factures')
    .select('id, numero, date_facture, montant_ht, montant_tva, montant_ttc, statut, client_id, hash_sha256')
    .eq('tenant_id', tenantId)
    .gte('date_facture', `${periode}-01`)
    .lte('date_facture', `${periode}-31`);

  if (error) throw error;

  const nbFactures = factures?.length || 0;
  if (nbFactures === 0) {
    return { snapshot_id: null, nb_factures: 0, message: 'Aucune facture pour cette période' };
  }

  // Hash global du snapshot
  const content = JSON.stringify(factures);
  const hashGlobal = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

  const { data: snapshot, error: insertError } = await supabase
    .from('factures_snapshots')
    .upsert({
      tenant_id: tenantId,
      periode,
      hash_global: hashGlobal,
      nb_factures: nbFactures,
      data_snapshot: factures
    }, { onConflict: 'tenant_id,periode' })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    snapshot_id: snapshot.id,
    hash: hashGlobal,
    nb_factures: nbFactures
  };
}

/**
 * Piste d'audit — log inaltérable
 */
export async function auditLog(tenantId, factureId, action, adminId, details = {}, ipAddress = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('factures_audit_trail')
    .insert({
      tenant_id: tenantId,
      facture_id: factureId,
      action,
      admin_id: adminId,
      details,
      ip_address: ipAddress
    });

  if (error) {
    console.error('[ISCA] Erreur audit log:', error);
    // Ne pas throw — l'audit ne doit pas bloquer le flux métier
  }
}

/**
 * Récupère la piste d'audit d'une facture
 */
export async function getAuditTrail(tenantId, factureId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('factures_audit_trail')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('facture_id', factureId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export default {
  computeHash,
  recordHash,
  verifyChain,
  createSnapshot,
  auditLog,
  getAuditTrail
};
