/** Join truthy class names. Lightweight stand-in for clsx (no dependency). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}
