/**
 * LifeSync color system — warm, calm, trustworthy.
 * The CSS custom properties in apps/web/src/styles/variables.css mirror these.
 */
export const colors = {
  // Primary — calm teal
  primary: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },

  // Urgency — informative, never alarming
  urgency: {
    overdue: '#F97066', // warm coral
    overdueSoft: '#FEF0EE',
    soon: '#F59E0B', // soft amber
    soonSoft: '#FEF6E7',
    onTrack: '#0D9488', // calm teal
    onTrackSoft: '#ECFDF8',
    completed: '#22C55E', // gentle green
    completedSoft: '#EEFBF1',
  },

  // Surfaces — warm grays, never cold
  surface: {
    background: '#F5F3F0',
    card: '#FCFBF9',
    elevated: '#FFFFFF',
    sunken: '#EFEDE8',
    border: '#E8E5E0',
    borderStrong: '#D9D5CE',
    overlay: 'rgba(28, 25, 23, 0.32)',
  },

  // Text — warm dark, softer than pure black
  text: {
    primary: '#1C1917',
    secondary: '#57534E',
    tertiary: '#8A857E',
    inverse: '#FAFAF9',
  },

  // Partner indicators
  partner: {
    self: '#0D9488', // teal — you
    partner: '#8B5CF6', // gentle violet — your partner
    shared: '#B68A2E', // warm gold — shared
  },
} as const;

export type Colors = typeof colors;
