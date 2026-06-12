import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the control', () => {
    render(<Input label="Title" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('renders error text and marks the control invalid', () => {
    render(<Input label="Title" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a textarea when multiline', () => {
    render(<Input label="Notes" value="" onChange={() => {}} as="textarea" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });
});
