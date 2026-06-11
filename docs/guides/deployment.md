# Deployment Guide

## Environments

| Environment | Branch | URL | Purpose |
|---|---|---|---|
| **Local** | any | `localhost:3000` / `localhost:3001` | Development |
| **Preview** | PR branches | `*.vercel.app` | PR review |
| **Staging** | `develop` | `staging.lifesync.app` | Integration testing |
| **Production** | `main` (via release tag) | `app.lifesync.app` | Users |

## Hosting

| Service | Platform | Details |
|---|---|---|
| Web App | Vercel | Next.js with automatic deployments |
| API Server | Railway / Fly.io | Node.js server with auto-scaling |
| Database | Supabase | Managed PostgreSQL |
| Background Jobs | Inngest Cloud | Managed job runner |
| Sync | PowerSync Cloud | Managed sync service |
| Mobile Builds | EAS Build (Expo) | iOS & Android CI |

## Deployment Procedures

### Web (Vercel)
- Automatic on merge to `develop` (staging) or `main` (production)
- Preview deploys on every PR
- Rollback: Vercel dashboard → Deployments → Promote previous

### API (Railway / Fly.io)
```bash
# Manual deploy (if needed)
fly deploy --config infrastructure/fly.toml

# Rollback
fly releases --app lifesync-api
fly deploy --image <previous-image-ref>
```

### Database Migrations
```bash
# Always run on staging first
pnpm db:migrate --env staging

# Verify staging works
# Then run on production
pnpm db:migrate --env production
```

⚠️ **Never run destructive migrations without a backup:**
```bash
# Backup before migration
supabase db dump --linked > backup_$(date +%Y%m%d).sql
```

### Mobile (EAS Build)
```bash
# Build for both platforms
npx eas build --platform all --profile production

# Submit to stores
npx eas submit --platform ios
npx eas submit --platform android
```

## Environment Variables

See `docs/guides/getting-started.md` for the full list.

Each environment has its own set of env vars configured in:
- **Vercel**: Project Settings → Environment Variables
- **Railway/Fly.io**: Dashboard → Secrets
- **Supabase**: Auto-configured
- **Inngest**: Dashboard → Signing Key + Event Key

## Monitoring

### Error Tracking — Sentry
- Configured in both web and API
- Alert on new error types
- Track error rates and trends

### Performance — Vercel Analytics
- Core Web Vitals tracking
- Real User Monitoring (RUM)
- Server-side performance metrics

### Infrastructure — Platform Dashboards
- Railway/Fly.io: CPU, memory, request metrics
- Supabase: Database connections, query performance
- Inngest: Job success/failure rates, queue depth

## Rollback Procedures

### Web App
1. Go to Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click "Promote to Production"

### API Server
1. Check recent releases: `fly releases`
2. Redeploy previous version: `fly deploy --image <previous>`
3. Verify health: `curl https://api.lifesync.app/api/health`

### Database
1. If migration is backward-compatible: no DB rollback needed
2. If migration is breaking: restore from backup
3. Always test migrations on staging first

## Release Checklist

- [ ] All tests pass on `develop`
- [ ] Staging tested and approved
- [ ] Database migrations tested on staging
- [ ] No known critical bugs
- [ ] Release notes written
- [ ] Create release tag: `git tag v1.x.x && git push --tags`
- [ ] Monitor error rates for 30 minutes post-deploy
- [ ] Verify critical flows: capture, dashboard, sync, notifications
