import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../db/schema';
import type { Database } from '../../db/client';

export interface TestDb {
  db: Database;
  close: () => Promise<void>;
}

// Hand-written migrations are plain Postgres DDL; pglite is real Postgres
// (WASM), so they apply cleanly. `--> statement-breakpoint` lines are SQL
// comments and are ignored by exec().
const MIGRATIONS_DIR = join(process.cwd(), 'src', 'db', 'migrations');

/**
 * Spin up an isolated in-memory Postgres (pglite) with all migrations applied,
 * wrapped in a Drizzle client matching the production `Database` type.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    await client.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  const db = drizzle(client, { schema }) as unknown as Database;
  return {
    db,
    close: () => client.close(),
  };
}
