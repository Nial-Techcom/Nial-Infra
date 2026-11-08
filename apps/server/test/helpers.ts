import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createPool, migrate } from '../src/db';
import * as store from '../src/store';

export const KEY = Buffer.alloc(32, 7).toString('base64');

export async function setupApp() {
  const cfg = loadConfig({
    NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL, JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: KEY,
    BCRYPT_ROUNDS: '4', LOGIN_RATE_LIMIT: '1000',
  } as NodeJS.ProcessEnv);
  const pool: Pool = createPool(cfg.databaseUrl);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  const app = createApp(pool, cfg);
  const api = request(app);

  const mk = async (role: string, email = `${role}@test.io`) =>
    store.users.create(pool, { email, name: role, role, passwordHash: await bcrypt.hash('password123', 4) });
  const login = async (email: string, password = 'password123') => (await api.post('/api/v1/auth/login').send({ email, password })).body.token as string;

  await mk('admin'); await mk('technician'); await mk('viewer');
  const tokens = { admin: await login('admin@test.io'), tech: await login('technician@test.io'), viewer: await login('viewer@test.io') };
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  return { pool, cfg, api, tokens, as, login };
}
