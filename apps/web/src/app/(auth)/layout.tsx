import type { ReactNode } from 'react';
import styles from './auth.module.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.wrap}>
      <div className={styles.panel}>
        <p className={styles.brand}>LifeSync</p>
        <p className={styles.tagline}>Your shared life, calmly handled.</p>
        {children}
      </div>
    </main>
  );
}
