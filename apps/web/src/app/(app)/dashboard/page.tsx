'use client';

import type { ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { EmptyState, LoadingSpinner, PageShell } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { DashboardBlock, type BlockAccent } from '@/components/dashboard/DashboardBlock';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { StockList } from '@/components/dashboard/StockList';
import { DatesList } from '@/components/dashboard/DatesList';
import {
  AlertIcon,
  BasketIcon,
  CalendarIcon,
  CheckCircleIcon,
  GiftIcon,
  HeartHandshakeIcon,
  SunIcon,
} from '@/components/icons';
import styles from './dashboard.module.css';

type DashboardData = inferRouterOutputs<AppRouter>['project']['dashboard'];

interface BlockDef {
  key: string;
  accent: BlockAccent;
  icon: ReactNode;
  title: string;
  count: number;
  content: ReactNode;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function buildBlocks(data: DashboardData): BlockDef[] {
  return [
    {
      key: 'today',
      accent: 'primary',
      icon: <SunIcon />,
      title: 'Needs action today',
      count: data.todayItems.length,
      content: (
        <DeadlineList
          items={data.todayItems}
          emptyTitle="Nothing due today"
          emptyDescription="Enjoy the calm — you're all caught up."
        />
      ),
    },
    {
      key: 'overdue',
      accent: 'overdue',
      icon: <AlertIcon />,
      title: 'At risk & overdue',
      count: data.overdue.length,
      content: (
        <DeadlineList
          items={data.overdue}
          emptyTitle="Nothing overdue"
          emptyDescription="Everything is on track."
        />
      ),
    },
    {
      key: 'upcoming',
      accent: 'soon',
      icon: <CalendarIcon />,
      title: 'Next 7 days',
      count: data.upcoming7Days.length,
      content: (
        <DeadlineList
          items={data.upcoming7Days}
          emptyTitle="A quiet week ahead"
          emptyDescription="Nothing due in the next seven days."
        />
      ),
    },
    {
      key: 'partner',
      accent: 'partner',
      icon: <HeartHandshakeIcon />,
      title: 'Waiting on your partner',
      count: data.waitingOnPartner.length,
      content: (
        <DeadlineList
          items={data.waitingOnPartner}
          ownership="partner"
          emptyTitle="Nothing on their plate"
          emptyDescription="No shared items are waiting on your partner."
        />
      ),
    },
    {
      key: 'stock',
      accent: 'neutral',
      icon: <BasketIcon />,
      title: 'Running low',
      count: data.lowStockItems.length,
      content: <StockList items={data.lowStockItems} />,
    },
    {
      key: 'dates',
      accent: 'completed',
      icon: <GiftIcon />,
      title: 'Upcoming dates',
      count: data.upcomingDates.length,
      content: <DatesList items={data.upcomingDates} />,
    },
    {
      key: 'completed',
      accent: 'completed',
      icon: <CheckCircleIcon />,
      title: 'Recently done',
      count: data.recentlyCompleted.length,
      content: (
        <DeadlineList
          items={data.recentlyCompleted}
          emptyTitle="Nothing finished yet"
          emptyDescription="Completed items from the last week show up here."
        />
      ),
    },
  ];
}

export default function DashboardPage() {
  const { user } = useUser();
  const workspaceId = useWorkspaceId();
  const query = trpc.project.dashboard.useQuery(
    { workspaceId: workspaceId ?? '' },
    { enabled: Boolean(workspaceId) },
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <PageShell>
      <header className={styles.head}>
        <p className={styles.greeting}>
          {greeting()}
          {user?.firstName ? `, ${user.firstName}` : ''}
        </p>
        <h1 className={styles.heading}>Here&rsquo;s what matters today</h1>
        <p className={styles.subhead}>{today}</p>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your dashboard" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your dashboard"
            description={
              workspaceId
                ? 'Make sure the API is running and your account belongs to this workspace.'
                : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {buildBlocks(query.data).map((block, i) => (
            <DashboardBlock
              key={block.key}
              title={block.title}
              icon={block.icon}
              accent={block.accent}
              count={block.count}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {block.content}
            </DashboardBlock>
          ))}
        </div>
      )}
    </PageShell>
  );
}
