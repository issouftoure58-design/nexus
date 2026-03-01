/**
 * Sentry Error Monitoring Configuration
 * Centralized error tracking for NEXUS
 */

import * as Sentry from '@sentry/node';
import logger from './logger.js';

let sentryInitialized = false;

export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('No SENTRY_DSN configured - error monitoring disabled', { tag: 'SENTRY' });
    return;
  }

  if (sentryInitialized) return;
  sentryInitialized = true;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['x-api-key'];
      }
      if (event.request?.data && typeof event.request.data === 'object') {
        ['password', 'token', 'apiKey', 'secret', 'credit_card'].forEach(field => {
          if (event.request.data[field]) {
            event.request.data[field] = '[REDACTED]';
          }
        });
      }
      return event;
    },
    ignoreErrors: [
      'TENANT_REQUIRED',
      'UNAUTHORIZED',
      'Invalid API key',
      'Rate limit exceeded'
    ]
  });

  // Apply request handler middleware
  app.use(Sentry.Handlers.requestHandler());
}

export function sentryErrorHandler(app) {
  if (!process.env.SENTRY_DSN) return;

  app.use(Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      return !error.status || error.status >= 500;
    }
  }));
}

export const captureException = (err) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
};

export const captureMessage = (msg, level = 'info') => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(msg, level);
  }
};

export default { initSentry, sentryErrorHandler, captureException, captureMessage };
