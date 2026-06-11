/**
 * Elevation shadows — warm-tinted (not gray) so cards feel like paper
 * resting on a warm surface rather than floating in a cold void.
 */
export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(60, 45, 30, 0.06)',
  sm: '0 1px 3px rgba(60, 45, 30, 0.07), 0 1px 2px rgba(60, 45, 30, 0.05)',
  md: '0 4px 12px rgba(60, 45, 30, 0.08), 0 2px 4px rgba(60, 45, 30, 0.05)',
  lg: '0 12px 28px rgba(60, 45, 30, 0.10), 0 4px 8px rgba(60, 45, 30, 0.06)',
  xl: '0 24px 48px rgba(60, 45, 30, 0.14), 0 8px 16px rgba(60, 45, 30, 0.08)',
  focus: '0 0 0 3px rgba(13, 148, 136, 0.32)',
} as const;

export type Shadows = typeof shadows;
