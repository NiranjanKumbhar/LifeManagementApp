'use client';

import { useId, type ChangeEvent, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import styles from './Input.module.css';

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  onBlur?: () => void;
  disabled?: boolean;
};

type TextProps = BaseProps & {
  as?: 'input';
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
};
type TextareaProps = BaseProps & { as: 'textarea'; rows?: number };
type SelectProps = BaseProps & {
  as: 'select';
  options: Array<{ value: string; label: string }>;
};

export type InputProps = TextProps | TextareaProps | SelectProps;

export function Input(props: InputProps) {
  const { label, value, onChange, error, helperText, required, placeholder, id, onBlur, disabled } = props;
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : helperText ? `${fieldId}-help` : undefined;

  const shared = {
    id: fieldId,
    value,
    required,
    placeholder,
    disabled,
    onBlur,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: cn(styles.control, error && styles.invalid),
  } as const;

  let control: ReactNode;
  if (props.as === 'textarea') {
    control = (
      <textarea
        {...shared}
        rows={props.rows ?? 3}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    );
  } else if (props.as === 'select') {
    control = (
      <select {...shared} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        {...shared}
        type={props.type ?? 'text'}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {error ? (
        <p id={`${fieldId}-error`} className={styles.error}>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${fieldId}-help`} className={styles.help}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
