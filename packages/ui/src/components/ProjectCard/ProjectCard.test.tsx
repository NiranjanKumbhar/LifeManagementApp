import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';

const createdByUser = { id: 'u1', displayName: 'Jordan Lee', avatarUrl: null };

const project = {
  title: "Mum's 60th",
  dueDate: '2099-01-01',
  createdByUser,
  taskCount: 4,
  completedCount: 1,
};

describe('ProjectCard', () => {
  it('renders the title and a link to the project', () => {
    render(<ProjectCard project={project} href="/projects/p1" />);
    const link = screen.getByRole('link', { name: /Mum/ });
    expect(link).toHaveAttribute('href', '/projects/p1');
  });

  it('shows progress when there are tasks', () => {
    render(<ProjectCard project={project} href="/projects/p1" />);
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('shows "No tasks" when the project has none', () => {
    render(
      <ProjectCard project={{ ...project, taskCount: 0, completedCount: 0 }} href="/projects/p1" />,
    );
    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });

  it('shows the creator name via UserChip', () => {
    render(<ProjectCard project={project} href="/projects/p1" />);
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('renders without a creator when createdByUser is null', () => {
    render(
      <ProjectCard project={{ ...project, createdByUser: null }} href="/projects/p1" />,
    );
    // UserChip with null user renders an em-dash fallback
    expect(screen.getByText('Added by —')).toBeInTheDocument();
  });

  it('shows a lock when the project is private', () => {
    render(<ProjectCard project={{ ...project, visibility: 'private' }} href="/projects/p1" />);
    expect(screen.getByRole('img', { name: 'Private' })).toBeInTheDocument();
  });

  it('shows no lock when the project is shared', () => {
    render(<ProjectCard project={{ ...project, visibility: 'shared' }} href="/projects/p1" />);
    expect(screen.queryByRole('img', { name: 'Private' })).not.toBeInTheDocument();
  });
});
