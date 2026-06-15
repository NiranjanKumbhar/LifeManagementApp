'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { Priority } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import styles from './TaskForm.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];
type TaskNode = ProjectDetail['tasks'][number];

export interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode;
  projectId: string;
  workspaceId: string;
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TaskForm({ isOpen, onClose, task, projectId, workspaceId }: TaskFormProps) {
  const toast = useToast();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority ?? 'none');
  const [ownerId, setOwnerId] = useState(task.ownerId ?? '');
  const [remindAt, setRemindAt] = useState('');

  const members = trpc.workspace.members.useQuery({ workspaceId }, { enabled: isOpen });
  const reminders = trpc.reminder.list.useQuery({ includeSent: false }, { enabled: isOpen });
  const taskReminders = (reminders.data ?? []).filter((r) => r.taskId === task.id);

  const refreshReminders = () => void utils.reminder.list.invalidate();

  const update = trpc.task.update.useMutation({
    onSuccess: () => {
      void utils.project.get.invalidate({ id: projectId });
      toast.success('Task updated');
      onClose();
    },
  });
  const createReminder = trpc.reminder.create.useMutation({
    onSuccess: () => {
      setRemindAt('');
      refreshReminders();
    },
  });
  const dismissReminder = trpc.reminder.dismiss.useMutation({ onSuccess: refreshReminders });

  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.displayName })),
  ];

  const save = () => {
    if (!title.trim() || update.isPending) return;
    update.mutate({
      id: task.id,
      title: title.trim(),
      description: description || null,
      dueDate: dueDate || null,
      priority,
      ownerId: ownerId || null,
    });
  };

  const addReminder = () => {
    if (!remindAt || createReminder.isPending) return;
    createReminder.mutate({ taskId: task.id, remindAt: new Date(remindAt).toISOString() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Title" value={title} onChange={setTitle} required />
        <Input as="textarea" label="Description" value={description} onChange={setDescription} />
        <Input type="date" label="Due date" value={dueDate} onChange={setDueDate} />
        <Input
          as="select"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={PRIORITIES}
        />
        <Input as="select" label="Owner" value={ownerId} onChange={setOwnerId} options={ownerOptions} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Reminders</legend>
          <p className={styles.hint}>These are your personal reminders for this task.</p>
          {taskReminders.length > 0 ? (
            <ul className={styles.reminderList}>
              {taskReminders.map((r) => (
                <li key={r.id} className={styles.reminderRow}>
                  <span>{new Date(r.remindAt).toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove reminder"
                    onClick={() => dismissReminder.mutate({ id: r.id })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>No reminders yet.</p>
          )}
          <div className={styles.addReminder}>
            <Input type="datetime-local" label="Remind me at" value={remindAt} onChange={setRemindAt} />
            <Button variant="secondary" size="sm" onClick={addReminder} disabled={!remindAt || createReminder.isPending}>
              Add reminder
            </Button>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
