import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// GET /api/admin/stats/dashboard
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const now = new Date();
    // Formater les dates en YYYY-MM-DD pour correspondre au format de la colonne date
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // CA du mois (🔒 TENANT ISOLATION)
    const { data: rdvMois } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .gte('date', startOfMonth)
      .in('statut', ['confirme', 'termine']);

    const caMois = rdvMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;

    // CA du jour (🔒 TENANT ISOLATION)
    const { data: rdvJour } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .eq('date', today)
      .in('statut', ['confirme', 'termine']);

    const caJour = rdvJour?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;

    // Nombre de RDV par statut (🔒 TENANT ISOLATION)
    const { data: rdvStats } = await supabase
      .from('reservations')
      .select('statut')
      .eq('tenant_id', tenantId);

    const rdvParStatut = {
      confirmes: rdvStats?.filter(r => r.statut === 'confirme').length || 0,
      en_attente: rdvStats?.filter(r => ['demande', 'en_attente', 'en_attente_paiement'].includes(r.statut)).length || 0,
      annules: rdvStats?.filter(r => r.statut === 'annule').length || 0,
      termines: rdvStats?.filter(r => r.statut === 'termine').length || 0,
    };

    // Services populaires (🔒 TENANT ISOLATION)
    const { data: servicesData } = await supabase
      .from('reservations')
      .select('service_nom')
      .eq('tenant_id', tenantId)
      .in('statut', ['confirme', 'termine']);

    const servicesCount = {};
    servicesData?.forEach(r => {
      if (r.service_nom) {
        servicesCount[r.service_nom] = (servicesCount[r.service_nom] || 0) + 1;
      }
    });

    const servicesPopulaires = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    // Nombre total de clients (🔒 TENANT ISOLATION)
    const { count: nbClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Prochain RDV (🔒 TENANT ISOLATION)
    const nowHeure = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { data: prochainRdvList } = await supabase
      .from('reservations')
      .select('*, clients(nom, prenom, telephone)')
      .eq('tenant_id', tenantId)
      .in('statut', ['confirme', 'demande', 'en_attente', 'en_attente_paiement'])
      .gte('date', today)
      .order('date', { ascending: true })
      .order('heure', { ascending: true })
      .limit(10);

    // Filtrer : garder uniquement les RDV futurs ou dont l'heure n'est pas encore passée
    const prochainRdv = (prochainRdvList || []).find(rdv => {
      if (rdv.date > today) return true;
      // Même jour : vérifier que l'heure n'est pas passée
      return rdv.heure >= nowHeure;
    }) || null;

    // Graphique CA des 7 derniers jours
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD

      // Utiliser eq pour une date exacte au format YYYY-MM-DD (🔒 TENANT ISOLATION)
      const { data: rdvDay } = await supabase
        .from('reservations')
        .select('prix_total')
        .eq('tenant_id', tenantId)
        .eq('date', dateStr)
        .in('statut', ['confirme', 'termine']);

      const ca = rdvDay?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;

      last7Days.push({
        date: dateStr,
        jour: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        ca
      });
    }

    res.json({
      ca: {
        jour: caJour,
        mois: caMois
      },
      rdv: rdvParStatut,
      servicesPopulaires,
      nbClients: nbClients || 0,
      prochainRdv,
      graphiqueCa: last7Days
    });

  } catch (error) {
    console.error('[ADMIN STATS] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
