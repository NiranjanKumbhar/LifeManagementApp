# PWA Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a web app manifest to the Next.js web app so mobile users get a browser-native "Add to Home Screen" prompt and the app launches in standalone mode (no browser chrome).

**Architecture:** Next.js 15 App Router's `app/manifest.ts` exports the manifest as a typed function — Next.js serves it at `/manifest.webmanifest` automatically. iOS Safari ignores the standard manifest for several fields, so we also add `appleWebApp` and `themeColor` to the existing `metadata` export in `layout.tsx`. Three PNG icons (192px, 512px, 512px maskable) are generated once from SVG via a Node script using `sharp`, then committed to the repo so no build-time image processing is needed.

**Tech Stack:** Next.js 15 App Router, `MetadataRoute.Manifest` type, `sharp` (dev-only, icon generation), Vitest (tests)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `scripts/generate-icons.mjs` | Create | One-time script: SVG → PNG icons |
| `apps/web/public/icons/icon-192.png` | Create (generated) | Standard 192×192 icon |
| `apps/web/public/icons/icon-512.png` | Create (generated) | Standard 512×512 icon |
| `apps/web/public/icons/icon-512-maskable.png` | Create (generated) | Android adaptive icon (safe-zone padded) |
| `apps/web/src/app/manifest.ts` | Create | Next.js manifest route |
| `apps/web/src/app/manifest.test.ts` | Create | Unit test for manifest function |
| `apps/web/src/app/layout.tsx` | Modify | Add iOS-specific PWA metadata |

---

## Task 1: Add `sharp` and write icon generation script

`sharp` converts SVG buffers to PNG. It goes in the root `package.json` as a `devDependency` so it's available from anywhere in the monorepo.

**Files:**
- Modify: `package.json` (root)
- Create: `scripts/generate-icons.mjs`

- [ ] **Step 1: Install `sharp` as a root devDependency**

```bash
pnpm add -D sharp --workspace-root
```

Expected output: `devDependencies` in root `package.json` now contains `"sharp": "^0.33.x"`.

- [ ] **Step 2: Create `scripts/generate-icons.mjs`**

```js
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../apps/web/public/icons');

await mkdir(iconsDir, { recursive: true });

const icon192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#2a9d8f"/>
  <text x="96" y="126" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="80" fill="#f9f6f2">LS</text>
</svg>`;

const icon512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#2a9d8f"/>
  <text x="256" y="336" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="210" fill="#f9f6f2">LS</text>
</svg>`;

// Maskable: full-bleed background, text scaled to fit within the 60% safe zone
// (Android crops to circle/squircle — content outside 80% radius may be clipped)
const icon512Maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2a9d8f"/>
  <text x="256" y="310" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="160" fill="#f9f6f2">LS</text>
</svg>`;

await sharp(Buffer.from(icon192)).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
await sharp(Buffer.from(icon512)).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));
await sharp(Buffer.from(icon512Maskable)).resize(512, 512).png().toFile(join(iconsDir, 'icon-512-maskable.png'));

console.log('✓ Icons written to apps/web/public/icons/');
```

- [ ] **Step 3: Run the script**

```bash
node scripts/generate-icons.mjs
```

Expected output:
```
✓ Icons written to apps/web/public/icons/
```

Verify the three files exist:
```bash
ls apps/web/public/icons/
# icon-192.png  icon-512.png  icon-512-maskable.png
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/generate-icons.mjs apps/web/public/icons/
git commit -m "feat(web): add PWA app icons (192px, 512px, 512px maskable)"
```

---

## Task 2: Create `manifest.ts`

**Files:**
- Create: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/app/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('returns correct name and short_name', () => {
    const result = manifest();
    expect(result.name).toBe('LifeSync');
    expect(result.short_name).toBe('LifeSync');
  });

  it('opens in standalone display mode', () => {
    expect(manifest().display).toBe('standalone');
  });

  it('starts at /dashboard', () => {
    expect(manifest().start_url).toBe('/dashboard');
  });

  it('uses LifeSync brand colors', () => {
    const result = manifest();
    expect(result.theme_color).toBe('#2a9d8f');
    expect(result.background_color).toBe('#f9f6f2');
  });

  it('includes three icons (192, 512, 512-maskable)', () => {
    const icons = manifest().icons ?? [];
    expect(icons).toHaveLength(3);
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(icons[2]!.purpose).toBe('maskable');
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
pnpm test --filter=web -- manifest
```

Expected: FAIL — `Cannot find module './manifest'`

- [ ] **Step 3: Create `apps/web/src/app/manifest.ts`**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LifeSync',
    short_name: 'LifeSync',
    description: 'A calm, shared place for the two of you to stay on top of life together.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9f6f2',
    theme_color: '#2a9d8f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test --filter=web -- manifest
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/manifest.ts apps/web/src/app/manifest.test.ts
git commit -m "feat(web): add PWA manifest route"
```

---

## Task 3: Add iOS metadata to `layout.tsx`

iOS Safari ignores the standard web manifest for the app title, status bar style, and apple-touch-icon. These must be added to the Next.js `metadata` export.

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Update the `metadata` export in `layout.tsx`**

Replace the existing `metadata` export (lines 20-23 of the current file) with:

```ts
export const metadata: Metadata = {
  title: 'LifeSync — your shared life, handled',
  description: 'A calm, shared place for the two of you to stay on top of life together.',
  // PWA: iOS Safari reads these instead of the manifest for home screen installs
  themeColor: '#2a9d8f',
  appleWebApp: {
    capable: true,
    title: 'LifeSync',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};
```

`capable: true` emits `<meta name="apple-mobile-web-app-capable" content="yes">` which enables standalone mode on iOS.
`statusBarStyle: 'default'` shows the iOS status bar normally (black text on white/transparent).

- [ ] **Step 2: Run the full web test suite**

```bash
pnpm test --filter=web
```

Expected: all existing tests pass (the metadata change is backward-compatible).

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter=web typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): add iOS PWA metadata (apple-touch-icon, standalone mode)"
```

---

## Task 4: Verify production build

- [ ] **Step 1: Run production build**

```bash
pnpm build --filter=web
```

Expected: build succeeds with no errors. Next.js will log that it generated the `/manifest.webmanifest` route.

Look for a line like:
```
○ /manifest.webmanifest
```
in the build output routes table.

- [ ] **Step 2: Verify manifest route locally (optional)**

```bash
pnpm dev --filter=web
```

Then open `http://localhost:3000/manifest.webmanifest` in a browser. Expected JSON:

```json
{
  "name": "LifeSync",
  "short_name": "LifeSync",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#2a9d8f",
  "background_color": "#f9f6f2",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Push**

```bash
git push
```

---

## Notes

- **iOS install flow:** On iPhone, the user must tap Share → "Add to Home Screen" manually. iOS does not show an automatic install banner — this is an Apple platform constraint.
- **Android install flow:** Chrome shows a banner automatically after the user visits the site twice within two weeks with at least 30 seconds of engagement per visit (or sooner via Chrome's heuristics).
- **Icon regeneration:** If the brand colours or monogram change, re-run `node scripts/generate-icons.mjs` and commit the updated PNGs.
- **`sharp` is dev-only:** It is only used by the generation script, not by Next.js at build time. It does not affect bundle size or production.
