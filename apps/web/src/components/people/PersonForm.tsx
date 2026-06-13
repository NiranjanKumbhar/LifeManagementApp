'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import styles from './PersonForm.module.css';

type PersonDetail = inferRouterOutputs<AppRouter>['person']['get'];

export interface PersonFormProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  person?: PersonDetail;
}

export function PersonForm({ mode, isOpen, onClose, person }: PersonFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [birthday, setBirthday] = useState(person?.birthday ?? '');
  const [anniversary, setAnniversary] = useState(person?.anniversary ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');

  const onDone = () => {
    if (workspaceId) void utils.person.list.invalidate({ workspaceId });
    if (person) void utils.person.get.invalidate({ id: person.id });
    toast.success(mode === 'create' ? 'Person added' : 'Person updated');
    onClose();
  };

  const create = trpc.person.create.useMutation({ onSuccess: onDone });
  const update = trpc.person.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim() || busy) return;
    if (mode === 'create') {
      if (!workspaceId) return;
      create.mutate({
        workspaceId,
        name: name.trim(),
        relationship: relationship.trim() || undefined,
        birthday: birthday || undefined,
        anniversary: anniversary || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } else if (person) {
      update.mutate({
        id: person.id,
        name: name.trim(),
        relationship: relationship.trim() || null,
        birthday: birthday || null,
        anniversary: anniversary || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New person' : 'Edit person'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Name" value={name} onChange={setName} required />
        <Input label="Relationship" value={relationship} onChange={setRelationship} placeholder="e.g. Mother, Plumber" />
        <Input type="date" label="Birthday" value={birthday} onChange={setBirthday} />
        <Input type="date" label="Anniversary" value={anniversary} onChange={setAnniversary} />
        <Input label="Email" value={email} onChange={setEmail} />
        <Input label="Phone" value={phone} onChange={setPhone} />
        <Input as="textarea" label="Notes" value={notes} onChange={setNotes} />
      </div>
    </Modal>
  );
}
