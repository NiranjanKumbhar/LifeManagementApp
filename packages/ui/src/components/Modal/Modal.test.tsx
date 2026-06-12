import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Edit">
        body
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders its title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit project">
        <p>Form here</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByText('Form here')).toBeInTheDocument();
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit">
        body
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the overlay is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit">
        body
      </Modal>,
    );
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });
});
