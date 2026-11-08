import 'dotenv/config';
import { createApp } from './app';
import { ensureAdmin } from './bootstrap';
import { loadConfig } from './config';
import { createPool, migrate } from './db';

async function main() {
  const cfg = loadConfig();
  const pool = createPool(cfg.databaseUrl);
  const applied = await migrate(pool);
  if (applied.length) console.log('Migrations applied:', applied.join(', '));
  await ensureAdmin(pool, cfg);
  const server = createApp(pool, cfg).listen(cfg.port, () => console.log(`NetForge API listening on :${cfg.port}`));
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
