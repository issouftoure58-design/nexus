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

    // CA du mois — réservations + factures + commandes (🔒 TENANT ISOLATION)
    const { data: rdvMois } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .gte('date', startOfMonth)
      .in('statut', ['confirme', 'termine']);

    const { data: facturesMois } = await supabase
      .from('factures')
      .select('montant_ttc')
      .eq('tenant_id', tenantId)
      .eq('statut', 'payee')
      .is('reservation_id', null)
      .gte('date_paiement', `${startOfMonth}T00:00:00`);

    const { data: ordersMois } = await supabase
      .from('orders')
      .select('total')
      .eq('tenant_id', tenantId)
      .in('statut', ['completed', 'ready'])
      .gte('created_at', `${startOfMonth}T00:00:00`);

    const caRdvMois = rdvMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;
    const caFacturesMois = facturesMois?.reduce((sum, f) => sum + (parseFloat(f.montant_ttc) || 0), 0) / 100 || 0;
    const caOrdersMois = ordersMois?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) / 100 || 0;
    const caMois = caRdvMois + caFacturesMois + caOrdersMois;

    // CA du jour — réservations + factures + commandes (🔒 TENANT ISOLATION)
    const { data: rdvJour } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .eq('date', today)
      .in('statut', ['confirme', 'termine']);

    const { data: facturesJour } = await supabase
      .from('factures')
      .select('montant_ttc')
      .eq('tenant_id', tenantId)
      .eq('statut', 'payee')
      .is('reservation_id', null)
      .gte('date_paiement', `${today}T00:00:00`)
      .lt('date_paiement', `${today}T23:59:59`);

    const { data: ordersJour } = await supabase
      .from('orders')
      .select('total')
      .eq('tenant_id', tenantId)
      .in('statut', ['completed', 'ready'])
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    const caRdvJour = rdvJour?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;
    const caFacturesJour = facturesJour?.reduce((sum, f) => sum + (parseFloat(f.montant_ttc) || 0), 0) / 100 || 0;
    const caOrdersJour = ordersJour?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) / 100 || 0;
    const caJour = caRdvJour + caFacturesJour + caOrdersJour;

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

    // 🚀 OPTIMISATION: 1 requête au lieu de 7 requêtes séquentielles
    // Calculer la plage de dates
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Requêtes parallèles pour les 7 derniers jours (réservations + factures + commandes)
    const [{ data: rdvWeek }, { data: facturesWeek }, { data: ordersWeek }] = await Promise.all([
      supabase.from('reservations').select('prix_total, date')
        .eq('tenant_id', tenantId).gte('date', startDateStr).lte('date', today)
        .in('statut', ['confirme', 'termine']),
      supabase.from('factures').select('montant_ttc, date_paiement')
        .eq('tenant_id', tenantId).eq('statut', 'payee')
        .gte('date_paiement', `${startDateStr}T00:00:00`),
      supabase.from('orders').select('total, created_at')
        .eq('tenant_id', tenantId).in('statut', ['completed', 'ready'])
        .gte('created_at', `${startDateStr}T00:00:00`),
    ]);

    // Grouper par date côté JS
    const caByDate = {};
    rdvWeek?.forEach(rdv => {
      if (!caByDate[rdv.date]) caByDate[rdv.date] = 0;
      caByDate[rdv.date] += (rdv.prix_total || 0) / 100; // centimes → euros
    });
    facturesWeek?.forEach(f => {
      const d = f.date_paiement?.split('T')[0];
      if (d) { caByDate[d] = (caByDate[d] || 0) + (parseFloat(f.montant_ttc) || 0) / 100; }
    });
    ordersWeek?.forEach(o => {
      const d = o.created_at?.split('T')[0];
      if (d) { caByDate[d] = (caByDate[d] || 0) + (parseFloat(o.total) || 0) / 100; }
    });

    // Construire le tableau des 7 derniers jours
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      last7Days.push({
        date: dateStr,
        jour: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        ca: caByDate[dateStr] || 0
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

// GET /api/admin/stats/activity
router.get('/activity', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const activities = [];

    // Dernières réservations (confirmées/créées aujourd'hui)
    const today = new Date().toISOString().split('T')[0];
    const { data: recentRdv } = await supabase
      .from('reservations')
      .select('id, statut, heure, created_at, clients(prenom, nom)')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    recentRdv?.forEach(rdv => {
      const clientName = rdv.clients ? `${rdv.clients.prenom} ${rdv.clients.nom}` : 'Client';
      if (rdv.statut === 'confirme') {
        activities.push({
          type: 'rdv_confirmed',
          message: `${clientName} - RDV confirmé ${rdv.heure || ''}`,
          time: rdv.created_at
        });
      } else if (rdv.statut === 'demande' || rdv.statut === 'en_attente') {
        activities.push({
          type: 'rdv_pending',
          message: `Demande de RDV de ${clientName}`,
          time: rdv.created_at
        });
      }
    });

    // Nouveaux clients
    const { data: newClients } = await supabase
      .from('clients')
      .select('id, prenom, nom, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    newClients?.forEach(client => {
      activities.push({
        type: 'new_client',
        message: `Nouveau client: ${client.prenom} ${client.nom}`,
        time: client.created_at
      });
    });

    // Stock bas
    const { data: lowStock } = await supabase
      .from('produits')
      .select('id, nom, quantite_stock, seuil_alerte')
      .eq('tenant_id', tenantId)
      .lt('quantite_stock', 5)
      .limit(3);

    lowStock?.forEach(product => {
      activities.push({
        type: 'alert',
        message: `Stock bas: ${product.nom}`,
        time: new Date().toISOString()
      });
    });

    // Trier par date
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Formater les temps relatifs
    const formattedActivities = activities.slice(0, 10).map((a, i) => ({
      id: i + 1,
      type: a.type,
      message: a.message,
      time: formatRelativeTime(a.time)
    }));

    res.json({ activities: formattedActivities });

  } catch (error) {
    console.error('[ADMIN STATS] Activity error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'A l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  return `Il y a ${diffDay}j`;
}

// GET /api/admin/stats/automation - Stats d'automatisation (workflows, emails, SMS)
router.get('/automation', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Compter les workflows actifs
    const { count: workflowsActifs } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Compter les exécutions de workflow ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: executionsMois } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString());

    // Stats notifications (notification_deliveries ou notifications_log)
    let emailsSent = 0;
    let smsSent = 0;
    let whatsappSent = 0;

    try {
      const { data: deliveries } = await supabase
        .from('notification_deliveries')
        .select('channel')
        .eq('tenant_id', tenantId)
        .in('status', ['sent', 'delivered', 'read'])
        .gte('created_at', startOfMonth.toISOString());

      if (deliveries) {
        emailsSent = deliveries.filter(d => d.channel === 'email').length;
        smsSent = deliveries.filter(d => d.channel === 'sms').length;
        whatsappSent = deliveries.filter(d => d.channel === 'whatsapp').length;
      }
    } catch {
      // Fallback: try notifications_log
      try {
        const { count: emails } = await supabase
          .from('notifications_log')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('type', 'email')
          .gte('created_at', startOfMonth.toISOString());
        emailsSent = emails || 0;

        const { count: sms } = await supabase
          .from('notifications_log')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('type', 'sms')
          .gte('created_at', startOfMonth.toISOString());
        smsSent = sms || 0;
      } catch {
        // Neither table exists
      }
    }

    // Vrais workflows avec executions reelles
    const { data: activeWorkflows } = await supabase
      .from('workflows')
      .select('id, nom, trigger_type, executions_count')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('executions_count', { ascending: false })
      .limit(10);

    // Taches completees ce mois
    let tasksCompleted = 0;
    try {
      const { count } = await supabase
        .from('admin_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('statut', 'completed')
        .gte('completed_at', startOfMonth.toISOString());
      tasksCompleted = count || 0;
    } catch {
      // Table might not exist
    }

    const totalNotifications = emailsSent + smsSent + whatsappSent;

    res.json({
      workflows: {
        actifs: workflowsActifs || 0,
        executions_mois: executionsMois || 0,
        liste: (activeWorkflows || []).map(w => ({
          nom: w.nom,
          trigger: w.trigger_type,
          executions: w.executions_count || 0
        }))
      },
      notifications: {
        emails_mois: emailsSent,
        sms_mois: smsSent,
        whatsapp_mois: whatsappSent,
        total_mois: totalNotifications
      },
      taches: {
        completees_mois: tasksCompleted
      }
    });

  } catch (error) {
    console.error('[ADMIN STATS] Automation error:', error);
    // Retourner des données vides plutôt qu'une erreur
    res.json({
      workflows: { actifs: 0, executions_mois: 0 },
      notifications: { emails_mois: 0, sms_mois: 0 },
      automations: []
    });
  }
});

export default router;
