/**
 * SENTINEL Backup Service
 * Sauvegardes automatiques de la base de donnees
 */

import { supabase } from '../../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
const PROJECT_ROOT = process.cwd();

// Configuration
export const CONFIG = {
  backupDir: process.env.BACKUP_DIR || path.join(PROJECT_ROOT, 'backups'),
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  tables: [
    'admin_users',
    'clients',
    'client_sessions',
    'services',
    'reservations',
    'reviews',
    'orders',
    'order_items',
    'parametres',
    'horaires_hebdo',
    'blocs_indispo',
    'conges',
    'halimah_memory',
    'halimah_feedback',
    'halimah_insights',
    'sentinel_alerts',
    'sentinel_security_logs',
    'sentinel_usage',
    'loyalty_rewards',
    'loyalty_transactions',
  ],
};

// Assurer que le dossier backup existe
async function ensureBackupDir() {
  await fs.mkdir(CONFIG.backupDir, { recursive: true });
}

// Exporter une table avec filtre tenant OBLIGATOIRE
async function exportTable(tableName, tenantId) {
  if (!tenantId) {
    throw new Error('tenant_id requis pour exportTable - backup global interdit');
  }

  try {
    // Construire la requête de base
    let query = supabase.from(tableName).select('*');

    // Tables système sans tenant_id (admin_users a tenant_id donc on filtre)
    const tablesWithoutTenantId = ['parametres'];

    if (!tablesWithoutTenantId.includes(tableName)) {
      // Filtrer par tenant_id AVANT de charger les données
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[BACKUP] Error exporting ${tableName}:`, error.message);
      return { table: tableName, success: false, error: error.message, count: 0 };
    }

    return { table: tableName, success: true, data, count: data?.length || 0 };
  } catch (err) {
    console.error(`[BACKUP] Exception exporting ${tableName}:`, err.message);
    return { table: tableName, success: false, error: err.message, count: 0 };
  }
}

// Creer un backup pour UN tenant (backup global interdit)
export async function createBackup(tenantId) {
  // TENANT SHIELD: tenantId OBLIGATOIRE - pas de backup global
  if (!tenantId) {
    throw new Error('tenant_id requis pour createBackup - backup global interdit');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${tenantId}-${timestamp}`;

  console.log(`[BACKUP] Starting backup: ${backupName}`);

  await ensureBackupDir();

  const backup = {
    name: backupName,
    timestamp: new Date().toISOString(),
    tenantId,
    tables: {},
    stats: {
      totalTables: 0,
      successTables: 0,
      failedTables: 0,
      totalRecords: 0,
    },
  };

  for (const tableName of CONFIG.tables) {
    // Le filtrage par tenant se fait DANS exportTable maintenant
    const result = await exportTable(tableName, tenantId);
    backup.stats.totalTables++;

    if (result.success) {
      backup.tables[tableName] = {
        success: true,
        count: result.data.length,
        data: result.data,
      };
      backup.stats.successTables++;
      backup.stats.totalRecords += result.data.length;
    } else {
      backup.tables[tableName] = {
        success: false,
        error: result.error,
        count: 0,
      };
      backup.stats.failedTables++;
    }
  }

  // Sauvegarder le fichier
  const backupPath = path.join(CONFIG.backupDir, `${backupName}.json`);
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

  console.log(`[BACKUP] Completed: ${backupName}`);
  console.log(`[BACKUP] Stats: ${backup.stats.successTables}/${backup.stats.totalTables} tables, ${backup.stats.totalRecords} records`);

  // Nettoyer les vieux backups
  await cleanOldBackups();

  return {
    success: backup.stats.failedTables === 0,
    name: backupName,
    path: backupPath,
    stats: backup.stats,
  };
}

// Nettoyer les backups plus vieux que la retention
export async function cleanOldBackups() {
  try {
    const files = await fs.readdir(CONFIG.backupDir);
    const now = Date.now();
    const maxAge = CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    let deleted = 0;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(CONFIG.backupDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        deleted++;
        console.log(`[BACKUP] Deleted old backup: ${file}`);
      }
    }

    if (deleted > 0) {
      console.log(`[BACKUP] Cleaned ${deleted} old backups`);
    }
  } catch (err) {
    console.error('[BACKUP] Error cleaning old backups:', err.message);
  }
}

// Lister les backups disponibles
export async function listBackups() {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(CONFIG.backupDir);

    const backups = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(CONFIG.backupDir, file);
      const stats = await fs.stat(filePath);

      backups.push({
        name: file.replace('.json', ''),
        size: stats.size,
        created: stats.mtime,
      });
    }

    return backups.sort((a, b) => b.created - a.created);
  } catch (err) {
    console.error('[BACKUP] Error listing backups:', err.message);
    return [];
  }
}

// Restaurer depuis un backup
export async function restoreBackup(backupName, options = {}) {
  const { dryRun = true, tables = null } = options;

  console.log(`[BACKUP] Restore ${dryRun ? '(DRY RUN)' : ''}: ${backupName}`);

  try {
    const backupPath = path.join(CONFIG.backupDir, `${backupName}.json`);
    const content = await fs.readFile(backupPath, 'utf8');
    const backup = JSON.parse(content);

    const results = {
      backup: backupName,
      dryRun,
      tables: {},
    };

    const tablesToRestore = tables || Object.keys(backup.tables);

    for (const tableName of tablesToRestore) {
      const tableBackup = backup.tables[tableName];
      if (!tableBackup || !tableBackup.success) {
        results.tables[tableName] = { skipped: true, reason: 'no data in backup' };
        continue;
      }

      if (dryRun) {
        results.tables[tableName] = {
          wouldRestore: tableBackup.count,
          dryRun: true,
        };
        continue;
      }

      // Restore reel (upsert)
      let restored = 0;
      let errors = 0;

      for (const record of tableBackup.data) {
        const { error } = await supabase
          .from(tableName)
          .upsert(record, { onConflict: 'id' });

        if (error) {
          errors++;
        } else {
          restored++;
        }
      }

      results.tables[tableName] = { restored, errors };
    }

    return { success: true, results };
  } catch (err) {
    console.error('[BACKUP] Restore error:', err.message);
    return { success: false, error: err.message };
  }
}

// Scheduler pour backup quotidien - backup TOUS les tenants actifs individuellement
let backupInterval = null;

async function backupAllTenants() {
  try {
    // Récupérer tous les tenants actifs
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('statut', 'actif');

    if (error) {
      console.error('[BACKUP] Error fetching tenants:', error.message);
      return;
    }

    console.log(`[BACKUP] Starting scheduled backup for ${tenants?.length || 0} tenants`);

    for (const tenant of (tenants || [])) {
      try {
        const result = await createBackup(tenant.id);

        if (!result.success) {
          try {
            const { logSecurityEvent, SEVERITY } = await import('../security/securityLogger.js');
            await logSecurityEvent({
              type: 'backup_failed',
              severity: SEVERITY.HIGH,
              tenantId: tenant.id,
              details: {
                backup: result.name,
                failedTables: result.stats.failedTables,
              },
            });
          } catch (_) { /* non-blocking */ }
        }
      } catch (err) {
        console.error(`[BACKUP] Backup failed for tenant ${tenant.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Scheduled backup failed:', err.message);
  }
}

export function startBackupScheduler(intervalHours = 24) {
  if (backupInterval) {
    clearInterval(backupInterval);
  }

  console.log(`[BACKUP] Scheduler started: every ${intervalHours} hours`);

  // Premier backup apres 1 minute
  setTimeout(backupAllTenants, 60 * 1000);

  // Puis toutes les X heures
  backupInterval = setInterval(backupAllTenants, intervalHours * 60 * 60 * 1000);
}

export function stopBackupScheduler() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log('[BACKUP] Scheduler stopped');
  }
}
