/**
 * Stats Handler — get_stats, get_top_clients, get_revenus_mois, get_compte_resultat
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

async function get_stats(toolInput, tenantId) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';
  const periode = toolInput.periode || 'mois';

  const { data: rdvToday } = await supabase
    .from('reservations')
    .select('id, prix_total, prix_service, frais_deplacement')
    .eq('tenant_id', tenantId)
    .eq('date', today);

  const { data: rdvMonth } = await supabase
    .from('reservations')
    .select('id, prix_total, prix_service, frais_deplacement, statut, service_nom, client_id')
    .eq('tenant_id', tenantId)
    .gte('date', monthStart);

  const { count: clientsCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId);

  const rdvFacturables = rdvMonth?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
  const revenusMois = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);

  const serviceCount = {};
  rdvFacturables.forEach(r => {
    if (r.service_nom) serviceCount[r.service_nom] = (serviceCount[r.service_nom] || 0) + 1;
  });
  const topServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, count]) => ({ nom, count }));

  return {
    success: true,
    periode,
    date: today,
    rdv_aujourdhui: rdvToday?.length || 0,
    rdv_mois: rdvMonth?.length || 0,
    rdv_confirmes: rdvFacturables.length,
    revenus_mois: `${(revenusMois / 100).toFixed(2)}€`,
    clients_total: clientsCount || 0,
    top_services: topServices
  };
}

async function get_top_clients(toolInput, tenantId) {
  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id, prenom, nom, telephone, email,
      reservations:reservations(id, prix_total, prix_service, frais_deplacement, statut)
    `)
    .eq('tenant_id', tenantId)
    .limit(100);

  if (!clients || clients.length === 0) {
    return { success: true, message: 'Aucun client trouvé', clients: [] };
  }

  const clientsWithRevenue = clients.map(c => {
    const rdvFacturables = c.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
    const totalRevenu = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);
    return {
      id: c.id,
      nom: `${c.prenom} ${c.nom}`,
      telephone: c.telephone,
      email: c.email,
      nb_rdv: c.reservations?.length || 0,
      revenu_total: totalRevenu,
      revenu_formatte: `${(totalRevenu / 100).toFixed(2)}€`
    };
  });

  clientsWithRevenue.sort((a, b) => b.revenu_total - a.revenu_total);

  return {
    success: true,
    top_clients: clientsWithRevenue.slice(0, toolInput.limit || 10)
  };
}

async function get_revenus_mois(toolInput, tenantId) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { data: rdvs } = await supabase
    .from('reservations')
    .select('id, date, prix_total, prix_service, frais_deplacement, statut, service_nom')
    .eq('tenant_id', tenantId)
    .gte('date', monthStart.toISOString().split('T')[0])
    .lte('date', monthEnd.toISOString().split('T')[0]);

  const facturables = rdvs?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
  const enAttente = rdvs?.filter(r => r.statut === 'en_attente' || r.statut === 'demande' || r.statut === 'en_attente_paiement') || [];

  const revenusFacturables = facturables.reduce((sum, r) => sum + getPrixReservation(r), 0);
  const revenusEnAttente = enAttente.reduce((sum, r) => sum + getPrixReservation(r), 0);

  const serviceRevenue = {};
  facturables.forEach(r => {
    if (r.service_nom) serviceRevenue[r.service_nom] = (serviceRevenue[r.service_nom] || 0) + getPrixReservation(r);
  });
  const topServices = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, montant]) => ({ nom, montant: `${(montant / 100).toFixed(2)}€` }));

  return {
    success: true,
    mois: new Date(monthStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    revenus_confirmes: `${(revenusFacturables / 100).toFixed(2)}€`,
    revenus_en_attente: `${(revenusEnAttente / 100).toFixed(2)}€`,
    nb_rdv_confirmes: facturables.length,
    nb_rdv_en_attente: enAttente.length,
    top_services: topServices
  };
}

async function get_compte_resultat(toolInput, tenantId) {
  const today = new Date();
  const targetMois = toolInput.mois || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = targetMois.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const { data: reservations } = await supabase
    .from('reservations')
    .select('prix_total, prix_service, frais_deplacement, statut')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('statut', ['confirme', 'termine']);

  const revenus = (reservations || []).reduce((sum, r) => sum + getPrixReservation(r), 0);

  const { data: depenses } = await supabase
    .from('depenses')
    .select('categorie, montant')
    .eq('tenant_id', tenantId)
    .gte('date_depense', startDate)
    .lte('date_depense', endDate);

  const chargesParCategorie = {};
  let totalCharges = 0;
  (depenses || []).forEach(d => {
    chargesParCategorie[d.categorie] = (chargesParCategorie[d.categorie] || 0) + d.montant;
    totalCharges += d.montant;
  });

  const resultatNet = revenus - totalCharges;
  const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100).toFixed(1) : 0;

  return {
    success: true,
    mois: targetMois,
    chiffre_affaires: `${(revenus / 100).toFixed(2)}€`,
    charges_totales: `${(totalCharges / 100).toFixed(2)}€`,
    resultat_net: `${(resultatNet / 100).toFixed(2)}€`,
    marge_nette: `${margeNette}%`,
    detail_charges: Object.entries(chargesParCategorie).map(([cat, montant]) => ({
      categorie: cat,
      montant_euros: (montant / 100).toFixed(2)
    })),
    nb_rdv: reservations?.length || 0,
    nb_depenses: depenses?.length || 0
  };
}

export const statsHandlers = {
  get_stats,
  get_top_clients,
  get_best_clients: get_top_clients,
  get_revenus_mois,
  analyze_revenue: get_revenus_mois,
  get_compte_resultat,
  compte_resultat: get_compte_resultat
};
