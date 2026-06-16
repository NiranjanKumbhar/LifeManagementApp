'use client';

import { useState, type ReactNode } from 'react';
import { Button, Modal } from '@lifesync/ui';
import {
  CalendarIcon,
  HomeIcon,
  HouseholdIcon,
  PlusIcon,
  ProjectsIcon,
  LockIcon,
} from '@/components/icons';
import styles from './OnboardingTour.module.css';

interface Step {
  icon: ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <HomeIcon />,
    title: 'Welcome to LifeSync',
    body: 'A calm, shared place for the two of you to stay on top of life together.',
  },
  {
    icon: <PlusIcon />,
    title: 'Quick Capture',
    body: 'The + button grabs anything fast — straight to your Inbox, the shopping list, or a project.',
  },
  {
    icon: <ProjectsIcon />,
    title: 'Projects',
    body: 'Structured plans with deadline awareness — occasions, travel, compliance, health and more.',
  },
  {
    icon: <HouseholdIcon />,
    title: 'Household',
    body: 'Your shared shopping list and home inventory, always in sync.',
  },
  {
    icon: <CalendarIcon />,
    title: 'Calendar & People',
    body: 'Due dates, birthdays and anniversaries, and gift ideas — all in one place.',
  },
  {
    icon: <LockIcon />,
    title: 'Shared or private',
    body: 'Invite your partner to collaborate, and keep any item to yourself with the lock.',
  },
];

export interface OnboardingTourProps {
  onDone: () => void;
}

export function OnboardingTour({ onDone }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      isOpen
      onClose={onDone}
      title={current.title}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Skip
          </Button>
          <div className={styles.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i === step ? styles.dotActive : styles.dot} />
            ))}
          </div>
          <div className={styles.nav}>
            {!isFirst ? (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {isLast ? (
              <Button size="sm" onClick={onDone}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          {current.icon}
        </span>
        <p className={styles.text}>{current.body}</p>
      </div>
    </Modal>
  );
}
