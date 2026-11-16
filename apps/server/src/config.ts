import { LICENSE_PUBLIC_KEY } from './license/core';

export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
  corsOrigins: string[];
  bcryptRounds: number;
  loginRateLimit: number;
  /** failed logins tolerated per account per 15 min */
  accountLockLimit: number;
  /** requests per minute and IP on the whole API */
  apiRateLimit: number;
  trustProxy: boolean;
  /** Public address used in e-mailed links when the admin panel has none (PUBLIC_URL). Never taken from the request. */
  publicUrl: string;
  adminEmail?: string;
  adminPassword?: string;
  /** Licence server used for revocation checks. Empty = no online check (signed file only). */
  licenseServerUrl: string;
  /** Ed25519 public key (base64 DER). Overridable outside production only (tests). */
  licensePublicKey: string;
  trialDays: number;
  /** days the server keeps working when the licence server cannot be reached */
  licenseGraceDays: number;
}

// Sample values shipped in .env.example / old docs: public, so never acceptable as real secrets.
const PLACEHOLDERS = ['your_super_secret_jwt_key', 'your_base64_32_byte_key_here', 'change-me', 'generate-', 'changeme', 'example'];

/** A "random" secret made of very few distinct characters (aaaa…, 1234…) is not random. */
function lowEntropy(s: string): boolean {
  return new Set(s).size < 10;
}

/** Reads and validates environment variables. Fails fast with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const prod = nodeEnv === 'production';
  const problems: string[] = [];

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl) problems.push('DATABASE_URL is required');

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 16) problems.push('JWT_SECRET must be at least 16 characters');
  if (prod && (jwtSecret.length < 32 || lowEntropy(jwtSecret) || PLACEHOLDERS.some((p) => jwtSecret.toLowerCase().includes(p)))) {
    problems.push('JWT_SECRET must be a random string of 32+ characters in production');
  }

  const key = Buffer.from(env.ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) problems.push('ENCRYPTION_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32)');
  else if (prod && new Set(key).size < 8) problems.push('ENCRYPTION_KEY looks like a placeholder: generate one with openssl rand -base64 32');
  if (prod && PLACEHOLDERS.some((p) => databaseUrl.toLowerCase().includes(p))) {
    problems.push('The database password is still the sample value: set a real POSTGRES_PASSWORD (openssl rand -hex 24)');
  }

  if (problems.length) throw new Error('Invalid configuration:\n - ' + problems.join('\n - '));

  return {
    nodeEnv,
    port: Number(env.PORT ?? 5000),
    databaseUrl,
    jwtSecret,
    encryptionKey: key,
    corsOrigins: (env.CORS_ORIGINS ?? env.FRONTEND_URL ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
    bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 12),
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT ?? 20),
    accountLockLimit: Number(env.ACCOUNT_LOCK_LIMIT ?? 10),
    apiRateLimit: Number(env.API_RATE_LIMIT ?? 1000),
    publicUrl: (env.PUBLIC_URL ?? '').trim().replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    licenseServerUrl: (env.LICENSE_SERVER_URL ?? 'https://lcsinfra.nial-tech.com').trim().replace(/\/+$/, ''),
    // Trial length and key can only be changed outside production, so a customer cannot shorten the checks via .env.
    licensePublicKey: (!prod && env.LICENSE_PUBLIC_KEY) || LICENSE_PUBLIC_KEY,
    trialDays: (!prod && Number(env.LICENSE_TRIAL_DAYS)) || 14,
    licenseGraceDays: 30,
  };
}
