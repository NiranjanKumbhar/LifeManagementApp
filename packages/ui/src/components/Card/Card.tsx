import { forwardRef, type ElementType, type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'low' | 'medium';
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 'low', interactive = false, as = 'div', className, children, ...rest },
  ref,
) {
  // Cast to ElementType so the polymorphic tag accepts the forwarded ref
  // without TS intersecting the (incompatible) per-element ref types.
  const Component = as as ElementType;
  return (
    <Component
      ref={ref}
      className={cn(styles.card, styles[elevation], interactive && styles.interactive, className)}
      {...rest}
    >
      {children}
    </Component>
  );
});
