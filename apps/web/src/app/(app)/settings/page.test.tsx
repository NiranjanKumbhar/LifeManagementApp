import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';
import { ThemeProvider } from '@/lib/theme';
import { NavPrefsProvider } from '@/lib/nav-prefs';

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

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: {
      me: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'u1', displayName: 'Alex', email: 'alex@example.com', timezone: 'UTC',
            notificationPreferences: { channels: { push: true, email: true, inApp: true }, digestMode: 'none', quietHours: { start: '22:00', end: '07:00' } },
          },
        }),
      },
      updateProfile: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateNotificationPrefs: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    workspace: {
      get: { useQuery: () => ({ data: { id: 'ws-1', name: 'Our Home' } }) },
      members: { useQuery: () => ({ data: [{ role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@b.com', avatarUrl: null } }] }) },
    },
  },
}));

import SettingsPage from './page';

function renderPage() {
  return render(
    <ThemeProvider>
      <NavPrefsProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </NavPrefsProvider>
    </ThemeProvider>,
  );
}

describe('SettingsPage', () => {
  it('renders the settings sections', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bottom bar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Our Home')).toBeInTheDocument();
  });
});
