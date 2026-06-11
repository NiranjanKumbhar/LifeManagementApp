/**
 * Typography tokens. Display uses a warm humanist serif (Fraunces);
 * body/UI uses Inter. Font families are wired via next/font in the web app
 * and exposed as CSS variables (--ls-font-display, --ls-font-body).
 */
export const typography = {
  fontFamily: {
    display: 'var(--ls-font-display)',
    body: 'var(--ls-font-body)',
  },
  fontSize: {
    xs: '0.75rem', // 12
    sm: '0.875rem', // 14
    base: '1rem', // 16
    lg: '1.125rem', // 18
    xl: '1.25rem', // 20
    '2xl': '1.5rem', // 24
    '3xl': '1.875rem', // 30
    '4xl': '2.25rem', // 36
    '5xl': '3rem', // 48
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    heading: 1.2,
    body: 1.5,
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.04em',
  },
} as const;

export type Typography = typeof typography;
