/**
 * Calculs forfaits Security — postes, heures, couts mensuels/annuels
 */

export interface PosteCalc {
  service_id?: number | null;
  service_nom: string;
  effectif: number;
  jours: boolean[]; // [lun, mar, mer, jeu, ven, sam, dim]
  heure_debut: string;
  heure_fin: string;
  taux_horaire: number; // centimes/heure
}

/** Nombre de jours travailles par semaine */
export function joursParSemaine(jours: boolean[]): number {
  return jours.filter(Boolean).length;
}

/** Heures par jour pour un creneau (gere overnight) */
export function heuresParJour(heure_debut: string, heure_fin: string): number {
  const [h1, m1] = heure_debut.split(':').map(Number);
  const [h2, m2] = heure_fin.split(':').map(Number);
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes <= 0) minutes += 24 * 60; // overnight
  return minutes / 60;
}

/** Nombre moyen de semaines par mois */
const SEMAINES_PAR_MOIS = 4.33;

/** Cout mensuel HT d'un poste (centimes) */
export function coutMensuelPoste(poste: PosteCalc): number {
  const hpj = heuresParJour(poste.heure_debut, poste.heure_fin);
  const jps = joursParSemaine(poste.jours);
  const heuresMensuelles = hpj * jps * SEMAINES_PAR_MOIS * poste.effectif;
  return Math.round(heuresMensuelles * poste.taux_horaire);
}

/** Heures par semaine d'un poste */
export function heuresParSemainePoste(poste: PosteCalc): number {
  const hpj = heuresParJour(poste.heure_debut, poste.heure_fin);
  const jps = joursParSemaine(poste.jours);
  return hpj * jps * poste.effectif;
}

/** Calcul CNAPS pour un poste (centimes) — taux_cnaps en pourcentage (ex: 0.5 = 0.5%) */
export function cnapsPoste(poste: PosteCalc, taux_cnaps: number): number {
  if (!taux_cnaps) return 0;
  const coutHT = coutMensuelPoste(poste);
  return Math.round(coutHT * taux_cnaps / 100);
}

/** Resume multi-postes — servicesCnaps: map service_id → taux_cnaps (%) */
export function recapForfait(postes: PosteCalc[], servicesCnaps?: Record<number, number>): {
  totalHeuresSemaine: number;
  coutMensuelHT: number;
  coutAnnuelHT: number;
  montantCnaps: number;
} {
  let totalHeuresSemaine = 0;
  let coutMensuelHT = 0;
  let montantCnaps = 0;
  for (const p of postes) {
    totalHeuresSemaine += heuresParSemainePoste(p);
    const coutPoste = coutMensuelPoste(p);
    coutMensuelHT += coutPoste;
    if (p.service_id && servicesCnaps?.[p.service_id]) {
      montantCnaps += Math.round(coutPoste * servicesCnaps[p.service_id] / 100);
    }
  }
  coutMensuelHT += montantCnaps;
  return {
    totalHeuresSemaine,
    coutMensuelHT,
    coutAnnuelHT: coutMensuelHT * 12,
    montantCnaps,
  };
}

/** Genere les periodes mensuelles entre date_debut et date_fin */
export function genererPeriodes(dateDebut: string, dateFin: string): Array<{
  mois: string;
  date_debut: string;
  date_fin: string;
}> {
  const periodes: Array<{ mois: string; date_debut: string; date_fin: string }> = [];
  const start = new Date(dateDebut + 'T12:00:00');
  const end = new Date(dateFin + 'T12:00:00');

  let current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const mois = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Debut = max(date_debut, 1er du mois)
    const premierDuMois = new Date(year, month, 1);
    const pDebut = premierDuMois < start ? start : premierDuMois;

    // Fin = min(date_fin, dernier du mois)
    const dernierDuMois = new Date(year, month + 1, 0);
    const pFin = dernierDuMois > end ? end : dernierDuMois;

    periodes.push({
      mois,
      date_debut: pDebut.toISOString().slice(0, 10),
      date_fin: pFin.toISOString().slice(0, 10),
    });

    // Mois suivant
    current = new Date(year, month + 1, 1);
  }

  return periodes;
}

/** Genere les jours travailles pour un poste dans une periode */
export function joursTravailes(
  posteJours: boolean[], // [lun..dim]
  dateDebut: string,
  dateFin: string,
): string[] {
  const dates: string[] = [];
  const start = new Date(dateDebut + 'T12:00:00');
  const end = new Date(dateFin + 'T12:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // getDay: 0=dim, 1=lun..6=sam → map to jours index: lun=0..dim=6
    const dayOfWeek = d.getDay();
    const joursIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    if (posteJours[joursIndex]) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  return dates;
}

/** Format centimes en euros */
export function formatEuros(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centimes / 100);
}
