import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickProjectPanel } from './QuickProjectPanel';

describe('QuickProjectPanel', () => {
  it('shows the captured text as the first task', () => {
    render(
      <QuickProjectPanel capturedText="call the caterer" busy={false} onCreate={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/call the caterer/)).toBeInTheDocument();
  });

  it('creates with the entered name and type', async () => {
    const onCreate = vi.fn();
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={onCreate} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/Name/), "Mum's 60th");
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'occasion');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith("Mum's 60th", 'occasion');
  });

  it('disables Create until a name is entered', () => {
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
