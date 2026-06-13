'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, SegmentedControl } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { useStickyDestination } from '@/lib/hooks/useStickyDestination';
import styles from './QuickCapture.module.css';

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

const INBOX_PLACEHOLDER = 'Capture anything — a task, a reminder, an idea…';
const SHOPPING_PLACEHOLDER = 'Add to shopping list…';

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [destination, setDestination] = useStickyDestination();
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

  const add = trpc.household.add.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      setText('');
      setJustAdded(true);
      inputRef.current?.focus();
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

  const isShopping = destination.kind === 'shopping';
  const busy = capture.isPending || add.isPending;
  const isError = isShopping ? add.isError : capture.isError;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !workspaceId || busy) return;
    if (isShopping) {
      add.mutate({ workspaceId, name: value, status: 'on_list' });
    } else {
      capture.mutate({ workspaceId, content: value });
    }
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
        <div className={styles.toggle}>
          <SegmentedControl
            ariaLabel="Capture destination"
            value={destination.kind === 'shopping' ? 'shopping' : 'inbox'}
            onChange={(v) => {
              setDestination(v === 'shopping' ? { kind: 'shopping' } : { kind: 'inbox' });
              setJustAdded(false);
            }}
            options={[
              { value: 'inbox', label: 'Inbox' },
              { value: 'shopping', label: 'Shopping list' },
            ]}
          />
        </div>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (justAdded) setJustAdded(false);
            }}
            placeholder={isShopping ? SHOPPING_PLACEHOLDER : INBOX_PLACEHOLDER}
            aria-label="What's on your mind?"
            autoComplete="off"
          />
          <div className={styles.row}>
            <span className={styles.hint}>
              {isError ? (
                <span className={styles.error}>Couldn&rsquo;t save — try again.</span>
              ) : justAdded && isShopping ? (
                <span className={styles.added}>✓ Added to shopping list</span>
              ) : isShopping ? (
                'Enter to add · Esc to close'
              ) : (
                'Press Enter to save · Esc to close'
              )}
            </span>
            <Button type="submit" size="sm" disabled={!text.trim() || busy}>
              {busy ? 'Saving…' : isShopping ? 'Add to list' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
