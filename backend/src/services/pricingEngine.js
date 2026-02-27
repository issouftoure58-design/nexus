/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRICING ENGINE
 * Moteur de calcul de prix adaptatif selon le profil métier
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Calculer le prix d'une prestation selon le profil et les paramètres
 * @param {object} profile - Profil métier du tenant
 * @param {object} service - Service/prestation
 * @param {object} params - Paramètres de la réservation
 * @returns {object} { prix_ht, prix_ttc, tva, details }
 */
export function calculatePricing(profile, service, params) {
  const {
    quantity = 1,
    startTime,
    endTime,
    startDate,
    endDate,
    options = [],
    remise = null,
    fraisDeplacement = 0,
  } = params;

  // Déterminer le mode de tarification
  const pricingMode = params.pricingMode || service.pricing_mode || profile.pricing.mode;

  let prixBase = 0;
  let details = {};

  switch (pricingMode) {
    case 'hourly':
      const result = calculateHourlyPrice(service, { startTime, endTime, quantity });
      prixBase = result.total;
      details = result.details;
      break;

    case 'daily':
      const dailyResult = calculateDailyPrice(service, { startDate, endDate, quantity });
      prixBase = dailyResult.total;
      details = dailyResult.details;
      break;

    case 'package':
      const packageResult = calculatePackagePrice(service, { quantity, options });
      prixBase = packageResult.total;
      details = packageResult.details;
      break;

    case 'fixed':
    default:
      prixBase = (service.prix || 0) * quantity;
      details = {
        mode: 'fixed',
        prixUnitaire: service.prix || 0,
        quantite: quantity,
      };
      break;
  }

  // Ajouter les frais de déplacement
  const sousTotal = prixBase + fraisDeplacement;

  // Appliquer la remise
  let montantRemise = 0;
  if (remise) {
    montantRemise = calculateRemise(sousTotal, remise);
  }

  const prixHT = sousTotal - montantRemise;

  // Calculer la TVA (20% par défaut)
  const tauxTVA = params.tauxTVA || 20;
  const montantTVA = Math.round(prixHT * tauxTVA / 100);

  const prixTTC = prixHT + montantTVA;

  return {
    pricingMode,
    prixBase,
    fraisDeplacement,
    sousTotal,
    remise: remise ? {
      type: remise.type,
      valeur: remise.valeur,
      montant: montantRemise,
    } : null,
    prixHT,
    tauxTVA,
    montantTVA,
    prixTTC,
    details,
  };
}

/**
 * Calcul prix horaire
 */
function calculateHourlyPrice(service, params) {
  const { startTime, endTime, quantity = 1 } = params;

  if (!startTime || !endTime) {
    return { total: 0, details: { error: 'Horaires requis' } };
  }

  const hours = calculateHours(startTime, endTime);
  const tauxHoraire = service.taux_horaire || 0;
  const total = Math.round(tauxHoraire * hours * quantity);

  return {
    total,
    details: {
      mode: 'hourly',
      tauxHoraire,
      heures: hours,
      quantite: quantity,
      heureDebut: startTime,
      heureFin: endTime,
      calcul: `${tauxHoraire / 100}€/h × ${hours}h × ${quantity} = ${total / 100}€`,
    },
  };
}

/**
 * Calcul prix journalier
 */
function calculateDailyPrice(service, params) {
  const { startDate, endDate, quantity = 1 } = params;

  const days = calculateDays(startDate, endDate);
  const tauxJournalier = service.taux_journalier || 0;
  const total = Math.round(tauxJournalier * days * quantity);

  return {
    total,
    details: {
      mode: 'daily',
      tauxJournalier,
      jours: days,
      quantite: quantity,
      dateDebut: startDate,
      dateFin: endDate,
      calcul: `${tauxJournalier / 100}€/j × ${days}j × ${quantity} = ${total / 100}€`,
    },
  };
}

/**
 * Calcul prix forfait
 */
function calculatePackagePrice(service, params) {
  const { quantity = 1, options = [] } = params;

  const prixForfait = service.prix_forfait || service.prix || 0;
  let totalOptions = 0;
  const optionsDetails = [];

  options.forEach((opt) => {
    const optionPrix = opt.prix || 0;
    totalOptions += optionPrix;
    optionsDetails.push({ nom: opt.nom, prix: optionPrix });
  });

  const total = (prixForfait + totalOptions) * quantity;

  return {
    total,
    details: {
      mode: 'package',
      prixForfait,
      options: optionsDetails,
      totalOptions,
      quantite: quantity,
      calcul: `(${prixForfait / 100}€ + ${totalOptions / 100}€ options) × ${quantity} = ${total / 100}€`,
    },
  };
}

/**
 * Calculer le nombre d'heures entre deux horaires
 */
function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + (startM || 0);
  let endMinutes = endH * 60 + (endM || 0);

  // Si fin < début, c'est une mission de nuit
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return Math.round((endMinutes - startMinutes) / 60 * 100) / 100;
}

/**
 * Calculer le nombre de jours entre deux dates
 */
function calculateDays(startDate, endDate) {
  if (!startDate) return 1;
  if (!endDate) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1;
}

/**
 * Calculer le montant de la remise
 */
function calculateRemise(montant, remise) {
  if (!remise) return 0;

  const { type, valeur } = remise;

  if (type === 'pourcentage' || type === 'percent') {
    return Math.round(montant * valeur / 100);
  }

  if (type === 'montant' || type === 'fixed') {
    return Math.min(valeur, montant); // Ne peut pas dépasser le montant
  }

  return 0;
}

/**
 * Formater un prix en euros
 */
export function formatPrice(centimes, options = {}) {
  const { currency = 'EUR', locale = 'fr-FR' } = options;
  const euros = centimes / 100;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(euros);
}

/**
 * Calculer le prix d'une ligne de service (pour multi-services)
 */
export function calculateServiceLine(profile, service, params) {
  const { quantity = 1, membre_id, dureeOverride } = params;

  const pricingMode = service.pricing_mode || profile.pricing.mode;

  let prixUnitaire = 0;
  let dureeMinutes = service.duree_minutes || 60;

  switch (pricingMode) {
    case 'hourly':
      // Pour horaire, on prend le taux horaire
      prixUnitaire = service.taux_horaire || 0;
      if (dureeOverride) {
        dureeMinutes = dureeOverride;
      }
      break;

    case 'daily':
      // Pour journalier, prix = taux journalier
      prixUnitaire = service.taux_journalier || 0;
      dureeMinutes = 8 * 60; // 8h par jour
      break;

    case 'fixed':
    default:
      prixUnitaire = service.prix || 0;
      break;
  }

  return {
    service_id: service.id,
    service_nom: service.nom,
    quantite: quantity,
    duree_minutes: dureeMinutes,
    prix_unitaire: prixUnitaire,
    prix_total: prixUnitaire * quantity,
    membre_id,
    pricing_mode: pricingMode,
  };
}

/**
 * Calculer le total d'une réservation avec plusieurs services
 */
export function calculateReservationTotal(profile, serviceLignes, params = {}) {
  const { fraisDeplacement = 0, remise = null, tauxTVA = 20 } = params;

  // Sommer les prix des lignes
  const prixServices = serviceLignes.reduce((sum, ligne) => sum + (ligne.prix_total || 0), 0);

  // Calculer la durée totale
  const dureeTotale = serviceLignes.reduce(
    (sum, ligne) => sum + (ligne.duree_minutes || 60) * (ligne.quantite || 1),
    0
  );

  const sousTotal = prixServices + fraisDeplacement;

  // Appliquer la remise
  let montantRemise = 0;
  if (remise) {
    montantRemise = calculateRemise(sousTotal, remise);
  }

  const prixHT = sousTotal - montantRemise;
  const montantTVA = Math.round(prixHT * tauxTVA / 100);
  const prixTTC = prixHT + montantTVA;

  return {
    prixServices,
    fraisDeplacement,
    sousTotal,
    remise: remise ? { ...remise, montant: montantRemise } : null,
    prixHT,
    tauxTVA,
    montantTVA,
    prixTTC,
    dureeTotale,
    nbServices: serviceLignes.length,
  };
}

export default {
  calculatePricing,
  calculateServiceLine,
  calculateReservationTotal,
  formatPrice,
};
