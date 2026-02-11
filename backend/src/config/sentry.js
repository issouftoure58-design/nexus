/**
 * Configuration Sentry - Monitoring des erreurs production
 * Active uniquement si SENTRY_DSN est défini dans .env
 */

import * as Sentry from '@sentry/node';

let sentryInitialized = false;

/**
 * Initialise Sentry pour le monitoring des erreurs
 * @param {Express} app - Application Express
 */
export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[SENTRY] ⏸️ Désactivé (SENTRY_DSN non défini)');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      release: process.env.npm_package_version || '1.0.0',

      // Échantillonnage des traces (10%)
      tracesSampleRate: 0.1,

      // Intégrations
      integrations: [
        // HTTP tracing
        Sentry.httpIntegration({ tracing: true }),
        // Express tracing
        Sentry.expressIntegration({ app }),
      ],

      // Filtrer les données sensibles
      beforeSend(event, hint) {
        // Supprimer les cookies
        if (event.request) {
          delete event.request.cookies;
          // Supprimer les données sensibles du body
          if (event.request.data) {
            const sensitiveFields = ['password', 'token', 'authorization', 'api_key', 'secret'];
            sensitiveFields.forEach(field => {
              if (event.request.data[field]) {
                event.request.data[field] = '[FILTERED]';
              }
            });
          }
        }
        return event;
      },

      // Ignorer certaines erreurs
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Network request failed',
        'Load failed',
        /^ChunkLoadError/,
      ],
    });

    // Ajouter les handlers Express
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    sentryInitialized = true;
    console.log('[SENTRY] ✅ Monitoring activé');

  } catch (error) {
    console.error('[SENTRY] ❌ Erreur initialisation:', error.message);
  }
}

/**
 * Handler d'erreur Sentry (à ajouter APRÈS les routes)
 * @param {Express} app - Application Express
 */
export function sentryErrorHandler(app) {
  if (sentryInitialized) {
    app.use(Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capturer toutes les erreurs 4xx et 5xx
        if (error.status >= 400) return true;
        return true;
      },
    }));
  }
}

/**
 * Capture une erreur manuellement
 * @param {Error} error
 * @param {Object} context - Contexte additionnel
 */
export function captureError(error, context = {}) {
  if (sentryInitialized) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('[ERROR]', error.message, context);
  }
}

/**
 * Capture un message
 * @param {string} message
 * @param {string} level - 'info', 'warning', 'error'
 */
export function captureMessage(message, level = 'info') {
  if (sentryInitialized) {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Ajoute un breadcrumb (fil d'Ariane)
 * @param {Object} breadcrumb
 */
export function addBreadcrumb(breadcrumb) {
  if (sentryInitialized) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

export default {
  initSentry,
  sentryErrorHandler,
  captureError,
  captureMessage,
  addBreadcrumb,
};
