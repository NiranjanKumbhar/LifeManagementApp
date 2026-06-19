# PWA Manifest — Design Spec

**Date:** 2026-06-19
**Scope:** Passive PWA manifest so mobile users get a browser-native "Add to Home Screen" prompt when visiting LifeSync on their phone.

---

## Goal

When a user visits `lifesync-mu.vercel.app` on a mobile browser (Chrome Android, Safari iOS), they see the browser's native install/add-to-home-screen prompt. Tapping it installs a standalone app icon that opens LifeSync without any browser UI.

No custom in-app install banner. No service worker or offline support. Purely the metadata layer.

---

## Approach

Use Next.js 15 App Router's first-class manifest support (`app/manifest.ts`). This generates `/manifest.webmanifest` automatically with no extra packages or build configuration. iOS-specific metadata is added via the `metadata` export in `layout.tsx` since Safari ignores the standard manifest for several fields.

---

## Files

### 1. `apps/web/src/app/manifest.ts`

Exports a `MetadataRoute.Manifest` object:

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

### 2. `apps/web/public/icons/` — three PNG files

Generated from an inline Node script (`scripts/generate-icons.mjs`) that uses the Canvas API (via `@napi-rs/canvas`, already a common dep) or falls back to writing SVGs directly. Since Next.js serves `public/` as-is, files placed here are served at `/icons/icon-192.png` etc.

**Icon design:** "LS" monogram in Inter SemiBold, white text, on a `#2a9d8f` (teal) circular/square background matching LifeSync's palette.

- `icon-192.png` — 192×192, standard icon
- `icon-512.png` — 512×512, standard icon (used for splash screens)
- `icon-512-maskable.png` — 512×512 with 20% safe-zone padding on all sides (Android adaptive icons crop to a circle/squircle; the inner 60% must contain all meaningful content)

**Generation:** A one-time script `scripts/generate-icons.mjs` produces the PNGs and they are committed to the repo. No build-time generation needed.

### 3. `apps/web/src/app/layout.tsx` — iOS metadata additions

Add to the existing `metadata` export:

```ts
export const metadata: Metadata = {
  title: 'LifeSync — your shared life, handled',
  description: '...',
  // PWA / iOS additions
  themeColor: '#2a9d8f',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LifeSync',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};
```

`appleWebApp.capable: true` tells Safari this is installable. `statusBarStyle: 'default'` shows the iOS status bar in its normal style (not overlaid or hidden).

---

## Icon Generation Script

`scripts/generate-icons.mjs` — a standalone Node script that:
1. Creates three SVG strings (192, 512, 512-maskable) with the LS monogram
2. Converts them to PNG using the `sharp` package (already in the ecosystem or added as a dev dep)
3. Writes to `apps/web/public/icons/`

Run once: `node scripts/generate-icons.mjs`. Output is committed to the repo so no build step is needed.

If `sharp` is unavailable, the script writes the SVGs directly and the manifest references `.svg` files — browsers and Android support SVG icons; iOS does not (falls back gracefully to the `apple-touch-icon` PNG).

---

## Browser Behaviour

| Platform | Manifest read? | Install prompt | Standalone launch |
|---|---|---|---|
| Chrome Android | Yes | Auto after 2+ visits / engagement heuristic | Yes — no address bar |
| Samsung Internet | Yes | Auto | Yes |
| Safari iOS 16.4+ | Partial | User taps Share → "Add to Home Screen" | Yes — `appleWebApp` metadata used |
| Safari iOS < 16.4 | No manifest | User taps Share → "Add to Home Screen" | Yes — via `apple-mobile-web-app-capable` |
| Desktop Chrome | Yes | Address bar install icon | Opens in app window |

iOS does not show an automatic install banner — the user must tap the Share sheet manually. This is an Apple platform constraint, not a limitation of this implementation.

---

## What's Not In Scope

- Service worker / offline caching
- Custom in-app install prompt or banner
- Push notifications
- Background sync
- Splash screen customisation beyond `background_color`

---

## Success Criteria

1. Visiting the site on Chrome Android shows a browser-native "Add to Home Screen" banner after a brief engagement period.
2. Installing and launching from the home screen opens with no browser UI (standalone mode, teal status bar).
3. On iOS, tapping Share → Add to Home Screen produces an icon with the LS monogram and opens in standalone mode.
4. `pnpm build` succeeds with no errors or warnings related to the manifest.
5. Lighthouse PWA audit scores "Installable" (no service worker required for this check on modern Lighthouse).
