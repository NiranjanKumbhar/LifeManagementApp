'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, EmptyState, LoadingSpinner, ProjectCard } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import { PlusIcon } from '@/components/icons';
import { ProjectForm } from '@/components/projects/ProjectForm';
import styles from './projects.module.css';

type ProjectListItem = inferRouterOutputs<AppRouter>['project']['list'][number];

export default function ProjectsPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const query = trpc.project.list.useQuery(
    { workspaceId: workspaceId ?? '', ...(showActiveOnly ? { status: 'active' as const } : {}) },
    { enabled },
  );

  const grouped = (items: ProjectListItem[]) =>
    PROJECT_TYPE_ORDER.map((type) => ({
      type,
      meta: PROJECT_TYPE_META[type],
      projects: items.filter((p) => p.type === type),
    })).filter((g) => g.projects.length > 0);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.heading}>Projects</h1>
          <p className={styles.subhead}>Everything you&rsquo;re working on, by type.</p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.filter}
            onClick={() => setShowActiveOnly((v) => !v)}
            type="button"
          >
            {showActiveOnly ? 'Active' : 'All'}
          </button>
          <Button size="sm" leadingIcon={<PlusIcon size={16} />} onClick={() => setShowForm(true)}>
            New project
          </Button>
        </div>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your projects" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your projects"
            description={
              workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : query.data.length === 0 ? (
        <div className={styles.center}>
          <EmptyState
            title="No projects yet"
            description="Start one with the New project button."
          />
        </div>
      ) : (
        <div className={styles.groups}>
          {grouped(query.data).map((group) => (
            <section key={group.type} className={styles.group}>
              <h2 className={styles.groupHead}>
                <span className={styles.groupIcon} aria-hidden="true">
                  {group.meta.icon}
                </span>
                {group.meta.label}
                <span className={styles.groupCount}>{group.projects.length}</span>
              </h2>
              <div className={styles.grid}>
                {group.projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    href={`/projects/${p.id}`}
                    icon={group.meta.icon}
                    project={{
                      title: p.title,
                      dueDate: p.dueDate,
                      ownerName: null,
                      taskCount: p.taskCount,
                      completedCount: p.completedCount,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ProjectForm mode="create" isOpen={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
