export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
  corsOrigins: string[];
  bcryptRounds: number;
  loginRateLimit: number;
  trustProxy: boolean;
  adminEmail?: string;
  adminPassword?: string;
}

const PLACEHOLDERS = ['your_super_secret_jwt_key', 'your_base64_32_byte_key_here', 'change-me'];

/** Reads and validates environment variables. Fails fast with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const prod = nodeEnv === 'production';
  const problems: string[] = [];

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl) problems.push('DATABASE_URL is required');

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 16) problems.push('JWT_SECRET must be at least 16 characters');
  if (prod && (jwtSecret.length < 32 || PLACEHOLDERS.some((p) => jwtSecret.includes(p)))) {
    problems.push('JWT_SECRET must be a random string of 32+ characters in production');
  }

  const key = Buffer.from(env.ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) problems.push('ENCRYPTION_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32)');

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
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
  };
}
