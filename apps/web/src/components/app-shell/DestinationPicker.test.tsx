import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DestinationPicker } from './DestinationPicker';

const projects = [
  { id: 'p1', title: 'Japan trip' },
  { id: 'p2', title: "Mum's 60th" },
];

function setup(overrides: Partial<Parameters<typeof DestinationPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const onNewProject = vi.fn();
  render(
    <DestinationPicker
      value={{ kind: 'inbox' }}
      label="Inbox"
      projects={projects}
      onSelect={onSelect}
      onNewProject={onNewProject}
      {...overrides}
    />,
  );
  return { onSelect, onNewProject };
}

describe('DestinationPicker', () => {
  it('shows the current label and opens the menu', async () => {
    setup();
    expect(screen.getByRole('button', { name: /To: Inbox/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    expect(screen.getByRole('menuitem', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Shopping list' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Japan trip' })).toBeInTheDocument();
  });

  it('selecting a project reports the project destination', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Japan trip' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'project', projectId: 'p1' });
  });

  it('selecting Shopping list reports the shopping destination', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Shopping list' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'shopping' });
  });

  it('+ New project triggers onNewProject', async () => {
    const { onNewProject } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: '+ New project…' }));
    expect(onNewProject).toHaveBeenCalled();
  });
});
