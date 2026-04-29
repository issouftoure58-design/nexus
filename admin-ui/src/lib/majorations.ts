/**
 * Détection automatique des majorations pour le business type Sécurité
 * Nuit, dimanche, jour férié — combinables (dimanche nuit, férié nuit, etc.)
 *
 * Nuit = 21h → 7h (Code du travail art. L3122-2)
 * Les créneaux overnight sont découpés à minuit (changement de date)
 * et à 21h/7h (changement jour/nuit)
 */

// 11 jours fériés français fixes
const FERIES_FIXES = [
  '01-01', // Jour de l'an
  '05-01', // Fête du travail
  '05-08', // Victoire 1945
  '07-14', // Fête nationale
  '08-15', // Assomption
  '11-01', // Toussaint
  '11-11', // Armistice
  '12-25', // Noël
];

/** Calcul de Pâques (algorithme de Meeus/Jones/Butcher) */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Vérifie si une date (YYYY-MM-DD) est un jour férié français */
export function isFerie(dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const year = date.getFullYear();
  const mmdd = dateStr.slice(5); // "MM-DD"

  if (FERIES_FIXES.includes(mmdd)) return true;

  const easter = getEasterDate(year);
  const addDays = (d: Date, n: number): string => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().slice(0, 10);
  };

  const lundiPaques = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const lundiPentecote = addDays(easter, 50);

  return dateStr === lundiPaques || dateStr === ascension || dateStr === lundiPentecote;
}

/** Retourne la date du lendemain (YYYY-MM-DD) */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Vérifie si un jour est un dimanche */
function isDimanche(dateStr: string): boolean {
  return new Date(dateStr + 'T12:00:00').getDay() === 0;
}

export type MajorationType =
  | 'jour'
  | 'nuit'
  | 'dimanche_jour'
  | 'dimanche_nuit'
  | 'ferie_jour'
  | 'ferie_nuit';

export interface MajorationResult {
  type: MajorationType;
  label: string;
  pourcentage: number;
}

const MAJORATIONS_CONFIG: Record<Exclude<MajorationType, 'jour'>, { label: string; pourcentage: number }> = {
  nuit: { label: 'Nuit (21h-7h)', pourcentage: 25 },
  dimanche_jour: { label: 'Dimanche jour', pourcentage: 50 },
  dimanche_nuit: { label: 'Dimanche nuit', pourcentage: 75 },
  ferie_jour: { label: 'Férié jour', pourcentage: 100 },
  ferie_nuit: { label: 'Férié nuit', pourcentage: 100 },
};

/** Parse "HH:MM" en minutes depuis minuit */
function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Détermine le type de majoration pour une date + plage horaire sur la MÊME journée calendaire */
function classifySlot(dateStr: string, isNightHours: boolean): MajorationType {
  const ferie = isFerie(dateStr);
  const dim = isDimanche(dateStr);

  if (ferie && isNightHours) return 'ferie_nuit';
  if (ferie) return 'ferie_jour';
  if (dim && isNightHours) return 'dimanche_nuit';
  if (dim) return 'dimanche_jour';
  if (isNightHours) return 'nuit';
  return 'jour';
}

/**
 * Représente un segment d'heures avec son type de majoration.
 */
export interface HoursSegment {
  type: MajorationType;
  hours: number;
  label: string;
  pourcentage: number;
}

/**
 * Découpe un créneau horaire en segments avec majoration correcte.
 * Gère les créneaux overnight (20:00→06:00), le changement de date à minuit,
 * et les frontières jour/nuit à 21h et 7h.
 *
 * @param date - Date de début du créneau (YYYY-MM-DD)
 * @param heure_debut - Heure de début (HH:MM)
 * @param heure_fin - Heure de fin (HH:MM) — si < heure_debut, créneau overnight
 * @returns Liste de segments avec type et heures
 */
export function splitHoursSegments(
  date: string,
  heure_debut: string,
  heure_fin: string,
): HoursSegment[] {
  if (!date || !heure_debut || !heure_fin) {
    return [];
  }

  const startMin = parseHM(heure_debut);
  let endMin = parseHM(heure_fin);
  const isOvernight = endMin <= startMin;

  // Bornes de nuit en minutes: 0-420 (0h-7h) et 1260-1440 (21h-24h)
  const NUIT_FIN = 7 * 60;   // 420 = 7h
  const NUIT_DEBUT = 21 * 60; // 1260 = 21h
  const MINUIT = 24 * 60;     // 1440

  // Construire les points de coupure sur une timeline linéaire
  // Pour overnight, on utilise des minutes > 1440 pour le lendemain
  if (isOvernight) {
    endMin += MINUIT; // ex: 06:00 → 1800
  }

  // Points de coupure potentiels entre startMin et endMin
  const cuts: number[] = [startMin];

  // Jour 1 : coupures à NUIT_FIN (7h), NUIT_DEBUT (21h), MINUIT (24h)
  for (const c of [NUIT_FIN, NUIT_DEBUT, MINUIT]) {
    if (c > startMin && c < endMin) cuts.push(c);
  }

  // Jour 2 (si overnight) : coupures à 24h+7h=1860, 24h+21h=2700
  if (isOvernight) {
    const nuitFinJ2 = MINUIT + NUIT_FIN; // 1860
    const nuitDebutJ2 = MINUIT + NUIT_DEBUT; // 2700
    if (nuitFinJ2 > startMin && nuitFinJ2 < endMin) cuts.push(nuitFinJ2);
    if (nuitDebutJ2 > startMin && nuitDebutJ2 < endMin) cuts.push(nuitDebutJ2);
  }

  cuts.push(endMin);
  cuts.sort((a, b) => a - b);

  // Dédupliquer
  const uniqueCuts = cuts.filter((v, i) => i === 0 || v !== cuts[i - 1]);

  const segments: HoursSegment[] = [];
  const dateJ2 = nextDay(date);

  for (let i = 0; i < uniqueCuts.length - 1; i++) {
    const segStart = uniqueCuts[i];
    const segEnd = uniqueCuts[i + 1];
    const hours = (segEnd - segStart) / 60;
    if (hours <= 0) continue;

    // Déterminer la date calendaire et si c'est des heures de nuit
    const isJ2 = segStart >= MINUIT;
    const currentDate = isJ2 ? dateJ2 : date;
    const normalizedStart = isJ2 ? segStart - MINUIT : segStart;

    // Heures de nuit = [0, 7h[ ou [21h, 24h[
    const isNight = normalizedStart < NUIT_FIN || normalizedStart >= NUIT_DEBUT;

    const type = classifySlot(currentDate, isNight);
    const config = type === 'jour'
      ? { label: 'Jour', pourcentage: 0 }
      : MAJORATIONS_CONFIG[type];

    segments.push({ type, hours, ...config });
  }

  // Fusionner segments adjacents de même type
  const merged: HoursSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.hours += seg.hours;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Détecte la majoration DOMINANTE pour une date et un créneau horaire donnés.
 * Rétro-compatible — retourne un seul type (le plus élevé en priorité).
 * Pour un décompte précis, utiliser splitHoursSegments.
 */
export function detectMajoration(
  date: string,
  heure_debut: string,
  heure_fin: string
): MajorationResult {
  if (!date) return { type: 'jour', label: 'Jour', pourcentage: 0 };

  // Si pas d'heure fin, classification simple
  if (!heure_fin) {
    const d = new Date(date + 'T12:00:00');
    const dim = d.getDay() === 0;
    const ferie = isFerie(date);
    const startH = parseHM(heure_debut || '12:00');
    const isNight = startH >= 21 * 60 || startH < 7 * 60;

    if (ferie && isNight) return { type: 'ferie_nuit', ...MAJORATIONS_CONFIG.ferie_nuit };
    if (ferie) return { type: 'ferie_jour', ...MAJORATIONS_CONFIG.ferie_jour };
    if (dim && isNight) return { type: 'dimanche_nuit', ...MAJORATIONS_CONFIG.dimanche_nuit };
    if (dim) return { type: 'dimanche_jour', ...MAJORATIONS_CONFIG.dimanche_jour };
    if (isNight) return { type: 'nuit', ...MAJORATIONS_CONFIG.nuit };
    return { type: 'jour', label: 'Jour', pourcentage: 0 };
  }

  // Avec heure début et fin : utiliser le split et retourner le type dominant
  const segments = splitHoursSegments(date, heure_debut, heure_fin);
  if (segments.length === 0) return { type: 'jour', label: 'Jour', pourcentage: 0 };

  // Priorité : ferie_nuit > ferie_jour > dimanche_nuit > dimanche_jour > nuit > jour
  const priority: MajorationType[] = ['ferie_nuit', 'ferie_jour', 'dimanche_nuit', 'dimanche_jour', 'nuit', 'jour'];
  for (const p of priority) {
    const seg = segments.find(s => s.type === p);
    if (seg) {
      return { type: seg.type, label: seg.label, pourcentage: seg.pourcentage };
    }
  }

  return { type: 'jour', label: 'Jour', pourcentage: 0 };
}

/** Badge emoji pour une majoration */
export function majorationBadge(type: MajorationType): string {
  switch (type) {
    case 'nuit': return '\uD83C\uDF19';
    case 'dimanche_jour': return '\uD83D\uDCC5';
    case 'dimanche_nuit': return '\uD83C\uDF19\uD83D\uDCC5';
    case 'ferie_jour': return '\uD83C\uDF89';
    case 'ferie_nuit': return '\uD83C\uDF89\uD83C\uDF19';
    default: return '';
  }
}
