/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ANALYTICS SERVICE - KPI, Prédictions & Détection anomalies      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../config/supabase.js';

export class AnalyticsService {

  /**
   * Calcul KPI pour une période donnée
   */
  async getKPI(tenantId, dateDebut, dateFin) {
    console.log(`[ANALYTICS] getKPI called: tenant=${tenantId}, debut=${dateDebut}, fin=${dateFin}`);

    // Réservations période (service_nom est déjà dans reservations, pas besoin de jointure services)
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', dateDebut)
      .lte('date', dateFin);

    console.log(`[ANALYTICS] Query result: ${reservations?.length || 0} reservations, error: ${error?.message || 'none'}`);

    // Période précédente (même durée)
    const dureeJours = Math.ceil((new Date(dateFin) - new Date(dateDebut)) / (1000 * 60 * 60 * 24));
    const dateDebutPrecedent = new Date(new Date(dateDebut).getTime() - dureeJours * 24 * 60 * 60 * 1000);
    const dateFinPrecedent = new Date(new Date(dateFin).getTime() - dureeJours * 24 * 60 * 60 * 1000);

    const { data: reservationsPrecedentes } = await supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', dateDebutPrecedent.toISOString().split('T')[0])
      .lte('date', dateFinPrecedent.toISOString().split('T')[0]);

    // Calculs période actuelle
    const rdvTotal = reservations?.length || 0;
    const rdvConfirmes = reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine').length || 0;
    const rdvAnnules = reservations?.filter(r => r.statut === 'annule').length || 0;

    // Taux TVA par défaut (20% en France)
    const TAUX_TVA_DEFAUT = 0.20;

    // Fonction pour convertir TTC en HT
    const ttcToHt = (prixTtc, tauxTva = TAUX_TVA_DEFAUT) => prixTtc / (1 + tauxTva);

    // CA en HT (les prix en base sont en centimes TTC)
    const caTotalTtc = reservations?.reduce((sum, r) => {
      const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      if (r.statut === 'confirme' || r.statut === 'termine') {
        return sum + prix;
      }
      return sum;
    }, 0) || 0;

    // Convertir en HT
    const caTotal = ttcToHt(caTotalTtc);

    const caMoyen = rdvConfirmes > 0 ? caTotal / rdvConfirmes : 0;

    // Calculs période précédente (également en HT)
    const caPrecedentTtc = reservationsPrecedentes?.reduce((sum, r) => {
      const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      if (r.statut === 'confirme' || r.statut === 'termine') {
        return sum + prix;
      }
      return sum;
    }, 0) || 0;

    const caPrecedent = ttcToHt(caPrecedentTtc);

    const rdvPrecedent = reservationsPrecedentes?.filter(r => r.statut === 'confirme' || r.statut === 'termine').length || 0;

    // Évolutions
    const evolutionCA = caPrecedent > 0 ? ((caTotal - caPrecedent) / caPrecedent * 100) : 0;
    const evolutionRDV = rdvPrecedent > 0 ? ((rdvConfirmes - rdvPrecedent) / rdvPrecedent * 100) : 0;

    // 🚀 OPTIMISATION: 1 requête au lieu de N requêtes (N+1 fix)
    // Récupérer le premier RDV de chaque client en une seule requête
    const clientIds = [...new Set(reservations?.map(r => r.client_id).filter(Boolean))];
    const nouveauxClients = [];

    if (clientIds.length > 0) {
      // Récupérer TOUS les RDV historiques des clients concernés
      const { data: allHistorique } = await supabase
        .from('reservations')
        .select('client_id, date')
        .eq('tenant_id', tenantId)
        .in('client_id', clientIds)
        .order('date', { ascending: true });

      // Grouper par client et trouver le premier RDV de chacun côté JS
      const premierRdvParClient = {};
      allHistorique?.forEach(rdv => {
        // Le premier trouvé est le plus ancien (grâce à l'order ASC)
        if (!premierRdvParClient[rdv.client_id]) {
          premierRdvParClient[rdv.client_id] = rdv.date;
        }
      });

      // Identifier les nouveaux clients (premier RDV dans la période)
      const dateDebutObj = new Date(dateDebut);
      const dateFinObj = new Date(dateFin);

      for (const clientId of clientIds) {
        const premierRdvDate = premierRdvParClient[clientId];
        if (premierRdvDate) {
          const premierRdv = new Date(premierRdvDate);
          if (premierRdv >= dateDebutObj && premierRdv <= dateFinObj) {
            nouveauxClients.push(clientId);
          }
        }
      }
    }

    // Services populaires (CA en HT)
    const servicesStats = {};
    reservations?.forEach(r => {
      const service = r.services?.nom || r.service_nom || 'Autre';
      if (!servicesStats[service]) {
        servicesStats[service] = { count: 0, ca: 0 };
      }
      servicesStats[service].count++;
      if (r.statut === 'confirme' || r.statut === 'termine') {
        const prixTtc = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
        // Convertir en HT
        servicesStats[service].ca += ttcToHt(prixTtc);
      }
    });

    const topServices = Object.entries(servicesStats)
      .map(([nom, stats]) => ({
        nom,
        nb_rdv: stats.count,
        ca_ht_euros: (stats.ca / 100).toFixed(2)
      }))
      .sort((a, b) => b.nb_rdv - a.nb_rdv)
      .slice(0, 5);

    // Jours les plus actifs
    const joursStats = {};
    const joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    reservations?.forEach(r => {
      const jour = joursNoms[new Date(r.date).getDay()];
      joursStats[jour] = (joursStats[jour] || 0) + 1;
    });

    const topJours = Object.entries(joursStats)
      .map(([jour, count]) => ({ jour, nb_rdv: count }))
      .sort((a, b) => b.nb_rdv - a.nb_rdv)
      .slice(0, 3);

    return {
      periode: { debut: dateDebut, fin: dateFin },
      revenus: {
        ca_total_ht: (caTotal / 100).toFixed(2),
        ca_moyen_ht: (caMoyen / 100).toFixed(2),
        evolution_pourcent: evolutionCA.toFixed(1),
        tendance: evolutionCA > 0 ? 'hausse' : evolutionCA < 0 ? 'baisse' : 'stable',
        note: 'Montants HT (TVA 20%)'
      },
      rdv: {
        total: rdvTotal,
        confirmes: rdvConfirmes,
        annules: rdvAnnules,
        taux_confirmation: rdvTotal > 0 ? ((rdvConfirmes / rdvTotal) * 100).toFixed(1) : '0',
        taux_annulation: rdvTotal > 0 ? ((rdvAnnules / rdvTotal) * 100).toFixed(1) : '0',
        evolution_pourcent: evolutionRDV.toFixed(1)
      },
      clients: {
        actifs: clientIds.length,
        nouveaux: nouveauxClients.length,
        panier_moyen_ht: (caMoyen / 100).toFixed(2)
      },
      top_services: topServices,
      jours_populaires: topJours,
      comparaison_periode_precedente: {
        ca_precedent_ht: (caPrecedent / 100).toFixed(2),
        rdv_precedent: rdvPrecedent
      }
    };
  }

  /**
   * Évolution temporelle (série chronologique)
   */
  async getEvolution(tenantId, dateDebut, dateFin, granularite = 'jour') {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('date, statut, prix_total, prix_service, frais_deplacement')
      .eq('tenant_id', tenantId)
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .order('date');

    // Grouper par période
    const series = {};

    reservations?.forEach(r => {
      let cle;
      const date = new Date(r.date);

      if (granularite === 'jour') {
        cle = r.date;
      } else if (granularite === 'semaine') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1); // Lundi
        cle = weekStart.toISOString().split('T')[0];
      } else if (granularite === 'mois') {
        cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!series[cle]) {
        series[cle] = { nb_rdv: 0, ca: 0, confirmes: 0, annules: 0 };
      }

      series[cle].nb_rdv++;

      if (r.statut === 'confirme' || r.statut === 'termine') {
        series[cle].confirmes++;
        const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
        series[cle].ca += prix;
      } else if (r.statut === 'annule') {
        series[cle].annules++;
      }
    });

    const evolution = Object.entries(series)
      .map(([date, stats]) => ({
        date,
        nb_rdv: stats.nb_rdv,
        nb_confirmes: stats.confirmes,
        nb_annules: stats.annules,
        ca_euros: (stats.ca / 100).toFixed(2)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculer totaux et moyennes
    const totalCA = evolution.reduce((sum, e) => sum + parseFloat(e.ca_euros), 0);
    const totalRDV = evolution.reduce((sum, e) => sum + e.nb_rdv, 0);
    const moyenneCA = evolution.length > 0 ? totalCA / evolution.length : 0;
    const moyenneRDV = evolution.length > 0 ? totalRDV / evolution.length : 0;

    return {
      evolution,
      resume: {
        nb_periodes: evolution.length,
        total_ca_euros: totalCA.toFixed(2),
        total_rdv: totalRDV,
        moyenne_ca_euros: moyenneCA.toFixed(2),
        moyenne_rdv: moyenneRDV.toFixed(1)
      }
    };
  }

  /**
   * Prédictions basées sur les mois complets + mois en cours PRORATISÉ
   */
  async getPredictions(tenantId) {
    const today = new Date();
    const jourDuMois = today.getDate();
    const joursEnMois = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const moisEnCoursKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Période: 6 derniers mois jusqu'à aujourd'hui
    const debut6Mois = new Date(today);
    debut6Mois.setMonth(today.getMonth() - 6);
    debut6Mois.setDate(1);

    console.log(`[ANALYTICS] getPredictions - tenant: ${tenantId}`);
    console.log(`[ANALYTICS] Période: ${debut6Mois.toISOString().split('T')[0]} → aujourd'hui`);
    console.log(`[ANALYTICS] Mois en cours: ${moisEnCoursKey}, jour ${jourDuMois}/${joursEnMois}`);

    // Récupérer TOUTES les réservations (y compris mois en cours)
    const { data: allReservations, error } = await supabase
      .from('reservations')
      .select('date, statut, prix_total, prix_service, frais_deplacement, service_nom')
      .eq('tenant_id', tenantId)
      .gte('date', debut6Mois.toISOString().split('T')[0])
      .lte('date', today.toISOString().split('T')[0]);

    // Debug: voir tous les statuts présents
    const statuts = [...new Set(allReservations?.map(r => r.statut) || [])];
    console.log(`[ANALYTICS] getPredictions - ${allReservations?.length || 0} réservations totales, statuts: ${JSON.stringify(statuts)}`);

    // Filtrer sur les statuts valides
    const reservations = allReservations?.filter(r => {
      const s = (r.statut || '').toLowerCase();
      return s === 'confirme' || s === 'confirmé' || s === 'termine' || s === 'terminé';
    }) || [];

    console.log(`[ANALYTICS] getPredictions - ${reservations.length} réservations après filtre statut`);

    // Grouper par mois
    const parMois = {};
    const servicesParMois = {};

    reservations?.forEach(r => {
      const date = new Date(r.date);
      const mois = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!parMois[mois]) {
        parMois[mois] = { nb_rdv: 0, ca: 0, complet: mois !== moisEnCoursKey };
        servicesParMois[mois] = {};
      }

      parMois[mois].nb_rdv++;
      const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      parMois[mois].ca += prix;

      const service = r.service_nom || 'Autre';
      servicesParMois[mois][service] = (servicesParMois[mois][service] || 0) + 1;
    });

    // PRORATISER le mois en cours pour estimer le mois complet
    let moisEnCoursProratise = null;
    if (parMois[moisEnCoursKey] && jourDuMois >= 5) { // Au moins 5 jours pour proratiser
      const facteurProrata = joursEnMois / jourDuMois;
      moisEnCoursProratise = {
        ca_actuel: parMois[moisEnCoursKey].ca,
        ca_estime: Math.round(parMois[moisEnCoursKey].ca * facteurProrata),
        rdv_actuel: parMois[moisEnCoursKey].nb_rdv,
        rdv_estime: Math.round(parMois[moisEnCoursKey].nb_rdv * facteurProrata),
        jours_ecoules: jourDuMois,
        jours_total: joursEnMois,
        facteur: facteurProrata.toFixed(2)
      };
      console.log(`[ANALYTICS] Mois en cours proratisé: ${parMois[moisEnCoursKey].ca}¢ × ${facteurProrata.toFixed(2)} = ${moisEnCoursProratise.ca_estime}¢`);
    }

    // Pour les calculs de tendance, utiliser les mois COMPLETS + le mois en cours proratisé
    const moisKeys = Object.keys(parMois).sort();
    const moisComplets = moisKeys.filter(m => m !== moisEnCoursKey);

    // Créer une copie avec le mois en cours proratisé pour les calculs
    const parMoisPourCalcul = { ...parMois };
    if (moisEnCoursProratise) {
      parMoisPourCalcul[moisEnCoursKey] = {
        nb_rdv: moisEnCoursProratise.rdv_estime,
        ca: moisEnCoursProratise.ca_estime,
        complet: false,
        proratise: true
      };
    }

    // Moyenne mobile sur les 3 derniers mois (complets ou proratisés)
    const derniers3Mois = moisKeys.slice(-3);
    const moyenneMobileCA = derniers3Mois.length > 0
      ? derniers3Mois.reduce((sum, m) => sum + parMoisPourCalcul[m].ca, 0) / derniers3Mois.length
      : 0;
    const moyenneMobileRDV = derniers3Mois.length > 0
      ? derniers3Mois.reduce((sum, m) => sum + parMoisPourCalcul[m].nb_rdv, 0) / derniers3Mois.length
      : 0;

    // Tendance entre les 2 derniers mois
    let tendanceCA = 0;
    let tendanceRDV = 0;
    let dernierMoisCA = 0;
    let dernierMoisRDV = 0;

    if (moisKeys.length >= 1) {
      dernierMoisCA = parMoisPourCalcul[moisKeys[moisKeys.length - 1]].ca;
      dernierMoisRDV = parMoisPourCalcul[moisKeys[moisKeys.length - 1]].nb_rdv;
    }

    if (moisKeys.length >= 2) {
      const dernierMois = parMois[moisKeys[moisKeys.length - 1]];
      const avantDernierMois = parMois[moisKeys[moisKeys.length - 2]];
      tendanceCA = dernierMois.ca - avantDernierMois.ca;
      tendanceRDV = dernierMois.nb_rdv - avantDernierMois.nb_rdv;
    }

    // Prédiction intelligente basée sur la tendance
    let predictionCAProchainMois;
    let predictionRDVProchainMois;

    if (tendanceCA > 0) {
      // Tendance haussière : dernier mois + 70% de la tendance (réaliste mais optimiste)
      predictionCAProchainMois = dernierMoisCA + tendanceCA * 0.7;
      predictionRDVProchainMois = Math.round(dernierMoisRDV + tendanceRDV * 0.7);
    } else if (tendanceCA < 0) {
      // Tendance baissière : dernier mois + 50% de la baisse (conservateur)
      predictionCAProchainMois = dernierMoisCA + tendanceCA * 0.5;
      predictionRDVProchainMois = Math.round(dernierMoisRDV + tendanceRDV * 0.5);
    } else {
      // Tendance stable : maintenir le niveau actuel
      predictionCAProchainMois = dernierMoisCA;
      predictionRDVProchainMois = dernierMoisRDV;
    }

    // Assurer des valeurs positives
    predictionCAProchainMois = Math.max(0, predictionCAProchainMois);
    predictionRDVProchainMois = Math.max(0, predictionRDVProchainMois);

    // Services en hausse (comparer les 2 derniers mois)
    const servicesEnHausse = [];
    if (moisKeys.length >= 2) {
      const dernierMoisServices = servicesParMois[moisKeys[moisKeys.length - 1]] || {};
      const avantDernierMoisServices = servicesParMois[moisKeys[moisKeys.length - 2]] || {};

      for (const [service, count] of Object.entries(dernierMoisServices)) {
        const countPrecedent = avantDernierMoisServices[service] || 0;
        if (count > countPrecedent) {
          servicesEnHausse.push({
            service,
            progression: count - countPrecedent,
            pourcentage: countPrecedent > 0 ? (((count - countPrecedent) / countPrecedent) * 100).toFixed(0) : '+100'
          });
        }
      }
      servicesEnHausse.sort((a, b) => b.progression - a.progression);
    }

    // Détection périodes creuses (jours de la semaine avec moins de RDV)
    const joursStats = [0, 0, 0, 0, 0, 0, 0]; // Dim-Sam
    const joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    reservations?.forEach(r => {
      const jour = new Date(r.date).getDay();
      joursStats[jour]++;
    });

    const moyenneJour = joursStats.reduce((a, b) => a + b, 0) / 7;
    const periodesCreuses = joursStats
      .map((count, i) => ({ jour: joursNoms[i], count }))
      .filter(j => j.count < moyenneJour * 0.5)
      .map(j => j.jour);

    // Niveau de confiance basé sur le volume de données
    let confiance = 'faible';
    if (reservations?.length >= 50) confiance = 'haute';
    else if (reservations?.length >= 20) confiance = 'moyenne';

    // Noms des mois pour l'affichage
    const moisEnCoursNom = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const moisProchainDate = new Date(today);
    moisProchainDate.setMonth(today.getMonth() + 1);
    const moisProchainNom = moisProchainDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Message explicatif de la méthode utilisée
    let methodeCalcul = '';
    if (moisEnCoursProratise) {
      methodeCalcul = `Février en cours (${moisEnCoursProratise.ca_actuel/100}€ sur ${jourDuMois}j) → estimé ${moisEnCoursProratise.ca_estime/100}€ sur ${joursEnMois}j. Tendance calculée: janvier → février proratisé.`;
    } else if (moisComplets.length >= 2) {
      methodeCalcul = `Basé sur tendance des mois complets: ${moisComplets.slice(-2).join(' → ')}`;
    } else {
      methodeCalcul = 'Historique insuffisant pour une prédiction fiable';
    }

    return {
      mois_en_cours: moisEnCoursProratise ? {
        nom: moisEnCoursNom,
        jour_actuel: jourDuMois,
        jours_total: joursEnMois,
        ca_actuel_euros: (moisEnCoursProratise.ca_actuel / 100).toFixed(2),
        ca_estime_mois_complet_euros: (moisEnCoursProratise.ca_estime / 100).toFixed(2),
        rdv_actuel: moisEnCoursProratise.rdv_actuel,
        rdv_estime_mois_complet: moisEnCoursProratise.rdv_estime
      } : null,
      prediction_mois_prochain: {
        nom: moisProchainNom,
        ca_prevu_euros: (predictionCAProchainMois / 100).toFixed(2),
        nb_rdv_prevu: predictionRDVProchainMois,
        confiance,
        methode: methodeCalcul
      },
      historique_mensuel: moisKeys.slice(-6).map(m => ({
        mois: m,
        mois_nom: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        ca_euros: (parMois[m].ca / 100).toFixed(2),
        nb_rdv: parMois[m].nb_rdv,
        complet: m !== moisEnCoursKey,
        proratise: m === moisEnCoursKey && moisEnCoursProratise ? `estimé ${(moisEnCoursProratise.ca_estime/100).toFixed(0)}€` : null
      })),
      tendance_globale: tendanceCA > 0 ? 'hausse' : tendanceCA < 0 ? 'baisse' : 'stable',
      croissance_pourcent: moisKeys.length >= 2 && parMoisPourCalcul[moisKeys[moisKeys.length - 2]]?.ca > 0
        ? ((tendanceCA / parMoisPourCalcul[moisKeys[moisKeys.length - 2]].ca) * 100).toFixed(0)
        : '0',
      services_en_hausse: servicesEnHausse.slice(0, 3),
      periodes_creuses: periodesCreuses,
      recommandations: this._genererRecommandations(tendanceCA, periodesCreuses, servicesEnHausse),
      _debug: {
        periode_analysee: `${debut6Mois.toISOString().split('T')[0]} → ${today.toISOString().split('T')[0]}`,
        total_reservations: allReservations?.length || 0,
        reservations_filtrees: reservations.length,
        statuts_trouves: statuts,
        mois_complets: moisComplets,
        mois_en_cours_proratise: moisEnCoursProratise,
        dernier_mois_ca_centimes: dernierMoisCA,
        tendance_ca_centimes: tendanceCA
      }
    };
  }

  /**
   * Générer des recommandations basées sur les données
   */
  _genererRecommandations(tendance, periodesCreuses, servicesEnHausse) {
    const recommandations = [];

    if (tendance < 0) {
      recommandations.push({
        type: 'alerte',
        message: 'Tendance à la baisse détectée',
        action: 'Lancer une campagne de relance clients inactifs'
      });
    }

    if (periodesCreuses.length > 0) {
      recommandations.push({
        type: 'opportunite',
        message: `Jours creux détectés : ${periodesCreuses.join(', ')}`,
        action: 'Proposer des promotions sur ces jours'
      });
    }

    if (servicesEnHausse.length > 0) {
      recommandations.push({
        type: 'opportunite',
        message: `Service en hausse : ${servicesEnHausse[0].service}`,
        action: 'Mettre en avant ce service dans la communication'
      });
    }

    return recommandations;
  }

  /**
   * Détection d'anomalies
   */
  async getAnomalies(tenantId) {
    const today = new Date();
    const debut30j = new Date(today);
    debut30j.setDate(today.getDate() - 30);
    const debut60j = new Date(today);
    debut60j.setDate(today.getDate() - 60);

    // Données 30 derniers jours
    const { data: reservations30j } = await supabase
      .from('reservations')
      .select('date, statut, prix_total, prix_service, frais_deplacement')
      .eq('tenant_id', tenantId)
      .gte('date', debut30j.toISOString().split('T')[0]);

    // Données 30-60 jours (période précédente pour comparaison)
    const { data: reservations60j } = await supabase
      .from('reservations')
      .select('date, statut, prix_total, prix_service, frais_deplacement')
      .eq('tenant_id', tenantId)
      .gte('date', debut60j.toISOString().split('T')[0])
      .lt('date', debut30j.toISOString().split('T')[0]);

    const anomalies = [];

    // Anomalie 1 : Taux annulation élevé
    const totalRdv = reservations30j?.length || 0;
    const annules = reservations30j?.filter(r => r.statut === 'annule').length || 0;
    const tauxAnnulation = totalRdv > 0 ? (annules / totalRdv) * 100 : 0;

    if (tauxAnnulation > 25) {
      anomalies.push({
        type: 'taux_annulation_eleve',
        severite: tauxAnnulation > 40 ? 'critique' : 'haute',
        valeur: tauxAnnulation.toFixed(1) + '%',
        seuil: '25%',
        message: `Taux d'annulation élevé (${tauxAnnulation.toFixed(1)}%)`,
        recommandation: 'Envoyer des rappels SMS 24h et 2h avant les RDV',
        impact_estime: `~${annules} RDV perdus ce mois`
      });
    }

    // Anomalie 2 : Baisse d'activité significative
    const rdv30j = reservations30j?.filter(r => r.statut === 'confirme' || r.statut === 'termine').length || 0;
    const rdv60j = reservations60j?.filter(r => r.statut === 'confirme' || r.statut === 'termine').length || 0;

    if (rdv60j > 0) {
      const baisseActivite = ((rdv60j - rdv30j) / rdv60j) * 100;
      if (baisseActivite > 30) {
        anomalies.push({
          type: 'baisse_activite',
          severite: baisseActivite > 50 ? 'haute' : 'moyenne',
          valeur: `-${baisseActivite.toFixed(0)}%`,
          message: `Baisse d'activité de ${baisseActivite.toFixed(0)}% vs mois précédent`,
          recommandation: 'Lancer une campagne de relance ou promotion',
          comparaison: `${rdv30j} RDV ce mois vs ${rdv60j} le mois précédent`
        });
      }
    }

    // Anomalie 3 : CA anormalement bas
    const ca30j = reservations30j?.reduce((sum, r) => {
      if (r.statut === 'confirme' || r.statut === 'termine') {
        return sum + (r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0));
      }
      return sum;
    }, 0) || 0;

    const ca60j = reservations60j?.reduce((sum, r) => {
      if (r.statut === 'confirme' || r.statut === 'termine') {
        return sum + (r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0));
      }
      return sum;
    }, 0) || 0;

    if (ca60j > 0) {
      const baisseCA = ((ca60j - ca30j) / ca60j) * 100;
      if (baisseCA > 30) {
        anomalies.push({
          type: 'baisse_ca',
          severite: baisseCA > 50 ? 'haute' : 'moyenne',
          valeur: `-${baisseCA.toFixed(0)}%`,
          message: `Baisse du CA de ${baisseCA.toFixed(0)}% vs mois précédent`,
          recommandation: 'Augmenter le panier moyen avec ventes additionnelles',
          comparaison: `${(ca30j/100).toFixed(0)}€ ce mois vs ${(ca60j/100).toFixed(0)}€ le mois précédent`
        });
      }
    }

    // Anomalie 4 : Concentration excessive sur un jour
    const joursStats = {};
    reservations30j?.forEach(r => {
      const jour = new Date(r.date).getDay();
      joursStats[jour] = (joursStats[jour] || 0) + 1;
    });

    const joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const totalJours = Object.values(joursStats).reduce((a, b) => a + b, 0);

    for (const [jour, count] of Object.entries(joursStats)) {
      const pourcentage = (count / totalJours) * 100;
      if (pourcentage > 40) {
        anomalies.push({
          type: 'concentration_jour',
          severite: 'info',
          valeur: `${pourcentage.toFixed(0)}%`,
          message: `${pourcentage.toFixed(0)}% des RDV concentrés le ${joursNoms[jour]}`,
          recommandation: 'Proposer des créneaux sur d\'autres jours pour équilibrer'
        });
      }
    }

    // Trier par sévérité
    const severiteOrdre = { critique: 0, haute: 1, moyenne: 2, info: 3 };
    anomalies.sort((a, b) => severiteOrdre[a.severite] - severiteOrdre[b.severite]);

    return {
      periode_analysee: '30 derniers jours',
      date_analyse: today.toISOString(),
      nb_anomalies: anomalies.length,
      resume: {
        critiques: anomalies.filter(a => a.severite === 'critique').length,
        hautes: anomalies.filter(a => a.severite === 'haute').length,
        moyennes: anomalies.filter(a => a.severite === 'moyenne').length,
        info: anomalies.filter(a => a.severite === 'info').length
      },
      anomalies,
      sante_globale: anomalies.filter(a => a.severite === 'critique' || a.severite === 'haute').length === 0
        ? 'bonne'
        : anomalies.some(a => a.severite === 'critique') ? 'critique' : 'attention_requise'
    };
  }

  /**
   * Rapport complet (combinaison de toutes les métriques)
   */
  async getRapportComplet(tenantId, dateDebut, dateFin) {
    const [kpi, evolution, predictions, anomalies] = await Promise.all([
      this.getKPI(tenantId, dateDebut, dateFin),
      this.getEvolution(tenantId, dateDebut, dateFin, 'jour'),
      this.getPredictions(tenantId),
      this.getAnomalies(tenantId)
    ]);

    return {
      genere_le: new Date().toISOString(),
      periode: { debut: dateDebut, fin: dateFin },
      kpi,
      evolution: evolution.evolution,
      predictions,
      anomalies: anomalies.anomalies,
      sante_globale: anomalies.sante_globale
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
