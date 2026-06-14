import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CalendarItem } from '@lifesync/shared-types';
import { DayAgenda } from './DayAgenda';

const items: CalendarItem[] = [
  { id: 'm:birthday', date: '2026-06-18', kind: 'birthday', title: 'Mum', projectId: null, personId: 'm' },
  { id: 'p1', date: '2026-06-18', kind: 'project_due', title: 'Passport', projectId: 'p1', personId: null },
];

describe('DayAgenda', () => {
  it('lists the day items and links them to their source', () => {
    render(<DayAgenda day="2026-06-18" items={items} onAddReminder={() => {}} />);
    expect(screen.getByText('Mum')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mum/ })).toHaveAttribute('href', '/people/m');
    expect(screen.getByRole('link', { name: /Passport/ })).toHaveAttribute('href', '/projects/p1');
  });

  it('shows an empty message and an add-reminder button', async () => {
    const onAddReminder = vi.fn();
    render(<DayAgenda day="2026-06-18" items={[]} onAddReminder={onAddReminder} />);
    expect(screen.getByText(/Nothing on this day/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reminder/i }));
    expect(onAddReminder).toHaveBeenCalled();
  });
});
