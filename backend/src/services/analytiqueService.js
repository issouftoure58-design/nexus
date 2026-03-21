/**
 * Service Comptabilité Analytique
 * Agrégation CA par service, par collaborateur, marges, seuil de rentabilité
 */

import { supabase } from '../config/supabase.js';

// Classification SIG (Soldes Intermédiaires de Gestion) par type de business :
//   - "sig" = niveau dans la cascade SIG :
//     achat     → consommations (marge brute = CA - achats consommés)
//     personnel → charges de personnel (EBE = marge brute - personnel)
//     externe   → charges externes (résultat = EBE - externes)
//   - "variable" = true si le coût varie avec le volume d'activité
//     Utilisé pour le seuil de rentabilité = Charges fixes / Taux de marge sur coûts variables
const CLASSIFICATIONS = {
  // Salon : fournitures (colorations, produits) = achats consommés, variables
  salon: {
    fournitures:           { sig: 'achat',     variable: true },   // matières consommées
    salaires:              { sig: 'personnel', variable: false },
    cotisations_sociales:  { sig: 'personnel', variable: false },
    formation:             { sig: 'externe',   variable: false },
    materiel:              { sig: 'externe',   variable: false },
    loyer:                 { sig: 'externe',   variable: false },
    charges:               { sig: 'externe',   variable: false },
    assurance:             { sig: 'externe',   variable: false },
    telecom:               { sig: 'externe',   variable: false },
    logiciel:              { sig: 'externe',   variable: false },
    comptabilite:          { sig: 'externe',   variable: false },
    transport:             { sig: 'externe',   variable: false },
    marketing:             { sig: 'externe',   variable: false },
    bancaire:              { sig: 'externe',   variable: false },
    taxes:                 { sig: 'externe',   variable: false },
    autre:                 { sig: 'externe',   variable: false },
  },
  // Restaurant : food cost (fournitures) + énergie cuisine + livraisons = achats/variables
  restaurant: {
    fournitures:           { sig: 'achat',     variable: true },   // matières premières
    charges:               { sig: 'achat',     variable: true },   // gaz, élec cuisine
    transport:             { sig: 'achat',     variable: true },   // livraisons fournisseurs
    salaires:              { sig: 'personnel', variable: false },
    cotisations_sociales:  { sig: 'personnel', variable: false },
    materiel:              { sig: 'externe',   variable: false },
    formation:             { sig: 'externe',   variable: false },
    loyer:                 { sig: 'externe',   variable: false },
    assurance:             { sig: 'externe',   variable: false },
    telecom:               { sig: 'externe',   variable: false },
    logiciel:              { sig: 'externe',   variable: false },
    comptabilite:          { sig: 'externe',   variable: false },
    marketing:             { sig: 'externe',   variable: false },
    bancaire:              { sig: 'externe',   variable: false },
    taxes:                 { sig: 'externe',   variable: false },
    autre:                 { sig: 'externe',   variable: false },
  },
  // Hôtel : fournitures + charges varient avec le taux d'occupation
  hotel: {
    fournitures:           { sig: 'achat',     variable: true },   // linge, produits d'accueil
    charges:               { sig: 'achat',     variable: true },   // élec, eau, chauffage
    salaires:              { sig: 'personnel', variable: false },
    cotisations_sociales:  { sig: 'personnel', variable: false },
    materiel:              { sig: 'externe',   variable: false },
    formation:             { sig: 'externe',   variable: false },
    loyer:                 { sig: 'externe',   variable: false },
    assurance:             { sig: 'externe',   variable: false },
    telecom:               { sig: 'externe',   variable: false },
    logiciel:              { sig: 'externe',   variable: false },
    comptabilite:          { sig: 'externe',   variable: false },
    transport:             { sig: 'externe',   variable: false },
    marketing:             { sig: 'externe',   variable: false },
    bancaire:              { sig: 'externe',   variable: false },
    taxes:                 { sig: 'externe',   variable: false },
    autre:                 { sig: 'externe',   variable: false },
  },
  // Service à domicile : transport + fournitures = achats consommés, variables
  service_domicile: {
    fournitures:           { sig: 'achat',     variable: true },   // matériaux consommés
    transport:             { sig: 'achat',     variable: true },   // km par intervention
    salaires:              { sig: 'personnel', variable: false },
    cotisations_sociales:  { sig: 'personnel', variable: false },
    materiel:              { sig: 'externe',   variable: false },
    formation:             { sig: 'externe',   variable: false },
    loyer:                 { sig: 'externe',   variable: false },
    charges:               { sig: 'externe',   variable: false },
    assurance:             { sig: 'externe',   variable: false },
    telecom:               { sig: 'externe',   variable: false },
    logiciel:              { sig: 'externe',   variable: false },
    comptabilite:          { sig: 'externe',   variable: false },
    marketing:             { sig: 'externe',   variable: false },
    bancaire:              { sig: 'externe',   variable: false },
    taxes:                 { sig: 'externe',   variable: false },
    autre:                 { sig: 'externe',   variable: false },
  },
};

const DEFAULT_CLASSIFICATION = { sig: 'externe', variable: false };

function getClassification(businessType) {
  return CLASSIFICATIONS[businessType] || CLASSIFICATIONS.salon;
}

/**
 * Comptabilité analytique complète pour un tenant sur une période
 * @param {string} tenantId - ID du tenant
 * @param {string} dateDebut - Date début YYYY-MM-DD
 * @param {string} dateFin - Date fin YYYY-MM-DD
 * @param {string} businessType - Type de business (salon, restaurant, hotel, service_domicile)
 */
export async function getComptabiliteAnalytique(tenantId, dateDebut, dateFin, businessType = 'salon') {
  if (!tenantId) throw new Error('tenant_id requis');

  console.log(`[ANALYTIQUE] Calcul pour ${tenantId} du ${dateDebut} au ${dateFin}`);

  // 4 requêtes parallèles
  const [facturesResult, depensesResult, reservationsResult, membresResult] = await Promise.all([
    // 1. Factures émises (payée + envoyée) — brouillons et annulées exclus (norme PCG)
    supabase
      .from('factures')
      .select('montant_ht, montant_ttc, montant_tva, service_nom, date_facture')
      .eq('tenant_id', tenantId)
      .in('statut', ['payee', 'envoyee'])
      .gte('date_facture', dateDebut)
      .lte('date_facture', dateFin),

    // 2. Dépenses sur la période
    supabase
      .from('depenses')
      .select('montant, montant_ttc, montant_tva, categorie, date_depense')
      .eq('tenant_id', tenantId)
      .gte('date_depense', dateDebut)
      .lte('date_depense', dateFin),

    // 3. Réservations confirmées/terminées avec lignes et membres
    supabase
      .from('reservations')
      .select(`
        id, date, prix_total, montant_ht, montant_tva, statut,
        reservation_lignes(service_nom, prix_total, membre_id),
        reservation_membres(membre_id)
      `)
      .eq('tenant_id', tenantId)
      .in('statut', ['confirme', 'termine'])
      .gte('date', dateDebut)
      .lte('date', dateFin),

    // 4. Membres RH actifs
    supabase
      .from('rh_membres')
      .select('id, nom, prenom, role')
      .eq('tenant_id', tenantId)
      .eq('statut', 'actif'),
  ]);

  const factures = facturesResult.data || [];
  const depenses = depensesResult.data || [];
  const reservations = reservationsResult.data || [];
  const membres = membresResult.data || [];

  // Récupérer les bulletins de paie pour les salaires sur la période
  const { data: bulletins } = await supabase
    .from('rh_bulletins_paie')
    .select('membre_id, salaire_base')
    .eq('tenant_id', tenantId)
    .gte('periode_debut', dateDebut)
    .lte('periode_debut', dateFin);

  // --- Agrégation par service (depuis factures) ---
  const serviceMap = {};
  for (const f of factures) {
    const nom = f.service_nom || 'Non catégorisé';
    if (!serviceMap[nom]) {
      serviceMap[nom] = { nom, ca_ht: 0, ca_ttc: 0, tva: 0, nb_factures: 0 };
    }
    serviceMap[nom].ca_ht += parseFloat(f.montant_ht || f.montant_ttc || 0) / 100;
    serviceMap[nom].ca_ttc += parseFloat(f.montant_ttc || f.montant_ht || 0) / 100;
    serviceMap[nom].tva += parseFloat(f.montant_tva || 0) / 100;
    serviceMap[nom].nb_factures += 1;
  }
  const par_service = Object.values(serviceMap).sort((a, b) => b.ca_ht - a.ca_ht);

  // --- Agrégation par collaborateur (depuis réservations) ---
  const collabMap = {};
  // Index membres par id
  const membresById = {};
  for (const m of membres) {
    membresById[m.id] = m;
  }

  // Salaires mensuels par membre (moyenne sur la période)
  const salairesParMembre = {};
  for (const b of (bulletins || [])) {
    if (!salairesParMembre[b.membre_id]) {
      salairesParMembre[b.membre_id] = { total: 0, count: 0 };
    }
    salairesParMembre[b.membre_id].total += parseFloat(b.salaire_base || 0) / 100;
    salairesParMembre[b.membre_id].count += 1;
  }

  for (const rdv of reservations) {
    // Identifier les membres associés
    const membreIds = new Set();

    // Depuis reservation_membres
    if (rdv.reservation_membres?.length > 0) {
      for (const rm of rdv.reservation_membres) {
        membreIds.add(rm.membre_id);
      }
    }
    // Depuis reservation_lignes
    if (rdv.reservation_lignes?.length > 0) {
      for (const rl of rdv.reservation_lignes) {
        if (rl.membre_id) membreIds.add(rl.membre_id);
      }
    }

    const caRdv = parseFloat(rdv.prix_total || 0) / 100;

    if (membreIds.size === 0) {
      // RDV sans membre assigné → catégorie "Non assigné"
      const key = 'non_assigne';
      if (!collabMap[key]) {
        collabMap[key] = { nom: 'Non assigné', role: '-', ca: 0, nb_rdv: 0, salaire_mensuel: 0 };
      }
      collabMap[key].ca += caRdv;
      collabMap[key].nb_rdv += 1;
    } else {
      // Répartir le CA entre les membres
      const caParMembre = caRdv / membreIds.size;
      for (const mid of membreIds) {
        const key = `membre_${mid}`;
        if (!collabMap[key]) {
          const m = membresById[mid];
          const salaire = salairesParMembre[mid]
            ? salairesParMembre[mid].total / salairesParMembre[mid].count
            : 0;
          collabMap[key] = {
            nom: m ? `${m.prenom} ${m.nom}` : `Membre #${mid}`,
            role: m?.role || 'inconnu',
            ca: 0,
            nb_rdv: 0,
            salaire_mensuel: Math.round(salaire * 100) / 100,
          };
        }
        collabMap[key].ca += caParMembre;
        collabMap[key].nb_rdv += 1;
      }
    }
  }
  const par_collaborateur = Object.values(collabMap).sort((a, b) => b.ca - a.ca);

  // --- Dépenses par catégorie ---
  const classification = getClassification(businessType);
  const catMap = {};
  for (const d of depenses) {
    const cat = d.categorie || 'autre';
    const classif = classification[cat] || DEFAULT_CLASSIFICATION;
    if (!catMap[cat]) {
      catMap[cat] = { categorie: cat, total: 0, count: 0, sig: classif.sig, variable: classif.variable };
    }
    catMap[cat].total += parseFloat(d.montant || 0) / 100;
    catMap[cat].count += 1;
  }
  const depenses_par_categorie = Object.values(catMap).sort((a, b) => b.total - a.total);

  // --- Synthèse SIG (Soldes Intermédiaires de Gestion) ---
  const ca_ht = par_service.reduce((sum, s) => sum + s.ca_ht, 0);

  // Cascade SIG : CA → Marge brute → EBE → Résultat net
  const consommations = depenses_par_categorie
    .filter(d => d.sig === 'achat')
    .reduce((sum, d) => sum + d.total, 0);
  const charges_personnel = depenses_par_categorie
    .filter(d => d.sig === 'personnel')
    .reduce((sum, d) => sum + d.total, 0);
  const charges_externes = depenses_par_categorie
    .filter(d => d.sig === 'externe')
    .reduce((sum, d) => sum + d.total, 0);

  // Marge brute = CA - consommations (fournitures, matières premières)
  const marge_brute = ca_ht - consommations;
  const taux_marge_brute = ca_ht > 0 ? (marge_brute / ca_ht) * 100 : 0;

  // EBE = Marge brute - charges de personnel
  const ebe = marge_brute - charges_personnel;
  const taux_ebe = ca_ht > 0 ? (ebe / ca_ht) * 100 : 0;

  // Résultat net = EBE - charges externes
  const resultat_net = ebe - charges_externes;
  const marge_nette = ca_ht > 0 ? (resultat_net / ca_ht) * 100 : 0;

  // Coûts variables vs fixes → pour le seuil de rentabilité
  const couts_variables = depenses_par_categorie
    .filter(d => d.variable)
    .reduce((sum, d) => sum + d.total, 0);
  const charges_fixes = depenses_par_categorie
    .filter(d => !d.variable)
    .reduce((sum, d) => sum + d.total, 0);

  // Seuil de rentabilité = charges fixes / taux de marge sur coûts variables
  const marge_sur_cv = ca_ht - couts_variables;
  const taux_marge_cv = ca_ht > 0 ? (marge_sur_cv / ca_ht) * 100 : 0;
  const seuil_rentabilite = taux_marge_cv > 0 ? charges_fixes / (taux_marge_cv / 100) : 0;
  const point_mort_atteint = ca_ht >= seuil_rentabilite;

  const synthese = {
    ca_ht: round2(ca_ht),
    consommations: round2(consommations),
    charges_personnel: round2(charges_personnel),
    charges_externes: round2(charges_externes),
    marge_brute: round2(marge_brute),
    taux_marge_brute: round2(taux_marge_brute),
    ebe: round2(ebe),
    taux_ebe: round2(taux_ebe),
    resultat_net: round2(resultat_net),
    marge_nette: round2(marge_nette),
    couts_variables: round2(couts_variables),
    charges_fixes: round2(charges_fixes),
    taux_marge_cv: round2(taux_marge_cv),
    seuil_rentabilite: round2(seuil_rentabilite),
    point_mort_atteint,
  };

  // --- Tendance mensuelle (CA par service par mois) ---
  const tendanceMap = {};
  for (const f of factures) {
    const mois = (f.date_facture || '').substring(0, 7); // YYYY-MM
    if (!mois) continue;
    if (!tendanceMap[mois]) tendanceMap[mois] = { mois };
    const nom = f.service_nom || 'Autre';
    tendanceMap[mois][nom] = (tendanceMap[mois][nom] || 0) + parseFloat(f.montant_ht || f.montant_ttc || 0) / 100;
  }
  const tendance_mensuelle = Object.values(tendanceMap).sort((a, b) => a.mois.localeCompare(b.mois));

  console.log(`[ANALYTIQUE] Résultat: CA=${synthese.ca_ht}€, Marge brute=${synthese.taux_marge_brute}%, EBE=${synthese.ebe}€, Seuil=${synthese.seuil_rentabilite}€`);

  return {
    par_service,
    par_collaborateur,
    depenses: { par_categorie: depenses_par_categorie },
    synthese,
    tendance_mensuelle,
  };
}

/**
 * Top clients par CA sur une période
 */
export async function getTopClients(tenantId, dateDebut, dateFin) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: factures, error } = await supabase
    .from('factures')
    .select('client_id, client_nom, montant_ht, montant_ttc, date_facture')
    .eq('tenant_id', tenantId)
    .in('statut', ['payee', 'envoyee'])
    .gte('date_facture', dateDebut)
    .lte('date_facture', dateFin);

  if (error) throw error;

  const clientMap = {};
  for (const f of (factures || [])) {
    const key = f.client_id || f.client_nom || 'Inconnu';
    if (!clientMap[key]) {
      clientMap[key] = { client_id: f.client_id, client_nom: f.client_nom || 'Inconnu', ca_ht: 0, ca_ttc: 0, nb_factures: 0, derniere_facture: null };
    }
    clientMap[key].ca_ht += parseFloat(f.montant_ht || f.montant_ttc || 0) / 100;
    clientMap[key].ca_ttc += parseFloat(f.montant_ttc || f.montant_ht || 0) / 100;
    clientMap[key].nb_factures += 1;
    if (!clientMap[key].derniere_facture || f.date_facture > clientMap[key].derniere_facture) {
      clientMap[key].derniere_facture = f.date_facture;
    }
  }

  return Object.values(clientMap)
    .map(c => ({
      ...c,
      ca_ht: round2(c.ca_ht),
      ca_ttc: round2(c.ca_ttc),
      ca_moyen: c.nb_factures > 0 ? round2(c.ca_ht / c.nb_factures) : 0,
    }))
    .sort((a, b) => b.ca_ht - a.ca_ht);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
