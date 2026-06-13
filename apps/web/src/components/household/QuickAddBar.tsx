'use client';

import { useState, type FormEvent } from 'react';
import { PlusIcon } from '@/components/icons';
import styles from './QuickAddBar.module.css';

export interface QuickAddBarProps {
  onAdd: (name: string) => void;
  placeholder?: string;
}

export function QuickAddBar({ onAdd, placeholder = 'Add item…' }: QuickAddBarProps) {
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <form className={styles.bar} onSubmit={submit}>
      <span className={styles.icon} aria-hidden="true">
        <PlusIcon size={18} />
      </span>
      <input
        className={styles.input}
        type="text"
        aria-label="Add item"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </form>
  );
}
