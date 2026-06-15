import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Inter } from 'next/font/google';
import { Providers } from '@/lib/providers';
import '@/styles/globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ls-font-display',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ls-font-body',
});

export const metadata: Metadata = {
  title: 'LifeSync — your shared life, handled',
  description: 'A calm, shared place for the two of you to stay on top of life together.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        {/* No-flash: apply the saved theme before first paint. Keep in sync with resolve() in lib/theme.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('ls-theme');var d=m==='dark'||((m===null||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
