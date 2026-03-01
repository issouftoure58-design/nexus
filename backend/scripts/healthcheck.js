#!/usr/bin/env node
/**
 * NEXUS Platform Health Check Script
 * Validates configuration and dependencies before deployment
 */

import dotenv from 'dotenv';
dotenv.config();

const checks = [];
let hasErrors = false;

function check(name, condition, errorMsg) {
  if (condition) {
    checks.push({ name, status: 'PASS', message: '' });
  } else {
    checks.push({ name, status: 'FAIL', message: errorMsg });
    hasErrors = true;
  }
}

function warn(name, condition, warnMsg) {
  if (!condition) {
    checks.push({ name, status: 'WARN', message: warnMsg });
  }
}

console.log('\n🔍 NEXUS Health Check\n');
console.log('='.repeat(60));

// Required environment variables
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY'
];

for (const key of required) {
  check(
    `ENV: ${key}`,
    !!process.env[key],
    `Missing required environment variable: ${key}`
  );
}

// Optional but recommended
const optional = [
  'STRIPE_SECRET_KEY',
  'TWILIO_ACCOUNT_SID',
  'RESEND_API_KEY',
  'SENTRY_DSN'
];

for (const key of optional) {
  warn(
    `ENV: ${key}`,
    !!process.env[key],
    `Optional but recommended: ${key}`
  );
}

// JWT Secret strength
check(
  'JWT Secret Length',
  process.env.JWT_SECRET?.length >= 32,
  'JWT_SECRET should be at least 32 characters'
);

// Node version
const nodeVersion = process.version.replace('v', '').split('.')[0];
check(
  'Node.js Version',
  parseInt(nodeVersion) >= 18,
  `Node.js 18+ required, found ${process.version}`
);

// Print results
console.log('');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} ${c.name}`);
  if (c.message) {
    console.log(`   └─ ${c.message}`);
  }
}

console.log('');
console.log('='.repeat(60));

const passCount = checks.filter(c => c.status === 'PASS').length;
const warnCount = checks.filter(c => c.status === 'WARN').length;
const failCount = checks.filter(c => c.status === 'FAIL').length;

console.log(`\n📊 Results: ${passCount} passed, ${warnCount} warnings, ${failCount} failed\n`);

if (hasErrors) {
  console.log('❌ Health check FAILED - fix errors before deployment\n');
  process.exit(1);
} else {
  console.log('✅ Health check PASSED - ready for deployment\n');
  process.exit(0);
}
