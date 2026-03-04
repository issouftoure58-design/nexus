/**
 * Commercial Handler — Inactifs, Relances, Campagnes, Devis, Ventes, Performance
 * Extracted from adminChatService.js (L1012-1317) + new tools
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import Anthropic from '@anthropic-ai/sdk';

// Anthropic Sonnet for high-quality relance messages
const MODEL_SONNET = 'claude-sonnet-4-20250514';

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configuree');
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// ═══════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════

function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// commercial_detecter_inactifs — Detection clients inactifs avec scoring
// (extrait adminChatService L1012-1117)
// ═══════════════════════════════════════════════════════════════

async function commercial_detecter_inactifs(toolInput, tenantId, adminId) {
  const periode = toolInput.periode || 3; // mois par defaut

  logger.debug(`[COMMERCIAL HANDLER] Detection clients inactifs - periode: ${periode} mois`);

  // Recuperer tous les clients avec leurs reservations
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id, nom, prenom, email, telephone, created_at,
      reservations(id, date, statut, prix_total, prix_service, frais_deplacement, service_nom)
    `)
    .eq('tenant_id', tenantId);

  if (error) throw error;

  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - parseInt(periode));

  const clientsInactifs = [];

  for (const client of clients || []) {
    const rdvs = (client.reservations || []).filter(r =>
      r.statut === 'confirme' || r.statut === 'termine'
    );

    if (rdvs.length === 0) continue;

    rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
    const dernierRdv = rdvs[0];
    const dateDernierRdv = new Date(dernierRdv.date);

    if (dateDernierRdv < dateLimit) {
      const joursInactivite = Math.floor((Date.now() - dateDernierRdv.getTime()) / (1000 * 60 * 60 * 24));
      const moisInactivite = Math.floor(joursInactivite / 30);
      const caTotal = rdvs.reduce((sum, r) => sum + getPrixReservation(r), 0);

      // Scoring
      let score = 0;
      const moisDepuisPremier = Math.max(1, moisInactivite + 3);
      const frequence = rdvs.length / moisDepuisPremier;
      if (frequence >= 1) score += 10;
      else if (frequence >= 0.33) score += 5;
      else score += 2;

      if (caTotal >= 50000) score += 10;
      else if (caTotal >= 20000) score += 5;
      else score += 2;

      const premierRdv = new Date(rdvs[rdvs.length - 1].date);
      const anciennete = Math.floor((Date.now() - premierRdv.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (anciennete >= 24) score += 10;
      else if (anciennete >= 6) score += 5;
      else score += 2;

      let segment = 'standard';
      if (score >= 20) segment = 'vip';
      else if (score >= 10) segment = 'fidele';

      let niveauInactivite = 'leger';
      let offreSuggeree = 5;
      if (moisInactivite >= 12) { niveauInactivite = 'fort'; offreSuggeree = 20; }
      else if (moisInactivite >= 6) { niveauInactivite = 'moyen'; offreSuggeree = 10; }

      // Service prefere
      const servicesFreq = {};
      rdvs.forEach(r => {
        const svc = r.service_nom || 'Service';
        servicesFreq[svc] = (servicesFreq[svc] || 0) + 1;
      });
      const servicePrefere = Object.entries(servicesFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

      clientsInactifs.push({
        id: client.id,
        nom: client.nom,
        prenom: client.prenom,
        email: client.email,
        telephone: client.telephone,
        dernier_rdv: dernierRdv.date,
        mois_inactivite: moisInactivite,
        niveau_inactivite: niveauInactivite,
        nb_rdv_total: rdvs.length,
        ca_total_euros: (caTotal / 100).toFixed(2),
        score,
        segment,
        service_prefere: servicePrefere,
        offre_suggeree: offreSuggeree
      });
    }
  }

  clientsInactifs.sort((a, b) => b.score - a.score);

  return {
    success: true,
    periode_mois: periode,
    nb_clients_inactifs: clientsInactifs.length,
    segments: {
      vip: clientsInactifs.filter(c => c.segment === 'vip').length,
      fidele: clientsInactifs.filter(c => c.segment === 'fidele').length,
      standard: clientsInactifs.filter(c => c.segment === 'standard').length
    },
    clients_prioritaires: clientsInactifs.slice(0, 10),
    message: `${clientsInactifs.length} clients inactifs depuis ${periode}+ mois`
  };
}

// ═══════════════════════════════════════════════════════════════
// commercial_generer_relance — Generer un message de relance via Claude Sonnet
// (extrait adminChatService L1119-1250)
// ═══════════════════════════════════════════════════════════════

async function commercial_generer_relance(toolInput, tenantId, adminId) {
  const { client_id, segment, offre, canal, details } = toolInput;

  logger.debug(`[COMMERCIAL HANDLER] Generation relance - client: ${client_id}, segment: ${segment}`);

  // Recuperer infos client
  let clientInfo = toolInput.client;
  if (!clientInfo && client_id) {
    const { data } = await supabase
      .from('clients')
      .select(`
        id, nom, prenom, email, telephone,
        reservations(date, service_nom, statut)
      `)
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (data) {
      const rdvs = (data.reservations || []).filter(r => r.statut === 'confirme' || r.statut === 'termine');
      rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
      const servicesFreq = {};
      rdvs.forEach(r => {
        const svc = r.service_nom || 'Service';
        servicesFreq[svc] = (servicesFreq[svc] || 0) + 1;
      });

      clientInfo = {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        telephone: data.telephone,
        service_prefere: Object.entries(servicesFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'coiffure',
        mois_inactivite: rdvs[0] ? Math.floor((Date.now() - new Date(rdvs[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0
      };
    }
  }

  if (!clientInfo) {
    return { success: false, error: 'Informations client requises (client_id ou client)' };
  }

  // Recuperer infos tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name')
    .eq('id', tenantId)
    .single();

  // Generer message personnalise via Sonnet (qualite superieure pour relances personnalisees)
  const canalChoisi = canal || 'email';
  const client = getAnthropicClient();
  const prompt = `Tu es expert en relance client pour ${tenant?.business_name || 'cette entreprise'}.

Genere un message de relance ${canalChoisi} personnalise.

CLIENT :
- Nom : ${clientInfo.prenom} ${clientInfo.nom}
- Segment : ${segment || 'standard'} (VIP = tres fidele, Fidele = regulier, Standard = occasionnel)
- Dernier RDV : Il y a ${clientInfo.mois_inactivite || 'plusieurs'} mois
- Service prefere : ${clientInfo.service_prefere || 'coiffure'}

OFFRE : ${offre || 10}% de reduction

DETAILS SUPPLEMENTAIRES : ${details || 'Aucun'}

REGLES :
1. Ton chaleureux et personnalise (utilise le prenom)
2. Non insistant, bienveillant
3. Longueur : ${canalChoisi === 'sms' ? '40-60 mots' : '80-120 mots'}
4. Mentionner le service prefere si pertinent
5. Call-to-action clair

Reponds UNIQUEMENT en JSON valide :
{
  "objet": "Objet accrocheur (si email)",
  "message": "Texte personnalise avec prenom",
  "call_to_action": "Phrase finale engageante"
}`;

  try {
    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text.trim();
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const relanceJson = JSON.parse(cleanJson);

    // Sauvegarder campagne
    const messageComplet = relanceJson.call_to_action
      ? `${relanceJson.message}\n\n${relanceJson.call_to_action}`
      : relanceJson.message;

    const { data: campagne, error } = await supabase
      .from('campagnes_relance')
      .insert({
        tenant_id: tenantId,
        titre: `Relance ${clientInfo.prenom} ${clientInfo.nom}`,
        type_campagne: 'inactifs',
        canal: canalChoisi,
        objet: relanceJson.objet || null,
        message: messageComplet,
        offre_type: 'reduction_pourcentage',
        offre_valeur: offre || 10,
        segment_cible: segment || 'standard',
        nb_cibles: 1,
        statut: 'brouillon'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Message de relance genere et sauvegarde',
      campagne_id: campagne.id,
      canal: canalChoisi,
      client: `${clientInfo.prenom} ${clientInfo.nom}`,
      preview: {
        objet: relanceJson.objet,
        message: messageComplet
      }
    };
  } catch (parseError) {
    logger.error('[COMMERCIAL HANDLER] Erreur generation relance:', parseError);
    return { success: false, error: 'Erreur lors de la generation. Reessayez.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// commercial_stats_relances — Stats des campagnes de relance
// (extrait adminChatService L1252-1283)
// ═══════════════════════════════════════════════════════════════

async function commercial_stats_relances(toolInput, tenantId, adminId) {
  const { data: campagnes } = await supabase
    .from('campagnes_relance')
    .select('*')
    .eq('tenant_id', tenantId);

  const stats = {
    total_campagnes: campagnes?.length || 0,
    total_envoyes: 0,
    total_conversions: 0,
    taux_conversion: '0%',
    par_statut: {},
    par_canal: {}
  };

  (campagnes || []).forEach(c => {
    stats.total_envoyes += c.nb_envoyes || 0;
    stats.total_conversions += c.nb_conversions || 0;
    stats.par_statut[c.statut] = (stats.par_statut[c.statut] || 0) + 1;
    stats.par_canal[c.canal] = (stats.par_canal[c.canal] || 0) + 1;
  });

  if (stats.total_envoyes > 0) {
    stats.taux_conversion = ((stats.total_conversions / stats.total_envoyes) * 100).toFixed(1) + '%';
  }

  return {
    success: true,
    stats
  };
}

// ═══════════════════════════════════════════════════════════════
// commercial_lister_campagnes — Lister les campagnes de relance
// (extrait adminChatService L1285-1317)
// ═══════════════════════════════════════════════════════════════

async function commercial_lister_campagnes(toolInput, tenantId, adminId) {
  const { statut, limit: campLimit } = toolInput;

  let query = supabase
    .from('campagnes_relance')
    .select('id, titre, type_campagne, canal, statut, segment_cible, nb_cibles, nb_envoyes, nb_conversions, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(campLimit || 10);

  if (statut) query = query.eq('statut', statut);

  const { data: campagnes, error } = await query;

  if (error) throw error;

  return {
    success: true,
    campagnes: campagnes?.map(c => ({
      id: c.id,
      titre: c.titre,
      type: c.type_campagne,
      canal: c.canal,
      statut: c.statut,
      segment: c.segment_cible,
      nb_cibles: c.nb_cibles,
      nb_envoyes: c.nb_envoyes,
      nb_conversions: c.nb_conversions,
      date: c.created_at
    })) || [],
    count: campagnes?.length || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// commercial_devis — Gestion des devis (creer, voir, envoyer)
// ═══════════════════════════════════════════════════════════════

async function commercial_devis(toolInput, tenantId, adminId) {
  const action = toolInput.action || 'voir';

  if (action === 'voir' || action === 'lister') {
    let query = supabase
      .from('devis')
      .select(`
        id, numero, client_id, client_nom, montant_ht, montant_ttc, montant_tva,
        statut, date_devis, date_validite, conditions, created_at,
        devis_lignes(id, description, quantite, prix_unitaire, montant_ht, tva_taux)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(toolInput.limit || 20);

    if (toolInput.statut) query = query.eq('statut', toolInput.statut);
    if (toolInput.client_id) query = query.eq('client_id', toolInput.client_id);
    if (toolInput.devis_id) query = query.eq('id', toolInput.devis_id);

    const { data: devis, error } = await query;

    if (error) throw error;

    return {
      success: true,
      nb_devis: devis?.length || 0,
      devis: (devis || []).map(d => ({
        id: d.id,
        numero: d.numero,
        client_nom: d.client_nom,
        montant_ht_euros: ((d.montant_ht || 0) / 100).toFixed(2),
        montant_ttc_euros: ((d.montant_ttc || 0) / 100).toFixed(2),
        statut: d.statut,
        date_devis: d.date_devis,
        date_validite: d.date_validite,
        nb_lignes: d.devis_lignes?.length || 0,
        lignes: d.devis_lignes?.map(l => ({
          description: l.description,
          quantite: l.quantite,
          prix_unitaire_euros: ((l.prix_unitaire || 0) / 100).toFixed(2),
          montant_ht_euros: ((l.montant_ht || 0) / 100).toFixed(2)
        }))
      }))
    };
  }

  if (action === 'creer') {
    const { client_id, client_nom, lignes, conditions, date_validite } = toolInput;

    if (!client_id && !client_nom) {
      return { success: false, error: 'client_id ou client_nom requis' };
    }
    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return { success: false, error: 'Au moins une ligne de devis requise (lignes: [{description, quantite, prix_unitaire}])' };
    }

    // Calculer les totaux
    let totalHT = 0;
    let totalTVA = 0;
    const lignesFormatees = lignes.map(l => {
      const qte = l.quantite || 1;
      const prixUnitaire = Math.round((l.prix_unitaire || 0) * 100); // Convertir en centimes
      const montantHT = qte * prixUnitaire;
      const tauxTVA = l.tva_taux || 20;
      const montantTVA = Math.round(montantHT * tauxTVA / 100);
      totalHT += montantHT;
      totalTVA += montantTVA;
      return {
        description: l.description,
        quantite: qte,
        prix_unitaire: prixUnitaire,
        montant_ht: montantHT,
        tva_taux: tauxTVA
      };
    });

    const totalTTC = totalHT + totalTVA;

    // Generer numero de devis
    const today = new Date();
    const { count } = await supabase
      .from('devis')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId);

    const numero = `DEV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Creer le devis
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .insert({
        tenant_id: tenantId,
        numero,
        client_id: client_id || null,
        client_nom: client_nom || null,
        montant_ht: totalHT,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        statut: 'brouillon',
        date_devis: today.toISOString().split('T')[0],
        date_validite: date_validite || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        conditions: conditions || null
      })
      .select()
      .single();

    if (devisError) throw devisError;

    // Inserer les lignes
    const lignesInsert = lignesFormatees.map(l => ({
      tenant_id: tenantId,
      devis_id: devis.id,
      ...l
    }));

    const { error: lignesError } = await supabase
      .from('devis_lignes')
      .insert(lignesInsert);

    if (lignesError) {
      logger.error('[COMMERCIAL HANDLER] Erreur insertion lignes devis:', lignesError);
    }

    return {
      success: true,
      message: `Devis ${numero} cree avec succes`,
      devis: {
        id: devis.id,
        numero: devis.numero,
        montant_ht_euros: (totalHT / 100).toFixed(2),
        montant_ttc_euros: (totalTTC / 100).toFixed(2),
        statut: 'brouillon',
        nb_lignes: lignesFormatees.length
      }
    };
  }

  if (action === 'envoyer') {
    const { devis_id } = toolInput;

    if (!devis_id) {
      return { success: false, error: 'devis_id requis' };
    }

    const { data, error } = await supabase
      .from('devis')
      .update({
        statut: 'envoye',
        date_envoi: new Date().toISOString()
      })
      .eq('id', devis_id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Devis ${data.numero} marque comme envoye`,
      devis: {
        id: data.id,
        numero: data.numero,
        statut: data.statut
      }
    };
  }

  return { success: false, error: 'Action non reconnue. Actions valides: voir, lister, creer, envoyer' };
}

// ═══════════════════════════════════════════════════════════════
// commercial_ventes — Analyse des ventes depuis les reservations
// ═══════════════════════════════════════════════════════════════

async function commercial_ventes(toolInput, tenantId, adminId) {
  const now = new Date();
  const groupBy = toolInput.group_by || 'service'; // service, client, mois
  const nbMois = toolInput.nb_mois || 3;

  const dateDebut = toolInput.date_debut || new Date(now.getFullYear(), now.getMonth() - nbMois, 1).toISOString().split('T')[0];
  const dateFin = toolInput.date_fin || now.toISOString().split('T')[0];

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, date, prix_total, prix_service, frais_deplacement, statut, service_nom, client_id')
    .eq('tenant_id', tenantId)
    .in('statut', ['confirme', 'termine'])
    .gte('date', dateDebut)
    .lte('date', dateFin);

  if (error) throw error;

  const rdvs = reservations || [];
  const caTotal = rdvs.reduce((sum, r) => sum + getPrixReservation(r), 0);

  if (groupBy === 'service') {
    const parService = {};
    rdvs.forEach(r => {
      const svc = r.service_nom || 'Autre';
      if (!parService[svc]) parService[svc] = { ca: 0, count: 0 };
      parService[svc].ca += getPrixReservation(r);
      parService[svc].count += 1;
    });

    const ventesParService = Object.entries(parService)
      .map(([service, data]) => ({
        service,
        ca_euros: (data.ca / 100).toFixed(2),
        nb_ventes: data.count,
        panier_moyen_euros: data.count > 0 ? (data.ca / data.count / 100).toFixed(2) : '0.00',
        part_ca: caTotal > 0 ? ((data.ca / caTotal) * 100).toFixed(1) + '%' : '0%'
      }))
      .sort((a, b) => parseFloat(b.ca_euros) - parseFloat(a.ca_euros));

    return {
      success: true,
      periode: { debut: dateDebut, fin: dateFin },
      ca_total_euros: (caTotal / 100).toFixed(2),
      nb_ventes_total: rdvs.length,
      par_service: ventesParService
    };
  }

  if (groupBy === 'client') {
    const parClient = {};
    rdvs.forEach(r => {
      const cid = r.client_id || 'inconnu';
      if (!parClient[cid]) parClient[cid] = { ca: 0, count: 0 };
      parClient[cid].ca += getPrixReservation(r);
      parClient[cid].count += 1;
    });

    // Recuperer les noms des clients
    const clientIds = Object.keys(parClient).filter(id => id !== 'inconnu');
    let clientsMap = {};
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, nom, prenom')
        .eq('tenant_id', tenantId)
        .in('id', clientIds);

      (clientsData || []).forEach(c => {
        clientsMap[c.id] = `${c.prenom} ${c.nom}`;
      });
    }

    const ventesParClient = Object.entries(parClient)
      .map(([clientId, data]) => ({
        client_id: clientId,
        client_nom: clientsMap[clientId] || 'Client inconnu',
        ca_euros: (data.ca / 100).toFixed(2),
        nb_visites: data.count,
        panier_moyen_euros: data.count > 0 ? (data.ca / data.count / 100).toFixed(2) : '0.00'
      }))
      .sort((a, b) => parseFloat(b.ca_euros) - parseFloat(a.ca_euros))
      .slice(0, toolInput.limit || 20);

    return {
      success: true,
      periode: { debut: dateDebut, fin: dateFin },
      ca_total_euros: (caTotal / 100).toFixed(2),
      nb_clients_uniques: Object.keys(parClient).length,
      top_clients: ventesParClient
    };
  }

  if (groupBy === 'mois') {
    const parMois = {};
    rdvs.forEach(r => {
      const moisKey = r.date?.substring(0, 7) || 'inconnu';
      if (!parMois[moisKey]) parMois[moisKey] = { ca: 0, count: 0 };
      parMois[moisKey].ca += getPrixReservation(r);
      parMois[moisKey].count += 1;
    });

    const ventesParMois = Object.entries(parMois)
      .map(([mois, data]) => ({
        mois,
        ca_euros: (data.ca / 100).toFixed(2),
        nb_ventes: data.count,
        panier_moyen_euros: data.count > 0 ? (data.ca / data.count / 100).toFixed(2) : '0.00'
      }))
      .sort((a, b) => a.mois.localeCompare(b.mois));

    return {
      success: true,
      periode: { debut: dateDebut, fin: dateFin },
      ca_total_euros: (caTotal / 100).toFixed(2),
      nb_mois: ventesParMois.length,
      evolution_mensuelle: ventesParMois
    };
  }

  return { success: false, error: 'group_by non reconnu. Valeurs valides: service, client, mois' };
}

// ═══════════════════════════════════════════════════════════════
// commercial_relances — Relances factures via relancesService
// ═══════════════════════════════════════════════════════════════

async function commercial_relances(toolInput, tenantId, adminId) {
  try {
    const { getFacturesARelancer, getStatsRelances } = await import('../../services/relancesService.js');
    const action = toolInput.action || 'stats';

    if (action === 'stats') {
      const stats = await getStatsRelances(tenantId);

      return {
        success: true,
        message: 'Statistiques de relances factures',
        stats: {
          ...stats,
          montant_total_euros: ((stats.montant_total || 0) / 100).toFixed(2)
        }
      };
    }

    if (action === 'lister') {
      const factures = await getFacturesARelancer(tenantId);

      return {
        success: true,
        nb_factures_impayees: factures.length,
        factures: factures.map(f => ({
          id: f.id,
          numero: f.numero,
          client_nom: f.client_nom,
          montant_ttc_euros: ((f.montant_ttc || 0) / 100).toFixed(2),
          date_echeance: f.date_echeance,
          jours_retard: f.jours_retard,
          niveau_relance: f.niveau_relance,
          niveau_attendu: f.niveau_attendu
        }))
      };
    }

    return { success: false, error: 'Action non reconnue. Actions valides: stats, lister' };
  } catch (error) {
    logger.error('[COMMERCIAL HANDLER] Erreur relances factures:', error);
    return { success: false, error: `Erreur relances: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════
// commercial_performance — Metriques de performance commerciale
// ═══════════════════════════════════════════════════════════════

async function commercial_performance(toolInput, tenantId, adminId) {
  const now = new Date();
  const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = toolInput.date_debut || `${moisCourant}-01`;
  const endDate = toolInput.date_fin || now.toISOString().split('T')[0];

  // Reservations de la periode
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, date, prix_total, prix_service, frais_deplacement, statut, client_id, service_nom')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Clients total
  const { count: clientsTotal } = await supabase
    .from('clients')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId);

  // Nouveaux clients sur la periode
  const { count: nouveauxClients } = await supabase
    .from('clients')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59');

  const allRdv = reservations || [];
  const rdvConfirmes = allRdv.filter(r => r.statut === 'confirme' || r.statut === 'termine');
  const rdvAnnules = allRdv.filter(r => r.statut === 'annule');
  const rdvEnAttente = allRdv.filter(r => r.statut === 'en_attente' || r.statut === 'demande');

  const caTotal = rdvConfirmes.reduce((sum, r) => sum + getPrixReservation(r), 0);

  // Clients uniques
  const clientsUniques = new Set(rdvConfirmes.map(r => r.client_id).filter(Boolean));

  // Panier moyen
  const panierMoyen = rdvConfirmes.length > 0 ? caTotal / rdvConfirmes.length : 0;

  // CA par client
  const caParClient = clientsUniques.size > 0 ? caTotal / clientsUniques.size : 0;

  // Taux de conversion (confirmes / total demandes)
  const totalDemandes = allRdv.length;
  const tauxConversion = totalDemandes > 0 ? ((rdvConfirmes.length / totalDemandes) * 100) : 0;

  // Taux d'annulation
  const tauxAnnulation = totalDemandes > 0 ? ((rdvAnnules.length / totalDemandes) * 100) : 0;

  // Top services
  const serviceRevenue = {};
  rdvConfirmes.forEach(r => {
    const svc = r.service_nom || 'Autre';
    if (!serviceRevenue[svc]) serviceRevenue[svc] = { ca: 0, count: 0 };
    serviceRevenue[svc].ca += getPrixReservation(r);
    serviceRevenue[svc].count += 1;
  });

  const topServices = Object.entries(serviceRevenue)
    .map(([nom, data]) => ({
      service: nom,
      ca_euros: (data.ca / 100).toFixed(2),
      nb_rdv: data.count
    }))
    .sort((a, b) => parseFloat(b.ca_euros) - parseFloat(a.ca_euros))
    .slice(0, 5);

  return {
    success: true,
    periode: { debut: startDate, fin: endDate },
    metriques: {
      ca_total_euros: (caTotal / 100).toFixed(2),
      nb_rdv_total: allRdv.length,
      nb_rdv_confirmes: rdvConfirmes.length,
      nb_rdv_annules: rdvAnnules.length,
      nb_rdv_en_attente: rdvEnAttente.length,
      taux_conversion: `${tauxConversion.toFixed(1)}%`,
      taux_annulation: `${tauxAnnulation.toFixed(1)}%`,
      panier_moyen_euros: (panierMoyen / 100).toFixed(2),
      ca_par_client_euros: (caParClient / 100).toFixed(2)
    },
    clients: {
      total: clientsTotal || 0,
      nouveaux_periode: nouveauxClients || 0,
      actifs_periode: clientsUniques.size
    },
    top_services: topServices
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export const commercialHandlers = {
  commercial_detecter_inactifs,
  commercial_generer_relance,
  commercial_stats_relances,
  commercial_stats: commercial_stats_relances,
  commercial_lister_campagnes,
  commercial_devis,
  commercial_ventes,
  commercial_relances,
  commercial_performance
};
