'use client';

import { useState } from 'react';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';

export interface ReminderQuickAddProps {
  isOpen: boolean;
  day: string; // YYYY-MM-DD
  onClose: () => void;
}

export function ReminderQuickAdd({ isOpen, day, onClose }: ReminderQuickAddProps) {
  const [message, setMessage] = useState('');
  const toast = useToast();
  const utils = trpc.useUtils();

  const create = trpc.reminder.create.useMutation({
    onSuccess: () => {
      void utils.calendar.list.invalidate();
      toast.success('Reminder added');
      setMessage('');
      onClose();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submit = () => {
    if (!message.trim() || create.isPending) return;
    // Noon avoids any local/UTC day-shift when the row maps back to a calendar day.
    create.mutate({ remindAt: `${day}T12:00:00.000Z`, message: message.trim(), type: 'standard' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a reminder"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!message.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Add'}
          </Button>
        </>
      }
    >
      <Input label={`Reminder for ${day}`} value={message} onChange={setMessage} required />
    </Modal>
  );
}
