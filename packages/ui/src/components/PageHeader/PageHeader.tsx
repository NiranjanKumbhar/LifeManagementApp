import type { ElementType, ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  backHref?: string;
  /**
   * Component used for the back link — defaults to a plain `<a>`. Web callers
   * pass their router's link (e.g. next/link's `Link`) so back navigation stays
   * client-side. Kept framework-agnostic so this package doesn't depend on Next.
   */
  backComponent?: ElementType;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  backComponent,
  actions,
}: PageHeaderProps) {
  const Back: ElementType = backComponent ?? 'a';
  return (
    <header className={styles.header}>
      {backHref ? (
        <Back href={backHref} className={styles.back} aria-label="Back">
          ← Back
        </Back>
      ) : null}
      <div className={styles.row}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
