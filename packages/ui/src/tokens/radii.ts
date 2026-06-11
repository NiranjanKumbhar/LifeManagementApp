/** Border radii — soft and tactile. */
export const radii = {
  none: '0',
  sm: '0.375rem', // 6
  md: '0.625rem', // 10
  lg: '0.875rem', // 14
  xl: '1.25rem', // 20
  '2xl': '1.75rem', // 28
  full: '9999px',
} as const;

export type Radii = typeof radii;
