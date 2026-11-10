import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { loadConfig } from './config';
import { createPool, migrate } from './db';
import * as store from './store';

/** Usage: npm run create-admin -w @netforge/server -- admin@example.com "Strong password" ["Display name"] */
async function main() {
  const [email, password, name = 'Administrator'] = process.argv.slice(2);
  if (!email || !password || password.length < 10) throw new Error('Usage: create-admin <email> <password (10+ chars)> [name]');
  const cfg = loadConfig();
  const pool = createPool(cfg.databaseUrl);
  await migrate(pool);
  const u = await store.users.create(pool, { email, name, role: 'admin', passwordHash: await bcrypt.hash(password, cfg.bcryptRounds) });
  console.log(`Admin created: ${u.email}`);
  await pool.end();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
