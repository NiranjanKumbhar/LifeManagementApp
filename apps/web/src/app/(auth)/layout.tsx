import type { ReactNode } from 'react';
import styles from './auth.module.css';

const FEATURES = [
  {
    emoji: '⚡',
    title: 'Quick Capture',
    body: 'Grab anything in seconds — drop it into your Inbox, the shopping list, or straight into a project.',
  },
  {
    emoji: '📋',
    title: 'Deadline-aware Projects',
    body: 'Occasions, travel, compliance, health — each project type knows how much lead time it needs.',
  },
  {
    emoji: '🏠',
    title: 'Shared Household',
    body: 'One shopping list, one inventory. Both of you always know what's stocked and what to grab.',
  },
  {
    emoji: '📅',
    title: 'Calendar & People',
    body: 'Birthdays, anniversaries, and gift ideas — so the dates that matter never sneak up on you.',
  },
  {
    emoji: '🔒',
    title: 'Private or Shared',
    body: 'Collaborate openly by default, or lock any item to keep it just for yourself.',
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      {/* ── Left panel: branding + features ──────────────────────────── */}
      <aside className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">✦</span>
            LifeSync
          </div>
          <p className={styles.tagline}>Your shared life, calmly handled.</p>
          <p className={styles.pitch}>
            A single calm space where couples stay on top of tasks, projects,
            home, and the moments that matter — together.
          </p>

          <ul className={styles.features} role="list">
            {FEATURES.map((f) => (
              <li key={f.title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">{f.emoji}</span>
                <div>
                  <strong className={styles.featureTitle}>{f.title}</strong>
                  <p className={styles.featureBody}>{f.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.footnote}>Free to start · No credit card needed</p>
        </div>

        {/* Decorative blobs */}
        <div className={styles.blob1} aria-hidden="true" />
        <div className={styles.blob2} aria-hidden="true" />
      </aside>

      {/* ── Right panel: Clerk auth widget ───────────────────────────── */}
      <main className={styles.authPanel}>
        <div className={styles.authInner}>
          {/* Mobile-only brand shown above widget */}
          <div className={styles.mobileBrand} aria-hidden="true">
            <span className={styles.brandMark}>✦</span>
            LifeSync
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
