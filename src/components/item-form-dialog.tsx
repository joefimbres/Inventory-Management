"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { formatQty, parseQtyInput, vendorLabel } from "@/lib/inventory";
import type { CatalogInput, Item, VendorId } from "@/lib/types";
import { CATEGORIES, VENDOR_IDS } from "@/lib/types";

export function ItemFormDialog({
  item,
  onDismiss,
  onSave,
  onDelete,
}: {
  item: Item | null;
  onDismiss: () => void;
  onSave: (input: CatalogInput) => void;
  onDelete?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const parRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const parHintId = useId();
  const parErrorId = useId();
  const nameErrorId = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "Dairy");
  const [vendor, setVendor] = useState<VendorId>(item?.vendor ?? "other");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [parText, setParText] = useState(item?.parLevel == null ? "" : formatQty(item.parLevel));
  const [discontinued, setDiscontinued] = useState(item?.discontinued ?? false);
  const [estimated, setEstimated] = useState(item?.listing === "estimated");
  const [nameError, setNameError] = useState("");
  const [parError, setParError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const categories = CATEGORIES.some((entry) => entry === category) ? CATEGORIES : [category, ...CATEGORIES];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    const parsed = parseQtyInput(parText);
    if (!trimmed) {
      setNameError("Enter a name.");
      nameRef.current?.focus();
      return;
    }
    if (!parsed.ok) {
      setParError("Use a number, or leave par blank.");
      parRef.current?.focus();
      return;
    }
    onSave({
      name: trimmed,
      category,
      vendor,
      unit,
      parLevel: parsed.value,
      discontinued,
      estimated,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onDismiss}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <form className="max-h-[85dvh] overflow-auto p-4" onSubmit={submit}>
        <h2 id={titleId} className="font-display text-2xl">
          {item ? "Edit item" : "Add item"}
        </h2>
        {confirming ? (
          <div className="mt-4 flex flex-col gap-3">
            <p>Remove {item?.name} from the list? An order already sent to Joe still includes it.</p>
            <button type="button" className="btn btn-secondary w-full" autoFocus onClick={() => setConfirming(false)}>
              Keep item
            </button>
            <button type="button" className="btn btn-danger w-full" onClick={onDelete}>
              Remove item
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="field">
              <label htmlFor="item-name">
                Name <span className="text-muted">(required)</span>
              </label>
              <input
                ref={nameRef}
                id="item-name"
                name="name"
                required
                autoFocus
                maxLength={120}
                autoComplete="off"
                enterKeyHint="next"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? nameErrorId : undefined}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError("");
                }}
              />
              {nameError ? (
                <span id={nameErrorId} className="text-sm text-out">
                  {nameError}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="item-category">Category</label>
              <select id="item-category" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="mt-4">
              <legend className="font-semibold">Vendor</legend>
              {VENDOR_IDS.map((id) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="vendor"
                    value={id}
                    checked={vendor === id}
                    onChange={() => setVendor(id)}
                  />
                  {vendorLabel(id)}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor="item-unit">Unit</label>
              <input
                id="item-unit"
                name="unit"
                list="unit-suggestions"
                maxLength={40}
                autoComplete="off"
                enterKeyHint="next"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
              <datalist id="unit-suggestions">
                <option value="each" />
                <option value="gal" />
                <option value="qt" />
                <option value="bag" />
                <option value="bag of 6" />
                <option value="case" />
                <option value="lb" />
                <option value="oz" />
                <option value="box" />
                <option value="bottle" />
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="item-par">Par level</label>
              <input
                ref={parRef}
                id="item-par"
                name="par"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="Blank"
                aria-invalid={parError ? true : undefined}
                aria-describedby={parError ? parErrorId : parHintId}
                value={parText}
                onChange={(event) => {
                  setParText(event.target.value);
                  if (parError) setParError("");
                }}
                onBlur={() => {
                  if (parText.trim() === "") return;
                  if (!parseQtyInput(parText).ok) setParError("Use a number, or leave par blank.");
                }}
              />
              {parError ? (
                <span id={parErrorId} className="text-sm text-out">
                  {parError}
                </span>
              ) : (
                <span id={parHintId} className="text-sm text-muted">
                  Leave blank until a par is set. Blank is not zero.
                </span>
              )}
            </div>
            <label className="mt-4">
              <input type="checkbox" name="estimated" checked={estimated} onChange={(event) => setEstimated(event.target.checked)} />
              Estimated — not written on the menu
            </label>
            <label>
              <input
                type="checkbox"
                name="discontinued"
                checked={discontinued}
                onChange={(event) => setDiscontinued(event.target.checked)}
              />
              Discontinued
            </label>
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn btn-primary w-full">
                Save item
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={onDismiss}>
                Cancel
              </button>
              {onDelete ? (
                <button type="button" className="btn btn-danger w-full" onClick={() => setConfirming(true)}>
                  Remove item
                </button>
              ) : null}
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
