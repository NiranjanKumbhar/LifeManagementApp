import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('returns correct name and short_name', () => {
    const result = manifest();
    expect(result.name).toBe('LifeSync');
    expect(result.short_name).toBe('LifeSync');
  });

  it('opens in standalone display mode', () => {
    expect(manifest().display).toBe('standalone');
  });

  it('starts at /dashboard', () => {
    expect(manifest().start_url).toBe('/dashboard');
  });

  it('uses LifeSync brand colors', () => {
    const result = manifest();
    expect(result.theme_color).toBe('#2a9d8f');
    expect(result.background_color).toBe('#f9f6f2');
  });

  it('includes three icons (192, 512, 512-maskable)', () => {
    const icons = manifest().icons ?? [];
    expect(icons).toHaveLength(3);
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(icons[2]!.purpose).toBe('maskable');
  });
});
