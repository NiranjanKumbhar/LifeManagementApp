'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import { Button } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { useStickyDestination } from '@/lib/hooks/useStickyDestination';
import { DestinationPicker } from './DestinationPicker';
import { QuickProjectPanel } from './QuickProjectPanel';
import styles from './QuickCapture.module.css';

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

type Feedback = { tone: 'success' | 'error'; msg: string };

const INBOX_PLACEHOLDER = 'Capture anything — a task, a reminder, an idea…';
const SHOPPING_PLACEHOLDER = 'Add to shopping list…';
const PROJECT_PLACEHOLDER = 'Add a task…';

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mode, setMode] = useState<'capture' | 'new-project'>('capture');
  const [destination, setDestination] = useStickyDestination();
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ ok: string; err: string }>({ ok: '', err: '' });
  const workspaceId = useWorkspaceId();
  const utils = trpc.useUtils();

  const projectsQuery = trpc.project.list.useQuery(
    { workspaceId: workspaceId ?? '', status: 'active' as const },
    { enabled: open && Boolean(workspaceId) },
  );
  const projects = useMemo(
    () => (projectsQuery.data ?? []).map((p) => ({ id: p.id, title: p.title })),
    [projectsQuery.data],
  );

  // A remembered project that's no longer active falls back to Inbox.
  useEffect(() => {
    if (
      destination.kind === 'project' &&
      projectsQuery.data &&
      !projectsQuery.data.some((p) => p.id === destination.projectId)
    ) {
      setDestination({ kind: 'inbox' });
    }
  }, [destination, projectsQuery.data, setDestination]);

  const clearFeedback = () => setFeedback(null);

  const capture = trpc.inbox.capture.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.inbox.list.invalidate({ workspaceId });
      setText('');
      onClose();
    },
    onError: () => setFeedback({ tone: 'error', msg: "Couldn't save — try again." }),
  });

  const addItem = trpc.household.add.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      setText('');
      setFeedback({ tone: 'success', msg: '✓ Added to shopping list' });
      inputRef.current?.focus();
    },
    onError: () => setFeedback({ tone: 'error', msg: "Couldn't save — try again." }),
  });

  const createTask = trpc.task.create.useMutation({
    onSuccess: (_data, variables: { projectId: string }) => {
      if (workspaceId) void utils.project.list.invalidate({ workspaceId });
      void utils.project.get.invalidate({ id: variables.projectId });
      setText('');
      setFeedback({ tone: 'success', msg: pending.current.ok });
      inputRef.current?.focus();
    },
    onError: () => setFeedback({ tone: 'error', msg: pending.current.err }),
  });

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project: { id: string; title: string }) => {
      if (workspaceId) void utils.project.list.invalidate({ workspaceId });
      setDestination({ kind: 'project', projectId: project.id });
      setMode('capture');
      const firstTask = text.trim();
      if (firstTask) {
        pending.current = {
          ok: `✓ Created ${project.title}`,
          err: `Created ${project.title}, but the task didn't save — try again.`,
        };
        createTask.mutate({ projectId: project.id, title: firstTask });
      } else {
        setText('');
        setFeedback({ tone: 'success', msg: `✓ Created ${project.title}` });
        inputRef.current?.focus();
      }
    },
    onError: () => setFeedback({ tone: 'error', msg: "Couldn't create the project — try again." }),
  });

  useEffect(() => {
    if (open && mode === 'capture') inputRef.current?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const label =
    destination.kind === 'inbox'
      ? 'Inbox'
      : destination.kind === 'shopping'
        ? 'Shopping list'
        : (projects.find((p) => p.id === destination.projectId)?.title ?? 'Inbox');

  const busy =
    capture.isPending || addItem.isPending || createTask.isPending || createProject.isPending;

  const placeholder =
    destination.kind === 'shopping'
      ? SHOPPING_PLACEHOLDER
      : destination.kind === 'project'
        ? PROJECT_PLACEHOLDER
        : INBOX_PLACEHOLDER;

  const submitLabel = busy
    ? 'Saving…'
    : destination.kind === 'shopping'
      ? 'Add to list'
      : destination.kind === 'project'
        ? 'Add task'
        : 'Add';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !workspaceId || busy) return;
    if (destination.kind === 'shopping') {
      addItem.mutate({ workspaceId, name: value, status: 'on_list' });
    } else if (destination.kind === 'project') {
      pending.current = { ok: `✓ Added to ${label}`, err: "Couldn't save — try again." };
      createTask.mutate({ projectId: destination.projectId, title: value });
    } else {
      capture.mutate({ workspaceId, content: value });
    }
  };

  const createNewProject = (name: string, type: ProjectType) => {
    if (!workspaceId || busy) return;
    createProject.mutate({ workspaceId, type, title: name });
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {mode === 'new-project' ? (
          <QuickProjectPanel
            capturedText={text.trim()}
            busy={busy}
            onCreate={createNewProject}
            onCancel={() => {
              setMode('capture');
              clearFeedback();
              inputRef.current?.focus();
            }}
          />
        ) : (
          <>
            <div className={styles.picker}>
              <DestinationPicker
                value={destination}
                label={label}
                projects={projects}
                onSelect={(dest) => {
                  setDestination(dest);
                  clearFeedback();
                }}
                onNewProject={() => {
                  setMode('new-project');
                  clearFeedback();
                }}
              />
            </div>
            <form onSubmit={submit}>
              <input
                ref={inputRef}
                className={styles.input}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  clearFeedback();
                }}
                placeholder={placeholder}
                aria-label="What's on your mind?"
                autoComplete="off"
              />
              <div className={styles.row}>
                <span className={styles.hint}>
                  {feedback ? (
                    <span className={feedback.tone === 'error' ? styles.error : styles.added}>
                      {feedback.msg}
                    </span>
                  ) : destination.kind === 'inbox' ? (
                    'Press Enter to save · Esc to close'
                  ) : (
                    'Enter to add · Esc to close'
                  )}
                </span>
                <Button type="submit" size="sm" disabled={!text.trim() || busy}>
                  {submitLabel}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
