import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Tests need a real PostgreSQL. Either point TEST_DATABASE_URL at a throw-away database,
 * or let this file start an embedded PostgreSQL (it cannot run as root).
 */
export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  if (process.getuid?.() === 0) {
    throw new Error('Embedded PostgreSQL cannot run as root. Set TEST_DATABASE_URL to a disposable database instead.');
  }
  // embedded-postgres is ESM-only; importing by a variable keeps this file compatible with the CJS tsconfig.
  const moduleName = 'embedded-postgres';
  const { default: EmbeddedPostgres } = (await import(moduleName)) as { default: new (o: Record<string, unknown>) => { initialise(): Promise<void>; start(): Promise<void>; createDatabase(n: string): Promise<void>; stop(): Promise<void> } };
  const dir = mkdtempSync(join(tmpdir(), 'infra-tech-pg-'));
  const port = 54000 + Math.floor(Math.random() * 900);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'netforge', password: 'netforge', port, persistent: false, onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('netforge_test');
  process.env.TEST_DATABASE_URL = `postgresql://netforge:infra-tech@localhost:${port}/netforge_test`;
  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
