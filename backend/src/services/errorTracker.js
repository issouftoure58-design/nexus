/**
 * Error Tracker Service — SENTINEL Error Tracking
 * Drop-in replacement for Sentry (captureException / captureMessage)
 * Stores errors in error_logs table for dashboard visibility
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

const IGNORED_MESSAGES = [
  'TENANT_REQUIRED',
  'UNAUTHORIZED',
  'Invalid API key',
  'Rate limit exceeded',
];

const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'secret', 'credit_card', 'authorization', 'cookie'];

/**
 * Generate a fingerprint hash to group similar errors
 */
function generateFingerprint(message, stack) {
  const firstFrame = stack
    ? stack.split('\n').find(line => line.trim().startsWith('at '))?.trim() || ''
    : '';
  const raw = `${message}::${firstFrame}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Extract tenant_id from context (req object or explicit)
 */
function extractTenantId(context) {
  if (context.tenant_id) return context.tenant_id;
  if (context.req?.tenantId) return context.req.tenantId;
  if (context.req?.headers?.['x-tenant-id']) return context.req.headers['x-tenant-id'];
  if (context.tags?.tenant_id) return context.tags.tenant_id;
  return null;
}

/**
 * Build sanitized context (strip sensitive headers/body fields)
 */
function sanitizeContext(context) {
  const sanitized = {};

  if (context.req) {
    sanitized.method = context.req.method;
    sanitized.path = context.req.path || context.req.url;
    sanitized.ip = context.req.ip;
    if (context.req.admin?.id) sanitized.admin_id = context.req.admin.id;
    if (context.req.body && typeof context.req.body === 'object') {
      const body = { ...context.req.body };
      SENSITIVE_FIELDS.forEach(f => { if (body[f]) body[f] = '[REDACTED]'; });
      sanitized.body = body;
    }
  }

  if (context.tags) sanitized.tags = context.tags;
  if (context.extra) sanitized.extra = context.extra;
  if (context.user) sanitized.user = context.user;
  if (context.componentStack) sanitized.componentStack = context.componentStack;

  return sanitized;
}

/**
 * Insert error into error_logs table
 */
async function insertError({ tenantId, level, message, stack, context, source, fingerprint }) {
  try {
    const { error } = await supabase.from('error_logs').insert({
      tenant_id: tenantId || null,
      level,
      message: message.substring(0, 2000),
      stack: stack ? stack.substring(0, 10000) : null,
      context: context || {},
      source,
      fingerprint,
    });

    if (error) {
      logger.error('[ErrorTracker] Failed to insert error_log', { error: error.message });
    }
  } catch (err) {
    // Never let error tracking break the app
    logger.error('[ErrorTracker] Insert exception', { error: err.message });
  }
}

/**
 * captureException — Drop-in replacement for Sentry.captureException
 * @param {Error} err - The error to capture
 * @param {object} context - Optional context (req, tags, extra, user, level)
 */
export function captureException(err, context = {}) {
  if (!err) return;

  const message = err.message || String(err);

  // Skip ignored errors
  if (IGNORED_MESSAGES.some(ignored => message.includes(ignored))) return;

  const stack = err.stack || null;
  const tenantId = extractTenantId(context);
  const fingerprint = generateFingerprint(message, stack);
  const level = context.level || 'error';
  const sanitized = sanitizeContext(context);

  // Console log for dev visibility
  logger.error(`[ErrorTracker] ${level.toUpperCase()}: ${message}`, {
    fingerprint,
    tenant_id: tenantId,
    tag: 'ERROR_TRACKER',
  });

  // Fire-and-forget insert
  insertError({
    tenantId,
    level,
    message,
    stack,
    context: sanitized,
    source: 'backend',
    fingerprint,
  });
}

/**
 * captureMessage — Drop-in replacement for Sentry.captureMessage
 * @param {string} msg - The message to capture
 * @param {string} level - Level: error, warning, info, fatal
 * @param {object} context - Optional context
 */
export function captureMessage(msg, level = 'info', context = {}) {
  if (!msg) return;

  if (IGNORED_MESSAGES.some(ignored => msg.includes(ignored))) return;

  const tenantId = extractTenantId(context);
  const fingerprint = generateFingerprint(msg, null);
  const sanitized = sanitizeContext(context);

  logger.warn(`[ErrorTracker] ${level.toUpperCase()}: ${msg}`, {
    fingerprint,
    tenant_id: tenantId,
    tag: 'ERROR_TRACKER',
  });

  insertError({
    tenantId,
    level,
    message: msg,
    stack: null,
    context: sanitized,
    source: 'backend',
    fingerprint,
  });
}

/**
 * Report frontend error (called by POST /api/errors/report)
 */
export async function reportFrontendError({ message, stack, level, context }) {
  if (!message) return;

  const fingerprint = generateFingerprint(message, stack);

  await insertError({
    tenantId: context?.tenant_id || null,
    level: level || 'error',
    message,
    stack: stack || null,
    context: context || {},
    source: 'frontend',
    fingerprint,
  });
}

/**
 * getErrors — Paginated error list with filters
 */
export async function getErrors({ page = 1, limit = 50, level, source, tenantId, from, to } = {}) {
  let query = supabase
    .from('error_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`getErrors failed: ${error.message}`);

  return { errors: data || [], total: count || 0, page, limit };
}

/**
 * getErrorStats — Aggregated error statistics
 */
export async function getErrorStats() {
  const now = new Date();
  const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const h1 = new Date(now - 60 * 60 * 1000).toISOString();

  // All errors last 24h
  const { data: recent, error: recentErr } = await supabase
    .from('error_logs')
    .select('level, fingerprint, message, source')
    .gte('created_at', h24);

  if (recentErr) throw new Error(`getErrorStats failed: ${recentErr.message}`);

  const errors24h = recent || [];

  // Count by level
  const byLevel = { error: 0, warning: 0, info: 0, fatal: 0 };
  errors24h.forEach(e => {
    if (byLevel[e.level] !== undefined) byLevel[e.level]++;
  });

  // Count by source
  const bySource = { backend: 0, frontend: 0 };
  errors24h.forEach(e => {
    if (bySource[e.source] !== undefined) bySource[e.source]++;
  });

  // Top recurring fingerprints
  const fpCounts = {};
  errors24h.forEach(e => {
    if (e.fingerprint) {
      if (!fpCounts[e.fingerprint]) {
        fpCounts[e.fingerprint] = { fingerprint: e.fingerprint, message: e.message, source: e.source, count: 0 };
      }
      fpCounts[e.fingerprint].count++;
    }
  });
  const topErrors = Object.values(fpCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Last hour count for trend
  const lastHourCount = errors24h.filter(e => e.created_at >= h1).length;

  return {
    total_24h: errors24h.length,
    last_hour: lastHourCount,
    by_level: byLevel,
    by_source: bySource,
    top_errors: topErrors,
  };
}

export default { captureException, captureMessage, reportFrontendError, getErrors, getErrorStats };
