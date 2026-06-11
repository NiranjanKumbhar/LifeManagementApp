/** Motion tokens. All consuming animations must respect prefers-reduced-motion. */
export const animations = {
  duration: {
    micro: '150ms',
    standard: '250ms',
    emphasis: '400ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    entrance: 'cubic-bezier(0.16, 1, 0.3, 1)', // soft overshoot for reveals
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export type Animations = typeof animations;
