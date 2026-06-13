'use client';

import { useState } from 'react';
import type { GiftIdea } from '@lifesync/shared-types';
import { Button } from '@lifesync/ui';
import styles from './GiftIdeaList.module.css';

export interface GiftIdeaListProps {
  giftIdeas: GiftIdea[];
  onChange: (next: GiftIdea[]) => void;
}

export function GiftIdeaList({ giftIdeas, onChange }: GiftIdeaListProps) {
  const [idea, setIdea] = useState('');
  const [budget, setBudget] = useState('');
  const [url, setUrl] = useState('');

  const toggle = (index: number) =>
    onChange(giftIdeas.map((g, i) => (i === index ? { ...g, purchased: !g.purchased } : g)));

  const remove = (index: number) => onChange(giftIdeas.filter((_, i) => i !== index));

  const add = () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    const next: GiftIdea = { idea: trimmed, purchased: false };
    if (budget.trim()) next.budget = Number(budget);
    if (url.trim()) next.url = url.trim();
    onChange([...giftIdeas, next]);
    setIdea('');
    setBudget('');
    setUrl('');
  };

  return (
    <div className={styles.wrap}>
      {giftIdeas.length === 0 ? (
        <p className={styles.empty}>No gift ideas yet.</p>
      ) : (
        <ul className={styles.list}>
          {giftIdeas.map((g, i) => (
            <li key={i} className={styles.row}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={Boolean(g.purchased)}
                  onChange={() => toggle(i)}
                  aria-label={`${g.idea} purchased`}
                />
                <span className={g.purchased ? styles.done : undefined}>{g.idea}</span>
              </label>
              {g.budget != null ? <span className={styles.budget}>£{g.budget}</span> : null}
              {g.url ? (
                <a className={styles.link} href={g.url} target="_blank" rel="noopener noreferrer">
                  link
                </a>
              ) : null}
              <button
                type="button"
                className={styles.remove}
                aria-label={`remove ${g.idea}`}
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.add}>
        <input
          className={styles.ideaInput}
          aria-label="Gift idea"
          placeholder="Add a gift idea…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <input
          className={styles.budgetInput}
          aria-label="Budget"
          type="number"
          placeholder="£"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <input
          className={styles.urlInput}
          aria-label="Link"
          placeholder="Link (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button size="sm" onClick={add} disabled={!idea.trim()}>
          Add gift idea
        </Button>
      </div>
    </div>
  );
}
