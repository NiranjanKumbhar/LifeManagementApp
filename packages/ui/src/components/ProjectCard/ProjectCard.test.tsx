import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';

const project = {
  title: "Mum’s 60th",
  dueDate: '2099-01-01',
  ownerName: 'Jordan',
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
});
