'use client';

import { useState, type ReactNode } from 'react';
import { PlusIcon } from '../icons';
import { trpc } from '@/lib/trpc';
import { useWorkspace } from '@/lib/workspace-context';
import { NavigationSidebar } from './NavigationSidebar';
import { BottomNav } from './BottomNav';
import { QuickCapture } from './QuickCapture';
import { NoWorkspace } from './NoWorkspace';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => void utils.user.me.invalidate(),
  });

  const showTour = !tourDismissed && Boolean(me.data) && me.data?.onboardedAt == null;
  const finishTour = () => {
    setTourDismissed(true);
    completeOnboarding.mutate();
  };

  // The user belongs to no workspace (e.g. left their last one) — offer recovery
  // instead of empty, broken screens.
  if (!workspacesLoading && workspaces.length === 0) {
    return <NoWorkspace />;
  }

  return (
    <div className={styles.shell}>
      <NavigationSidebar />

      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
      </div>

      <button
        type="button"
        className={styles.fab}
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture"
      >
        <PlusIcon size={24} />
      </button>

      <BottomNav onQuickCapture={() => setCaptureOpen(true)} />

      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />

      {showTour ? <OnboardingTour onDone={finishTour} /> : null}
    </div>
  );
}
