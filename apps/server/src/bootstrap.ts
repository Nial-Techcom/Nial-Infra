import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import type { Config } from './config';
import * as store from './store';

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the user table is empty. */
export async function ensureAdmin(pool: Pool, cfg: Config): Promise<boolean> {
  if ((await store.users.count(pool)) > 0) return false;
  if (!cfg.adminEmail || !cfg.adminPassword) {
    console.warn('No user exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (or run "npm run create-admin") to create the first admin.');
    return false;
  }
  // The sample .env ships a placeholder password: refuse to turn it into a real admin account on a production server.
  if (cfg.nodeEnv === 'production' && (cfg.adminPassword.length < 10 || /change-?me/i.test(cfg.adminPassword))) {
    console.error('ADMIN_PASSWORD is a placeholder or shorter than 10 characters: no admin created. Set a strong ADMIN_PASSWORD in .env (or run create-admin) and restart.');
    return false;
  }
  await store.users.create(pool, { email: cfg.adminEmail, name: 'Administrator', role: 'admin', passwordHash: await bcrypt.hash(cfg.adminPassword, cfg.bcryptRounds) });
  console.log(`First admin created: ${cfg.adminEmail}`);
  return true;
}
