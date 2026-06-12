'use client';

import { useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { Priority, ProjectType, Visibility } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import { PROJECT_FIELD_REGISTRY, type ProjectFieldDef } from '@/lib/projects/field-registry';
import styles from './ProjectForm.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];

export interface ProjectFormProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectDetail;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const VISIBILITIES = [
  { value: 'shared', label: 'Shared' },
  { value: 'mine_visible', label: 'Visible to partner' },
  { value: 'private', label: 'Private' },
];

function customToString(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null) return '';
  return String(value);
}

function serializeCustom(
  defs: ProjectFieldDef[],
  raw: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of defs) {
    const v = raw[def.key];
    if (v == null || v === '') continue;
    if (def.kind === 'string-list') out[def.key] = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (def.kind === 'number') out[def.key] = Number(v);
    else if (def.kind === 'boolean') out[def.key] = v === 'true';
    else out[def.key] = v;
  }
  return out;
}

export function ProjectForm({ mode, isOpen, onClose, project }: ProjectFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [type, setType] = useState<ProjectType>(project?.type ?? 'general');
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [dueDate, setDueDate] = useState(project?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(project?.priority ?? 'medium');
  const [visibility, setVisibility] = useState<Visibility>(project?.visibility ?? 'shared');
  const [templateId, setTemplateId] = useState('');
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (project) {
      for (const def of PROJECT_FIELD_REGISTRY[project.type]) {
        init[def.key] = customToString((project.customFields as Record<string, unknown>)[def.key]);
      }
    }
    return init;
  });

  const templates = trpc.template.list.useQuery(
    { workspaceId: workspaceId ?? '', type },
    { enabled: mode === 'create' && Boolean(workspaceId) },
  );

  const fieldDefs = PROJECT_FIELD_REGISTRY[type];

  const onDone = () => {
    if (workspaceId) void utils.project.list.invalidate({ workspaceId });
    if (project) void utils.project.get.invalidate({ id: project.id });
    toast.success(mode === 'create' ? 'Project created' : 'Project updated');
    onClose();
  };

  const create = trpc.project.create.useMutation({ onSuccess: onDone });
  const update = trpc.project.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!title.trim() || busy) return;
    const customFields = serializeCustom(fieldDefs, custom);
    if (mode === 'create') {
      if (!workspaceId) return;
      create.mutate({
        workspaceId,
        type,
        title: title.trim(),
        description: description || undefined,
        dueDate: dueDate || undefined,
        priority,
        visibility,
        templateId: templateId || undefined,
        customFields,
      });
    } else if (project) {
      update.mutate({
        id: project.id,
        title: title.trim(),
        description: description || null,
        dueDate: dueDate || null,
        priority,
        visibility,
        customFields,
      });
    }
  };

  const typeOptions = useMemo(
    () => PROJECT_TYPE_ORDER.map((t) => ({ value: t, label: PROJECT_TYPE_META[t].label })),
    [],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New project' : 'Edit project'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {mode === 'create' && (templates.data?.length ?? 0) > 0 ? (
          <Input
            as="select"
            label="Start from template"
            value={templateId}
            onChange={setTemplateId}
            options={[
              { value: '', label: 'Blank project' },
              ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        ) : null}

        {mode === 'create' ? (
          <Input
            as="select"
            label="Type"
            value={type}
            onChange={(v) => setType(v as ProjectType)}
            options={typeOptions}
          />
        ) : null}

        <Input label="Title" value={title} onChange={setTitle} required />
        <Input as="textarea" label="Description" value={description} onChange={setDescription} />
        <Input type="date" label="Due date" value={dueDate} onChange={setDueDate} />
        <Input as="select" label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={PRIORITIES} />
        <Input as="select" label="Visibility" value={visibility} onChange={(v) => setVisibility(v as Visibility)} options={VISIBILITIES} />

        {fieldDefs.length > 0 ? (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{PROJECT_TYPE_META[type].label} details</legend>
            {fieldDefs.map((def) => {
              const value = custom[def.key] ?? '';
              const set = (v: string) => setCustom((c) => ({ ...c, [def.key]: v }));
              if (def.kind === 'boolean') {
                return (
                  <Input
                    key={def.key}
                    as="select"
                    label={def.label}
                    value={value || 'false'}
                    onChange={set}
                    options={[
                      { value: 'false', label: 'No' },
                      { value: 'true', label: 'Yes' },
                    ]}
                  />
                );
              }
              return (
                <Input
                  key={def.key}
                  label={def.label}
                  value={value}
                  onChange={set}
                  type={def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : 'text'}
                  helperText={def.kind === 'string-list' ? 'Comma-separated' : undefined}
                />
              );
            })}
          </fieldset>
        ) : null}
      </div>
    </Modal>
  );
}
