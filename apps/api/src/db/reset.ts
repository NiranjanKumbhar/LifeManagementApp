import '../load-env';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';

async function reset() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  // Safety check — never run against production
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('db:reset cannot be run in production');
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('⚠️  Dropping all tables...');
  await db.execute(sql`
    DROP TABLE IF EXISTS
      inbox_items,
      notifications,
      activity_events,
      resources,
      people,
      household_items,
      reminders,
      tasks,
      projects,
      project_templates,
      workspace_members,
      users,
      workspaces
    CASCADE
  `);

  // Drop drizzle migration tracking table so migrations re-run cleanly
  await db.execute(sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  console.log('▶️  Running migrations...');
  await migrate(db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
  });

  console.log('🌱 Running seeds...');
  // Import seed dynamically after migrate completes
  await import('./seeds/development');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
