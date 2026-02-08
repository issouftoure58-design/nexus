/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              TENANT STORAGE - Gestion fichiers par tenant          ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  RÈGLE ABSOLUE : UN TENANT = UN DOSSIER DISTINCT                  ║
 * ║                                                                    ║
 * ║  Structure :                                                       ║
 * ║  backend/data/{tenant-id}/                                         ║
 * ║    ├── uploads/     → Images, médias uploadés                      ║
 * ║    ├── documents/   → Factures, devis, exports                     ║
 * ║    ├── temp/        → Fichiers temporaires                         ║
 * ║    └── cache/       → Cache généré (purge auto)                    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const DATA_ROOT = path.resolve(process.cwd(), 'backend', 'data');

const SUBDIRS = ['uploads', 'documents', 'temp', 'cache'];

// ═══════════════════════════════════════════════════════════════════
// FONCTIONS PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtenir le chemin racine d'un tenant
 * @param {string} tenantId - ID du tenant (ex: "fatshairafro", "nexus-test")
 * @returns {string} Chemin absolu du dossier tenant
 */
export function getTenantRoot(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId requis et doit être une chaîne');
  }

  // Sécurité : empêcher path traversal
  const sanitized = tenantId.replace(/[^a-z0-9-_]/gi, '');
  if (sanitized !== tenantId) {
    throw new Error(`tenantId invalide: ${tenantId}`);
  }

  return path.join(DATA_ROOT, tenantId);
}

/**
 * Obtenir un sous-dossier spécifique d'un tenant
 * @param {string} tenantId - ID du tenant
 * @param {string} subdir - Sous-dossier ('uploads', 'documents', 'temp', 'cache')
 * @returns {string} Chemin absolu du sous-dossier
 */
export function getTenantPath(tenantId, subdir) {
  if (!SUBDIRS.includes(subdir)) {
    throw new Error(`Sous-dossier invalide: ${subdir}. Valides: ${SUBDIRS.join(', ')}`);
  }

  return path.join(getTenantRoot(tenantId), subdir);
}

/**
 * Créer la structure de dossiers pour un nouveau tenant
 * @param {string} tenantId - ID du tenant
 * @returns {object} { success: boolean, paths: string[] }
 */
export function createTenantStructure(tenantId) {
  const root = getTenantRoot(tenantId);
  const createdPaths = [];

  try {
    // Créer dossier racine
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
      createdPaths.push(root);
    }

    // Créer sous-dossiers
    for (const subdir of SUBDIRS) {
      const subdirPath = path.join(root, subdir);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
        createdPaths.push(subdirPath);
      }

      // Créer .gitkeep pour conserver les dossiers vides
      const gitkeepPath = path.join(subdirPath, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
      }
    }

    console.log(`[TENANT-STORAGE] Structure créée pour: ${tenantId}`);

    return {
      success: true,
      tenantId,
      root,
      paths: createdPaths
    };
  } catch (err) {
    console.error(`[TENANT-STORAGE] Erreur création structure ${tenantId}:`, err.message);
    return {
      success: false,
      tenantId,
      error: err.message
    };
  }
}

/**
 * Vérifier que la structure tenant est complète
 * @param {string} tenantId - ID du tenant
 * @returns {object} { valid: boolean, missing: string[] }
 */
export function checkTenantStructure(tenantId) {
  const root = getTenantRoot(tenantId);
  const missing = [];

  if (!fs.existsSync(root)) {
    return { valid: false, missing: ['root'], root };
  }

  for (const subdir of SUBDIRS) {
    const subdirPath = path.join(root, subdir);
    if (!fs.existsSync(subdirPath)) {
      missing.push(subdir);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    root
  };
}

/**
 * Initialiser un tenant (créer structure si nécessaire)
 * @param {string} tenantId - ID du tenant
 * @returns {object} Résultat de l'initialisation
 */
export function initTenant(tenantId) {
  const check = checkTenantStructure(tenantId);

  if (check.valid) {
    return {
      success: true,
      tenantId,
      message: 'Structure existante valide',
      root: check.root
    };
  }

  return createTenantStructure(tenantId);
}

/**
 * Lister tous les tenants avec dossiers de données
 * @returns {string[]} Liste des tenant IDs
 */
export function listTenants() {
  if (!fs.existsSync(DATA_ROOT)) {
    return [];
  }

  return fs.readdirSync(DATA_ROOT)
    .filter(name => {
      const fullPath = path.join(DATA_ROOT, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
    });
}

/**
 * Nettoyer les fichiers temporaires d'un tenant
 * @param {string} tenantId - ID du tenant
 * @param {number} maxAgeMs - Âge max en ms (défaut: 24h)
 * @returns {object} { deleted: number }
 */
export function cleanTenantTemp(tenantId, maxAgeMs = 24 * 60 * 60 * 1000) {
  const tempPath = getTenantPath(tenantId, 'temp');
  let deleted = 0;

  if (!fs.existsSync(tempPath)) {
    return { deleted: 0 };
  }

  const now = Date.now();
  const files = fs.readdirSync(tempPath);

  for (const file of files) {
    if (file === '.gitkeep') continue;

    const filePath = path.join(tempPath, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > maxAgeMs) {
      try {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
        deleted++;
      } catch (err) {
        console.error(`[TENANT-STORAGE] Erreur suppression ${filePath}:`, err.message);
      }
    }
  }

  return { deleted };
}

/**
 * Nettoyer le cache d'un tenant
 * @param {string} tenantId - ID du tenant
 * @param {number} maxAgeMs - Âge max en ms (défaut: 7 jours)
 * @returns {object} { deleted: number }
 */
export function cleanTenantCache(tenantId, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cachePath = getTenantPath(tenantId, 'cache');
  let deleted = 0;

  if (!fs.existsSync(cachePath)) {
    return { deleted: 0 };
  }

  const now = Date.now();
  const files = fs.readdirSync(cachePath);

  for (const file of files) {
    if (file === '.gitkeep') continue;

    const filePath = path.join(cachePath, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > maxAgeMs) {
      try {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
        deleted++;
      } catch (err) {
        console.error(`[TENANT-STORAGE] Erreur suppression ${filePath}:`, err.message);
      }
    }
  }

  return { deleted };
}

/**
 * Obtenir les stats d'utilisation stockage d'un tenant
 * @param {string} tenantId - ID du tenant
 * @returns {object} Stats par dossier
 */
export function getTenantStorageStats(tenantId) {
  const root = getTenantRoot(tenantId);

  if (!fs.existsSync(root)) {
    return { exists: false, total: 0, subdirs: {} };
  }

  const stats = {
    exists: true,
    total: 0,
    subdirs: {}
  };

  for (const subdir of SUBDIRS) {
    const subdirPath = path.join(root, subdir);
    stats.subdirs[subdir] = getDirSize(subdirPath);
    stats.total += stats.subdirs[subdir];
  }

  return stats;
}

/**
 * Calculer la taille d'un dossier en bytes
 * @param {string} dirPath - Chemin du dossier
 * @returns {number} Taille en bytes
 */
function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let size = 0;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stats.size;
    }
  }

  return size;
}

/**
 * Supprimer toute la structure d'un tenant (DANGER)
 * @param {string} tenantId - ID du tenant
 * @param {boolean} confirm - Doit être true pour confirmer
 * @returns {object} Résultat
 */
export function deleteTenantStorage(tenantId, confirm = false) {
  if (!confirm) {
    return {
      success: false,
      error: 'Confirmation requise (confirm: true)'
    };
  }

  const root = getTenantRoot(tenantId);

  if (!fs.existsSync(root)) {
    return {
      success: false,
      error: 'Dossier tenant inexistant'
    };
  }

  try {
    fs.rmSync(root, { recursive: true, force: true });
    console.log(`[TENANT-STORAGE] ⚠️  Structure supprimée: ${tenantId}`);

    return {
      success: true,
      tenantId,
      message: 'Structure supprimée'
    };
  } catch (err) {
    console.error(`[TENANT-STORAGE] Erreur suppression ${tenantId}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// INITIALISATION AU DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════

/**
 * S'assurer que le dossier data/ existe
 */
export function ensureDataRoot() {
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    console.log('[TENANT-STORAGE] Dossier data/ créé');
  }
}

// Auto-init au chargement du module
ensureDataRoot();

export default {
  getTenantRoot,
  getTenantPath,
  createTenantStructure,
  checkTenantStructure,
  initTenant,
  listTenants,
  cleanTenantTemp,
  cleanTenantCache,
  getTenantStorageStats,
  deleteTenantStorage,
  ensureDataRoot,
  DATA_ROOT,
  SUBDIRS
};
