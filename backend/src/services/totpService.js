/**
 * TOTP Service — 2FA pour NEXUS
 * Basé sur sentinel/security/twoFactorAuth.js, adapté pour persistance DB.
 * Zero dépendance externe — Node.js crypto natif uniquement.
 */

import crypto from 'crypto';

const TOTP_CONFIG = {
  codeLength: 6,
  period: 30,
  algorithm: 'sha1',
  backupCodesCount: 10,
  issuer: 'NEXUS',
};

// Clé de chiffrement AES-256 pour les secrets TOTP en DB
function getEncryptionKey() {
  const key = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY ou JWT_SECRET requis');
  // Dériver une clé 32 bytes à partir du secret
  return crypto.createHash('sha256').update(key).digest();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE32
// ═══════════════════════════════════════════════════════════════════════════════

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += B32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

function base32Decode(encoded) {
  const lookup = {};
  for (let i = 0; i < B32_ALPHABET.length; i++) {
    lookup[B32_ALPHABET[i]] = i;
  }

  const cleanedInput = encoded.toUpperCase().replace(/=+$/, '');
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanedInput) {
    if (!(char in lookup)) continue;
    value = (value << 5) | lookup[char];
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOTP CORE
// ═══════════════════════════════════════════════════════════════════════════════

function generateSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

function generateHOTP(secret, counter) {
  const decodedSecret = base32Decode(secret);

  const counterBuffer = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const hmac = crypto.createHmac(TOTP_CONFIG.algorithm, decodedSecret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return (binary % Math.pow(10, TOTP_CONFIG.codeLength))
    .toString()
    .padStart(TOTP_CONFIG.codeLength, '0');
}

function generateTOTP(secret, time = null) {
  const epoch = Math.floor((time || Date.now()) / 1000);
  const counter = Math.floor(epoch / TOTP_CONFIG.period);
  return generateHOTP(secret, counter);
}

function verifyTOTP(secret, code, window = 1) {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const time = now + i * TOTP_CONFIG.period * 1000;
    if (code === generateTOTP(secret, time)) {
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP CODES
// ═══════════════════════════════════════════════════════════════════════════════

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < TOTP_CONFIG.backupCodesCount; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHIFFREMENT AES-256-CBC
// ═══════════════════════════════════════════════════════════════════════════════

function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(encrypted) {
  const key = getEncryptionKey();
  const [ivHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP AUTH URL
// ═══════════════════════════════════════════════════════════════════════════════

function generateOtpAuthUrl(email, secret) {
  const issuer = encodeURIComponent(TOTP_CONFIG.issuer);
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm.toUpperCase()}&digits=${TOTP_CONFIG.codeLength}&period=${TOTP_CONFIG.period}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const totpService = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  encryptSecret,
  decryptSecret,
  generateOtpAuthUrl,
};

export default totpService;
