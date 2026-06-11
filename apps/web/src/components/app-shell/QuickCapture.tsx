'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import styles from './QuickCapture.module.css';

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceId = useWorkspaceId();
  const utils = trpc.useUtils();

  const capture = trpc.inbox.capture.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.inbox.list.invalidate({ workspaceId });
      setText('');
      onClose();
    },
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !workspaceId || capture.isPending) return;
    capture.mutate({ workspaceId, content: value });
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
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Capture anything — a task, a reminder, an idea…"
            aria-label="What's on your mind?"
            autoComplete="off"
          />
          <div className={styles.row}>
            <span className={styles.hint}>
              {capture.isError ? (
                <span className={styles.error}>Couldn&rsquo;t save — try again.</span>
              ) : (
                'Press Enter to save · Esc to close'
              )}
            </span>
            <Button type="submit" size="sm" disabled={!text.trim() || capture.isPending}>
              {capture.isPending ? 'Saving…' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
