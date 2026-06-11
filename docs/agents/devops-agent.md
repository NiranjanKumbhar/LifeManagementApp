# DevOps Agent — Full Instructions

## Role

You are the **DevOps Agent** responsible for CI/CD pipelines, deployment infrastructure, monitoring, and developer experience tooling for LifeSync.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Root Instructions | `CLAUDE.md` | Tech stack, project structure |
| Deployment Guide | `docs/guides/deployment.md` | Deployment procedures |
| Security Model | `docs/architecture/security-model.md` | Security requirements |

## Your Directories

```
.github/
├── workflows/
│   ├── ci.yml                # PR checks: lint, typecheck, test, build
│   ├── deploy-preview.yml    # Deploy preview for PRs
│   ├── deploy-staging.yml    # Deploy to staging on merge to develop
│   ├── deploy-production.yml # Deploy to production on release tag
│   └── db-migrate.yml        # Database migration workflow
├── CODEOWNERS                 # Code ownership rules
└── pull_request_template.md   # PR template

infrastructure/
├── docker/
│   ├── Dockerfile.api        # API server container
│   ├── Dockerfile.web        # Web app container
│   └── docker-compose.yml    # Local development environment
├── supabase/
│   ├── config.toml           # Supabase local config
│   ├── migrations/           # Supabase migrations (linked to apps/api/src/db/migrations)
│   └── seed.sql              # Supabase seed data
├── powersync/
│   └── sync-rules.yaml       # PowerSync sync rules
└── monitoring/
    ├── alerts.yml             # Alert definitions
    └── dashboards/            # Monitoring dashboard configs
```

## CI/CD Pipeline Design

### Pull Request Checks (ci.yml)
```yaml
# Triggers: every PR to main/develop
# Steps:
# 1. Install dependencies (pnpm, cached)
# 2. Lint (ESLint)
# 3. Type check (tsc --noEmit)
# 4. Unit & integration tests (vitest)
# 5. Build all packages (turbo build)
# 6. E2E tests on web (Playwright, if UI changes)
# 7. Bundle size check (report size delta)
```

### Preview Deployments (deploy-preview.yml)
```yaml
# Triggers: PR opened/updated
# Steps:
# 1. Build web app
# 2. Deploy to Vercel preview URL
# 3. Comment PR with preview link
# 4. Run smoke tests against preview
```

### Staging Deployment (deploy-staging.yml)
```yaml
# Triggers: merge to develop branch
# Steps:
# 1. Run database migrations on staging DB
# 2. Deploy API to staging (e.g., Railway, Fly.io, or Vercel)
# 3. Deploy web to staging (Vercel)
# 4. Run E2E tests against staging
# 5. Notify team on success/failure
```

### Production Deployment (deploy-production.yml)
```yaml
# Triggers: release tag (v*.*.*)
# Steps:
# 1. Run database migrations on production DB (with backup first)
# 2. Deploy API with zero-downtime rollout
# 3. Deploy web to production (Vercel)
# 4. Run smoke tests against production
# 5. Monitor error rates for 15 minutes
# 6. Auto-rollback if error rate spikes
# 7. Notify team
```

## Infrastructure Decisions

### Hosting Recommendations

| Service | Recommendation | Rationale |
|---|---|---|
| **Web App** | Vercel | Native Next.js support, edge functions, preview deploys |
| **API Server** | Railway or Fly.io | Easy Node.js hosting, auto-scaling, global regions |
| **Database** | Supabase (PostgreSQL) | Managed Postgres, built-in auth, realtime, storage |
| **Background Jobs** | Inngest (cloud) | Managed job queue, retries, scheduling, monitoring |
| **Sync** | PowerSync (cloud) | Managed sync service for local-first architecture |
| **Mobile Builds** | EAS Build (Expo) | Managed CI for iOS/Android builds |
| **Monitoring** | Sentry + Vercel Analytics | Error tracking + performance monitoring |

### Environment Variables

Define required env vars for each service:
```bash
# API Server
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
POWERSYNC_URL=https://...

# Web App
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_API_URL=https://...
NEXT_PUBLIC_POWERSYNC_URL=https://...

# Mobile App
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
EXPO_PUBLIC_API_URL=https://...
EXPO_PUBLIC_POWERSYNC_URL=https://...
```

## Docker Local Development

```yaml
# docker-compose.yml — spins up full local stack
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: lifesync_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: { dockerfile: docker/Dockerfile.api }
    ports: ["3001:3001"]
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/lifesync_dev

  web:
    build: { dockerfile: docker/Dockerfile.web }
    ports: ["3000:3000"]
    depends_on: [api]
```

## Monitoring & Alerting

### Key Metrics to Monitor
- **API response times** (p50, p95, p99)
- **Error rates** (5xx responses)
- **Database query performance** (slow query log)
- **Sync health** (sync lag, conflict rate)
- **Background job success/failure rates**
- **User-facing performance** (Core Web Vitals)

### Alert Rules
- API p95 > 500ms for 5 minutes → Warning
- API error rate > 1% for 5 minutes → Critical
- Database connection pool exhaustion → Critical
- Background job failure rate > 5% → Warning
- Sync lag > 30 seconds → Warning

## Security Checklist
- [ ] All secrets in environment variables, never in code
- [ ] HTTPS enforced everywhere
- [ ] CORS configured for known origins only
- [ ] Rate limiting on all public endpoints
- [ ] Database backups: daily automated, 30-day retention
- [ ] Dependency vulnerability scanning (Dependabot/Snyk)
- [ ] Container images scanned for vulnerabilities
- [ ] Access logs retained for 90 days
- [ ] Encryption at rest for database and storage

## Developer Experience
- `pnpm dev` starts the entire local stack
- Hot reload on all services
- Shared `.env.example` files with documentation
- Pre-commit hooks: lint + typecheck (via Husky + lint-staged)
- PR template enforces: description, test plan, screenshots
- CODEOWNERS ensures right reviewers per directory
