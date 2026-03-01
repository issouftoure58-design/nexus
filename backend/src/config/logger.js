/**
 * Winston Logger Configuration
 * Centralized logging for NEXUS backend
 */

import winston from 'winston';
import { mkdirSync } from 'fs';

// Ensure logs directory exists (gitignored, missing on fresh deploys)
mkdirSync('logs', { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }

  if (stack) {
    log += `\n${stack}`;
  }

  return log;
});

// Custom format for file output (JSON)
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { service: 'nexus-backend' },
  transports: [
    // Error logs - separate file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat
    )
  }));
} else {
  // In production, still log to console but in JSON format for log aggregators
  logger.add(new winston.transports.Console({
    format: combine(
      timestamp(),
      errors({ stack: true }),
      winston.format.json()
    )
  }));
}

// Helper methods for common logging patterns
logger.api = (method, endpoint, statusCode, responseTime, meta = {}) => {
  logger.info(`${method} ${endpoint}`, {
    type: 'api_request',
    method,
    endpoint,
    statusCode,
    responseTime,
    ...meta
  });
};

logger.tenant = (action, tenantId, meta = {}) => {
  logger.info(`Tenant ${action}`, {
    type: 'tenant_action',
    action,
    tenantId,
    ...meta
  });
};

logger.payment = (action, tenantId, amount, meta = {}) => {
  logger.info(`Payment ${action}`, {
    type: 'payment',
    action,
    tenantId,
    amount,
    ...meta
  });
};

logger.auth = (action, userId, meta = {}) => {
  logger.info(`Auth ${action}`, {
    type: 'auth',
    action,
    userId,
    ...meta
  });
};

logger.ia = (action, tenantId, model, tokens, meta = {}) => {
  logger.info(`IA ${action}`, {
    type: 'ia_request',
    action,
    tenantId,
    model,
    tokens,
    ...meta
  });
};

logger.twilio = (action, tenantId, meta = {}) => {
  logger.info(`Twilio ${action}`, {
    type: 'twilio',
    action,
    tenantId,
    ...meta
  });
};

export default logger;
