import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskItem } from './TaskItem';

const baseTask = {
  id: 't1',
  title: 'Send invitations',
  status: 'pending' as const,
  dueDate: null as string | null,
  ownerName: null as string | null,
};

describe('TaskItem', () => {
  it('renders the task title', () => {
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={() => {}} />);
    expect(screen.getByText('Send invitations')).toBeInTheDocument();
  });

  it('fires onToggleComplete with the id when the checkbox is clicked', async () => {
    const onToggle = vi.fn();
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /send invitations/i }));
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('marks completed tasks as checked', () => {
    render(
      <TaskItem
        task={{ ...baseTask, status: 'completed' }}
        depth={0}
        onToggleComplete={() => {}}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
