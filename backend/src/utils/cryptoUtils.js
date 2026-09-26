const crypto = require('crypto');

// Derive 32-byte key from JWT_SECRET or ENCRYPTION_KEY
const getMasterKey = () => {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt sensitive string (e.g. TOTP secret) using AES-256-GCM
 */
const encrypt = (plainText) => {
  if (!plainText) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt string encrypted with AES-256-GCM
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // Fallback for unencrypted legacy secrets
      return encryptedText;
    }
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CryptoUtils] Decryption error:', err.message);
    return null;
  }
};

/**
 * Hash token or code using SHA-256
 */
const hashToken = (token) => {
  if (!token) return '';
  // Normalize by removing spaces/hyphens and uppercasing if checking recovery codes
  const clean = token.toString().trim();
  return crypto.createHash('sha256').update(clean).digest('hex');
};

/**
 * Generate formatted recovery code (e.g. AB7X-92KP)
 */
const generateRecoveryCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 Crockford-like (no 0, 1, I, O)
  const getRandomChunk = (len) => {
    const bytes = crypto.randomBytes(len);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars[bytes[i] % chars.length];
    }
    return str;
  };
  return `${getRandomChunk(4)}-${getRandomChunk(4)}`;
};

/**
 * Generate batch of 8 secure recovery codes
 */
const generateRecoveryCodesBatch = (count = 8) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateRecoveryCode());
  }
  return codes;
};

module.exports = {
  encrypt,
  decrypt,
  hashToken,
  generateRecoveryCode,
  generateRecoveryCodesBatch
};
