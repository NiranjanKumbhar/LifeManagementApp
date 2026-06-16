import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxItemRow } from './InboxItemRow';

const item = {
  id: 'i1',
  content: 'Order cake',
  createdAt: new Date(),
  capturedByUser: { id: 'u1', displayName: 'Jordan Lee', avatarUrl: null },
};
const projects = [{ id: 'p1', title: 'Anniversary' }];

describe('InboxItemRow', () => {
  it('renders the captured content', () => {
    render(
      <InboxItemRow item={item} projects={projects} onAssign={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Order cake')).toBeInTheDocument();
  });

  it('renders who captured the item', () => {
    render(
      <InboxItemRow item={item} projects={projects} onAssign={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('assigns to the chosen project', async () => {
    const onAssign = vi.fn();
    render(
      <InboxItemRow item={item} projects={projects} onAssign={onAssign} onDismiss={() => {}} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Move to project'), 'p1');
    expect(onAssign).toHaveBeenCalledWith('p1');
  });

  it('dismisses the item', async () => {
    const onDismiss = vi.fn();
    render(
      <InboxItemRow item={item} projects={projects} onAssign={() => {}} onDismiss={onDismiss} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
