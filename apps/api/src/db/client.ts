import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

function createDb() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const queryClient = postgres(connectionString);
  return drizzle(queryClient, { schema });
}

// Lazily initialize so merely importing this module (e.g. during Next.js's
// build-time "collecting page data" pass) never requires DATABASE_URL — the
// connection is created on first actual use, at request time.
let instance: Database | undefined;
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    instance ??= createDb();
    return Reflect.get(instance, prop, receiver);
  },
});
