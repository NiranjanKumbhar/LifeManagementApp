'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, EmptyState, LoadingSpinner, TaskItem } from '@lifesync/ui';
import { formatRelativeDate } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { PROJECT_TYPE_META } from '@/lib/projects/project-meta';
import { PROJECT_FIELD_REGISTRY } from '@/lib/projects/field-registry';
import { ProjectForm } from '@/components/projects/ProjectForm';
import styles from './project-detail.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];
type TaskNode = ProjectDetail['tasks'][number];

function countTasks(nodes: TaskNode[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  const walk = (list: TaskNode[]) => {
    for (const n of list) {
      total += 1;
      if (n.status === 'completed') done += 1;
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return { total, done };
}

function fieldDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);

  const query = trpc.project.get.useQuery({ id }, { enabled: Boolean(id) });

  const refresh = () => void utils.project.get.invalidate({ id });
  const completeTask = trpc.task.complete.useMutation({ onSuccess: refresh });
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      setNewTask('');
      refresh();
    },
  });
  const completeProject = trpc.project.complete.useMutation({ onSuccess: refresh });
  const archiveProject = trpc.project.archive.useMutation({ onSuccess: refresh });

  if (query.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading project" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className={styles.center}>
        <EmptyState
          title="Project not found"
          description="It may have been removed, or you don't have access to it."
        />
      </div>
    );
  }

  const project = query.data;
  const meta = PROJECT_TYPE_META[project.type];
  const { total, done } = countTasks(project.tasks);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fieldDefs = PROJECT_FIELD_REGISTRY[project.type];
  const cf = project.customFields as Record<string, unknown>;

  const addTask = () => {
    const value = newTask.trim();
    if (!value || createTask.isPending) return;
    createTask.mutate({ projectId: project.id, title: value });
  };

  return (
    <div className={styles.page}>
      <Link href="/projects" className={styles.back}>
        ← Projects
      </Link>

      <header className={styles.head}>
        <h1 className={styles.title}>
          <span className={styles.icon} aria-hidden="true">
            {meta.icon}
          </span>
          {project.title}
        </h1>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => archiveProject.mutate({ id: project.id })}>
            Archive
          </Button>
          <Button size="sm" onClick={() => completeProject.mutate({ id: project.id })}>
            Complete
          </Button>
        </div>
      </header>

      <div className={styles.metaRow}>
        <span className={styles.metaPill}>{meta.label}</span>
        {project.dueDate ? (
          <span className={styles.metaPill}>{formatRelativeDate(project.dueDate)}</span>
        ) : null}
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Task completion"
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>

      {fieldDefs.length > 0 ? (
        <section className={styles.details}>
          {fieldDefs.map((def) => (
            <div key={def.key} className={styles.detail}>
              <span className={styles.detailLabel}>{def.label}</span>
              <span className={styles.detailValue}>{fieldDisplay(cf[def.key])}</span>
            </div>
          ))}
        </section>
      ) : null}

      {project.description ? <p className={styles.description}>{project.description}</p> : null}

      <section className={styles.tasks}>
        <h2 className={styles.tasksHead}>
          Tasks
          <span className={styles.tasksCount}>
            {done} of {total}
          </span>
        </h2>

        {project.tasks.map((task) => (
          <div key={task.id}>
            <TaskItem
              task={{
                id: task.id,
                title: task.title,
                status: task.status,
                dueDate: task.dueDate,
                ownerName: null,
              }}
              depth={0}
              onToggleComplete={(taskId) => completeTask.mutate({ id: taskId })}
            />
            {(task.children ?? []).map((child) => (
              <TaskItem
                key={child.id}
                task={{
                  id: child.id,
                  title: child.title,
                  status: child.status,
                  dueDate: child.dueDate,
                  ownerName: null,
                }}
                depth={1}
                onToggleComplete={(taskId) => completeTask.mutate({ id: taskId })}
              />
            ))}
          </div>
        ))}

        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            addTask();
          }}
        >
          <input
            className={styles.addInput}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            aria-label="Add a task"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newTask.trim() || createTask.isPending}>
            Add
          </Button>
        </form>
      </section>

      <ProjectForm
        mode="edit"
        isOpen={editing}
        onClose={() => setEditing(false)}
        project={project}
      />
    </div>
  );
}
