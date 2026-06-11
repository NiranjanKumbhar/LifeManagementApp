import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `apps/api/.env` into process.env using Node's built-in env-file loader
 * (Node ≥ 20.12). Import this FIRST in any entry point that reads env vars
 * (server, seeds, reset) so they are set before `db/client.ts` is evaluated.
 *
 * Real environment variables already present are not overwritten.
 */
const envPath = resolve(process.cwd(), '.env');

if (typeof process.loadEnvFile === 'function' && existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
