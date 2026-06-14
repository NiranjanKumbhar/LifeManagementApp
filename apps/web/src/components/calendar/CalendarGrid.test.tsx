import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CalendarItem } from '@lifesync/shared-types';
import { CalendarGrid } from './CalendarGrid';

const item: CalendarItem = {
  id: 'p1', date: '2026-06-18', kind: 'project_due', title: 'Passport', projectId: 'p1', personId: null,
};
const itemsByDay = new Map<string, CalendarItem[]>([['2026-06-18', [item]]]);

describe('CalendarGrid', () => {
  it('renders the month days and marks days that have items', () => {
    render(
      <CalendarGrid
        month={{ year: 2026, month: 6 }}
        itemsByDay={itemsByDay}
        selectedDay="2026-06-18"
        today="2026-06-14"
        onSelectDay={() => {}}
      />,
    );
    // The marked day announces its item count; an unmarked day does not.
    expect(screen.getByRole('button', { name: /18 June.*1 item/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '19 June' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('calls onSelectDay when a day is clicked', async () => {
    const onSelectDay = vi.fn();
    render(
      <CalendarGrid
        month={{ year: 2026, month: 6 }}
        itemsByDay={itemsByDay}
        selectedDay="2026-06-18"
        today="2026-06-14"
        onSelectDay={onSelectDay}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^9 June/i }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-06-09');
  });
});
