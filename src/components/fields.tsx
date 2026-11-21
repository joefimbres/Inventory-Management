"use client";

import { useId, useState } from "react";
import { formatQty, parseQtyInput } from "@/lib/inventory";

export function QtyField({
  label,
  value,
  onCommit,
  hint,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const text = draft ?? (value === null ? "" : formatQty(value));

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        placeholder="Blank"
        value={text}
        onFocus={() => setDraft(value === null ? "" : formatQty(value))}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError("");
        }}
        onBlur={() => {
          const parsed = parseQtyInput(draft ?? "");
          if (!parsed.ok) {
            setError("Use a number, or leave it blank.");
            return;
          }
          setError("");
          setDraft(null);
          onCommit(parsed.value);
        }}
      />
      {hint && !error ? (
        <span id={hintId} className="text-sm text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-sm text-out">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function NoteField({
  value,
  onCommit,
  disabled = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;

  return (
    <div className="field">
      <label htmlFor={id}>Note</label>
      <input
        id={id}
        type="text"
        enterKeyHint="done"
        autoComplete="off"
        disabled={disabled}
        maxLength={400}
        value={text}
        onFocus={() => setDraft(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = (draft ?? value).slice(0, 400);
          setDraft(null);
          if (next !== value) onCommit(next);
        }}
      />
    </div>
  );
}
