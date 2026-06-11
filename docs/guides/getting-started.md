# Getting Started — Developer Setup Guide

## Prerequisites

- **Node.js** 20+ (recommend using `nvm` or `fnm`)
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** (for local PostgreSQL)
- **Git** 2.40+

### Optional (for mobile development)
- **Xcode** 15+ (iOS development, macOS only)
- **Android Studio** (Android development)
- **Expo CLI** (`npx expo`)

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url> lifesync
cd lifesync
pnpm install
```

### 2. Environment Variables

Copy the example env files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the required values. At minimum you need:
- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `NEXT_PUBLIC_API_URL` — API server URL (default: `http://localhost:3001`)

### 3. Start Local Database

```bash
docker compose up -d postgres
```

This starts PostgreSQL on `localhost:5432` with database `lifesync_dev`.

### 4. Run Migrations & Seed

```bash
pnpm db:migrate
pnpm db:seed
```

This creates all tables and populates with sample data (two users: Alex & Jordan, with sample projects across all types).

### 5. Start Development Servers

```bash
# Start everything (web + api)
pnpm dev

# Or start individually
pnpm dev --filter=api    # API on http://localhost:3001
pnpm dev --filter=web    # Web on http://localhost:3000
pnpm dev --filter=mobile # Mobile via Expo
```

### 6. Verify Setup

- Open `http://localhost:3000` — you should see the LifeSync web app
- Open `http://localhost:3001/api/health` — should return `{ "status": "ok" }`

## Development Workflow

### Making Changes

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes in the relevant package(s)
3. Run tests: `pnpm test --filter=<package>`
4. Run lint: `pnpm lint`
5. Run typecheck: `pnpm typecheck`
6. Commit with conventional commit format: `feat(scope): description`
7. Open a PR to `develop`

### Using Claude Code Agent Commands

If you're using Claude Code, leverage the custom slash commands:
- `/frontend` — Start a frontend development task
- `/backend` — Start a backend development task
- `/database` — Start a database/migration task
- `/mobile` — Start a mobile development task
- `/testing` — Start a testing task
- `/review` — Run a code review

### Turborepo Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages (respects dependency order)
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm format           # Format all files with Prettier
```

## Troubleshooting

### Database connection fails
- Ensure Docker is running: `docker ps`
- Check the PostgreSQL container: `docker compose logs postgres`
- Verify `DATABASE_URL` in `.env`

### Type errors after pulling changes
- Rebuild shared packages: `pnpm build --filter=@lifesync/shared-types`
- Clear Turborepo cache: `npx turbo clean`

### Port conflicts
- API default port: 3001 (set `PORT` env var to change)
- Web default port: 3000 (Next.js default)
- PostgreSQL: 5432
