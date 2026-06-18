import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingTour } from './OnboardingTour';

describe('OnboardingTour', () => {
  it('steps forward and back through the tour', async () => {
    render(<OnboardingTour onDone={() => {}} />);
    expect(screen.getByText(/Welcome to LifeSync/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Quick Capture/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/Welcome to LifeSync/i)).toBeInTheDocument();
  });

  it('calls onDone only from the final Get started button', async () => {
    const onDone = vi.fn();
    render(<OnboardingTour onDone={onDone} />);
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    await userEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
