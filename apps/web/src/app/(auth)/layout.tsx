import type { ReactNode } from 'react';
import styles from './auth.module.css';

const FEATURES = [
  {
    num: '01',
    title: 'Quick Capture',
    body: 'Grab anything in seconds — straight to Inbox, shopping, or a project.',
  },
  {
    num: '02',
    title: 'Smart Projects',
    body: 'Occasions, travel, compliance — each type knows its own lead time.',
  },
  {
    num: '03',
    title: 'Shared Household',
    body: "One shopping list, one inventory. Always know what's stocked.",
  },
  {
    num: '04',
    title: 'Dates & People',
    body: 'Birthdays, anniversaries, gift ideas — nothing sneaks up on you.',
  },
  {
    num: '05',
    title: 'Private or Shared',
    body: 'Collaborate by default. Lock any item just for yourself.',
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      {/* ── Left: dark editorial hero ─────────────────────────────────── */}
      <aside className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Brand mark */}
          <div className={styles.brand}>
            <span className={styles.brandGem} aria-hidden="true" />
            <span className={styles.brandName}>LifeSync</span>
          </div>

          {/* Display headline */}
          <h1 className={styles.headline}>
            Your shared life,<br />
            <em className={styles.headlineAccent}>calmly handled.</em>
          </h1>

          {/* Pitch — desktop */}
          <p className={styles.pitch}>
            One calm space for two people — tasks, projects, home, and
            all the dates that matter, always in sync.
          </p>

          {/* Numbered feature list — desktop */}
          <ul className={styles.features} role="list">
            {FEATURES.map((f) => (
              <li key={f.num} className={styles.feature}>
                <span className={styles.featureNum} aria-hidden="true">{f.num}</span>
                <div>
                  <strong className={styles.featureTitle}>{f.title}</strong>
                  <p className={styles.featureBody}>{f.body}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Feature chips — mobile only */}
          <div className={styles.chips} aria-hidden="true">
            {FEATURES.map((f) => (
              <span key={f.num} className={styles.chip}>{f.title}</span>
            ))}
          </div>

          <p className={styles.footnote}>Free to start · No credit card needed</p>
        </div>

        {/* Decorative oversized mark */}
        <span className={styles.heroDeco} aria-hidden="true">✦</span>
      </aside>

      {/* ── Right: minimal cream auth panel ───────────────────────────── */}
      <main className={styles.authPanel}>
        <div className={styles.authInner}>
          {/* Mobile brand — shown above Clerk widget on small screens */}
          <div className={styles.mobileBrand}>
            <span className={styles.mobileBrandGem} aria-hidden="true" />
            <span className={styles.mobileBrandName}>LifeSync</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
