/**
 * DSN-Val Service — Wrapper subprocess pour validation officielle GIP-MDS
 * Appelle DSN-Val (CLI Java) comme seconde passe après notre validateur interne.
 * Si Java ou DSN-Val absent → { disponible: false }, la validation interne reste seule.
 */

import { execFile } from 'child_process';
import { writeFile, readFile, unlink, access, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

// Config
const DSNVAL_PATH = process.env.DSNVAL_PATH || join(homedir(), 'Downloads', 'autocontrole-dsn-val_linux_2026');
const DSNVAL_TIMEOUT = parseInt(process.env.DSNVAL_TIMEOUT, 10) || 30000;
const SCRIPT_NAME = 'autocontrole-dsn-val.sh';

// Cache disponibilité (vérifié une seule fois)
let availabilityCache = null;

async function checkAvailability() {
  if (availabilityCache !== null) return availabilityCache;

  try {
    // Vérifier Java
    await new Promise((resolve, reject) => {
      execFile('java', ['-version'], { timeout: 5000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // Vérifier script DSN-Val
    const scriptPath = join(DSNVAL_PATH, SCRIPT_NAME);
    await access(scriptPath);

    availabilityCache = true;
  } catch {
    console.warn('[DSN-Val] Non disponible (Java ou DSN-Val absent)');
    availabilityCache = false;
  }

  return availabilityCache;
}

/**
 * Parse le rapport XML produit par DSN-Val
 */
function parseRapportXML(xml) {
  const anomalies = [];

  // Extraire etat envoi
  const etatMatch = xml.match(/<envoi_etat>(\w+)<\/envoi_etat>/);
  const etat = etatMatch ? etatMatch[1] : null;

  // Compteurs
  const bloquantMatch = xml.match(/<nb_anomalies_bloquantes>(\d+)<\/nb_anomalies_bloquantes>/);
  const nonBloquantMatch = xml.match(/<nb_anomalies_non_bloquantes>(\d+)<\/nb_anomalies_non_bloquantes>/);
  const anomalies_bloquantes = bloquantMatch ? parseInt(bloquantMatch[1], 10) : 0;
  const anomalies_non_bloquantes = nonBloquantMatch ? parseInt(nonBloquantMatch[1], 10) : 0;

  // Extraire anomalies détaillées
  const anomalieRegex = /<anomalie>\s*<code>([^<]*)<\/code>\s*<type>([^<]*)<\/type>\s*<message>([^<]*)<\/message>\s*<\/anomalie>/g;
  let match;
  while ((match = anomalieRegex.exec(xml)) !== null) {
    anomalies.push({ code: match[1], type: match[2], message: match[3] });
  }

  return { etat, anomalies_bloquantes, anomalies_non_bloquantes, anomalies };
}

/**
 * Valide un contenu DSN avec DSN-Val (CLI Java GIP-MDS)
 * @param {string} contenuDSN - Contenu brut du fichier DSN
 * @returns {Promise<Object>} Résultat validation DSN-Val
 */
export async function validateWithDSNVal(contenuDSN) {
  const resultatIndisponible = {
    disponible: false,
    etat: null,
    anomalies_bloquantes: 0,
    anomalies_non_bloquantes: 0,
    anomalies: [],
    rapport_xml: null,
  };

  if (!(await checkAvailability())) return resultatIndisponible;

  // R6: mkdtemp for safer temp directory creation (OS-managed unique names)
  const tmpDir = await mkdtemp(join(tmpdir(), 'dsn-nexus-'));
  const fichierDSN = join(tmpDir, 'declaration.dsn');
  const fichierXML = join(tmpDir, 'declaration.dsn.xml');
  const scriptPath = join(DSNVAL_PATH, SCRIPT_NAME);

  try {
    // Écrire en ISO-8859-1 (encodage DSN officiel)
    const buffer = Buffer.from(contenuDSN, 'latin1');
    await writeFile(fichierDSN, buffer);

    // Exécuter DSN-Val
    await new Promise((resolve, reject) => {
      execFile('bash', [scriptPath, '--noCheckUpdate', '-o', tmpDir, fichierDSN], {
        timeout: DSNVAL_TIMEOUT,
        cwd: DSNVAL_PATH,
      }, (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(new Error('DSN-Val timeout'));
        } else {
          // DSN-Val retourne code != 0 quand il y a des anomalies, ce n'est pas une erreur
          resolve({ stdout, stderr });
        }
      });
    });

    // Lire le rapport XML
    let rapportXML;
    try {
      rapportXML = await readFile(fichierXML, 'utf-8');
    } catch {
      console.warn('[DSN-Val] Rapport XML non trouvé après exécution');
      return resultatIndisponible;
    }

    const parsed = parseRapportXML(rapportXML);

    return {
      disponible: true,
      etat: parsed.etat,
      anomalies_bloquantes: parsed.anomalies_bloquantes,
      anomalies_non_bloquantes: parsed.anomalies_non_bloquantes,
      anomalies: parsed.anomalies,
      rapport_xml: rapportXML,
    };
  } catch (err) {
    console.error('[DSN-Val] Erreur exécution:', err.message);
    return resultatIndisponible;
  } finally {
    // Nettoyage best-effort du répertoire temp
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Réinitialise le cache de disponibilité (utile pour les tests)
 */
export function resetAvailabilityCache() {
  availabilityCache = null;
}
