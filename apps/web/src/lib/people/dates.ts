export type KeyDateKind = 'birthday' | 'anniversary';

export interface NextKeyDate {
  date: Date;
  kind: KeyDateKind;
  daysUntil: number;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The next annual occurrence of a YYYY-MM-DD date, on/after `from` (today counts). */
export function nextOccurrence(dateStr: string, from: Date = new Date()): Date {
  const parts = dateStr.split('-').map(Number);
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const today = startOfDay(from);
  let occ = new Date(today.getFullYear(), month - 1, day);
  if (occ.getTime() < today.getTime()) occ = new Date(today.getFullYear() + 1, month - 1, day);
  return occ;
}

/** The sooner of a person's birthday/anniversary occurrences, or null when neither is set. */
export function nextKeyDate(
  person: { birthday: string | null; anniversary: string | null },
  from: Date = new Date(),
): NextKeyDate | null {
  const today = startOfDay(from);
  const candidates: NextKeyDate[] = [];

  const add = (value: string | null, kind: KeyDateKind) => {
    if (!value) return;
    const date = nextOccurrence(value, from);
    candidates.push({ date, kind, daysUntil: Math.round((date.getTime() - today.getTime()) / DAY_MS) });
  };
  add(person.birthday, 'birthday');
  add(person.anniversary, 'anniversary');

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.daysUntil - b.daysUntil);
  return candidates[0] ?? null;
}
