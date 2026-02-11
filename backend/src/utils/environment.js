/**
 * ═══════════════════════════════════════════════════════════
 * ENVIRONMENT UTILS - Détection environnement et helpers
 * ═══════════════════════════════════════════════════════════
 */

export const isProduction = () => {
  return process.env.NODE_ENV === 'production';
};

export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
};

export const isTestTenant = (tenantId) => {
  return tenantId === 'nexus-test' || tenantId?.startsWith('test-');
};

export const getConfig = () => {
  return {
    env: process.env.NODE_ENV || 'development',
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),
    databaseUrl: process.env.DATABASE_URL,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'nexus-test'
  };
};

/**
 * Logger sécurisé (ne log données sensibles qu'en dev)
 */
export const secureLog = (message, data = {}) => {
  const timestamp = new Date().toISOString();

  if (isDevelopment()) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    // En prod, log seulement le message
    console.log(`[${timestamp}] ${message}`);
  }
};

/**
 * Vérifier si on peut modifier un tenant
 */
export const canModifyTenant = (tenantId) => {
  // En dev, on peut tout modifier
  if (isDevelopment()) return true;

  // En prod, JAMAIS modifier tenant test
  if (isTestTenant(tenantId)) return false;

  return true;
};

/**
 * Helper pour logs conditionnels
 */
export const devLog = (...args) => {
  if (isDevelopment()) {
    console.log('[DEV]', ...args);
  }
};

export const prodLog = (...args) => {
  if (isProduction()) {
    console.log('[PROD]', ...args);
  }
};

/**
 * Formater une date pour logs
 */
export const formatLogDate = (date = new Date()) => {
  return date.toISOString().replace('T', ' ').split('.')[0];
};

/**
 * Obtenir l'environnement actuel
 */
export const getEnvironment = () => {
  if (isProduction()) return 'production';
  if (isDevelopment()) return 'development';
  return process.env.NODE_ENV || 'unknown';
};
