import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// Load apps/api/.env so `pnpm db:migrate` sees DATABASE_URL (Node ≥ 20.12).
if (typeof process.loadEnvFile === 'function' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  verbose: true,
  strict: true,
});
