import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/lib/theme';
import { AppearanceSettings } from './AppearanceSettings';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe('AppearanceSettings', () => {
  it('selects the active mode and switches theme on click', async () => {
    render(
      <ThemeProvider>
        <AppearanceSettings />
      </ThemeProvider>,
    );
    expect(screen.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByRole('tab', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ls-theme')).toBe('dark');
  });
});
