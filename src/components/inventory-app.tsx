"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CountView } from "@/components/count-view";
import { ItemFormDialog } from "@/components/item-form-dialog";
import { ItemsView } from "@/components/items-view";
import { JoeView } from "@/components/joe-view";
import { OrderView } from "@/components/order-view";
import {
  formatWhen,
  needsOrder,
  pendingCount,
  pullLine,
  removeItem,
  sanitizeState,
  saveCatalog,
  sendToJoe,
  setLineStatus,
  setNote,
  setOnHand,
  setOrderQty,
  setStock,
  setVendor,
  setVendorStatus,
} from "@/lib/inventory";
import { SEED_UPDATED_AT, STORAGE_KEY, seedState } from "@/lib/seed";
import { describeChanges, isRemoteMode, overlayChanges, type RemoteMode } from "@/lib/shared-save";
import type { CatalogInput, InventoryState, Item, LineStatus, StockFlag, VendorId } from "@/lib/types";

type Tab = "count" | "order" | "joe" | "items";
type Warning = "unconfigured" | "unavailable" | null;
type Editor = { mode: "new" } | { mode: "edit"; item: Item } | null;

type StateResponse = {
  mode?: RemoteMode | "local";
  warning?: "unconfigured" | "unavailable";
  state?: unknown;
  pinRequired?: boolean;
};

function readStored(): InventoryState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizeState(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeStored(state: InventoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The list still works for this visit if the browser refuses storage.
  }
}

export function InventoryApp() {
  const [ready, setReady] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [state, setState] = useState<InventoryState | null>(null);
  const [mode, setMode] = useState<RemoteMode | "local" | null>(null);
  const [warning, setWarning] = useState<Warning>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("count");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [live, setLive] = useState("");
  const latest = useRef<InventoryState | null>(null);
  const baseRef = useRef<InventoryState | null>(null);
  const modeRef = useRef<RemoteMode | "local" | null>(null);
  const saving = useRef(false);
  const timer = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);

  function adoptRemote(next: InventoryState, remoteMode: RemoteMode) {
    latest.current = next;
    baseRef.current = next;
    modeRef.current = remoteMode;
    setState(next);
    setMode(remoteMode);
    setWarning(null);
    writeStored(next);
  }

  async function persist(snapshot: InventoryState) {
    const base = baseRef.current;
    const changes = base ? describeChanges(base, snapshot) : null;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: snapshot,
          baseUpdatedAt: base?.updatedAt ?? null,
          changedItemIds: changes?.changedItemIds ?? [],
          removedItemIds: changes?.removedItemIds ?? [],
          changedBatchIds: changes?.changedBatchIds ?? [],
          removedBatchIds: changes?.removedBatchIds ?? [],
        }),
        cache: "no-store",
      });
      if (response.status === 401) {
        setPinRequired(true);
        return;
      }
      const data = (await response.json()) as StateResponse;
      if (!response.ok || !isRemoteMode(data.mode)) {
        modeRef.current = "local";
        setMode("local");
        setWarning(data.warning === "unconfigured" ? "unconfigured" : "unavailable");
        setSaveError("Shared storage didn’t take this save. It’s kept on this phone.");
        if (latest.current?.updatedAt === snapshot.updatedAt) saving.current = false;
        return;
      }
      const saved = sanitizeState(data.state) ?? snapshot;
      setSaveError(null);
      if (latest.current?.updatedAt === snapshot.updatedAt) {
        adoptRemote(saved, data.mode);
        saving.current = false;
        return;
      }
      const local = latest.current;
      if (!local) {
        adoptRemote(saved, data.mode);
        saving.current = false;
        return;
      }
      const folded = overlayChanges(saved, {
        state: local,
        baseUpdatedAt: snapshot.updatedAt,
        ...describeChanges(snapshot, local),
      });
      baseRef.current = saved;
      latest.current = { ...folded, updatedAt: local.updatedAt };
      modeRef.current = data.mode;
      setState(latest.current);
      setMode(data.mode);
      writeStored(latest.current);
      saving.current = false;
      scheduleSave(latest.current);
    } catch {
      setSaveError("Couldn’t reach shared storage. It’s kept on this phone.");
      if (latest.current?.updatedAt === snapshot.updatedAt) saving.current = false;
    }
  }

  function scheduleSave(snapshot: InventoryState) {
    writeStored(snapshot);
    if (!isRemoteMode(modeRef.current ?? undefined)) return;
    saving.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const current = latest.current;
      if (current) void persist(current);
    }, 400);
  }

  function apply(recipe: (current: InventoryState) => InventoryState) {
    const current = latest.current;
    if (!current) return;
    const next = recipe(current);
    if (next === current) return;
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    latest.current = stamped;
    setState(stamped);
    scheduleSave(stamped);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) {
          setPinRequired(true);
          setReady(true);
          return;
        }
        const data = (await response.json()) as StateResponse;
        if (isRemoteMode(data.mode)) {
          const remote = sanitizeState(data.state);
          const local = readStored();
          const newerLocal = Boolean(local && remote && local.updatedAt > remote.updatedAt);
          const next = newerLocal && local ? local : (remote ?? seedState());
          if (cancelled) return;
          baseRef.current = remote;
          latest.current = next;
          modeRef.current = data.mode;
          setState(next);
          setMode(data.mode);
          setWarning(null);
          setReady(true);
          if (newerLocal) {
            saving.current = true;
            void persist(next);
          }
          return;
        }
        if (cancelled) return;
        const next = readStored() ?? seedState();
        latest.current = next;
        modeRef.current = "local";
        setState(next);
        setMode("local");
        setWarning(data.warning === "unavailable" ? "unavailable" : "unconfigured");
        setReady(true);
      } catch {
        if (cancelled) return;
        const next = readStored() ?? seedState();
        latest.current = next;
        modeRef.current = "local";
        setState(next);
        setMode("local");
        setWarning("unavailable");
        setReady(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  // Boot runs once. persist reads refs, so a new callback identity must not re-run it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRemoteMode(mode ?? undefined)) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || saving.current) return;
      void (async () => {
        try {
          const response = await fetch("/api/state", { cache: "no-store" });
          if (!response.ok) return;
          const data = (await response.json()) as StateResponse;
          if (!isRemoteMode(data.mode) || saving.current) return;
          const remote = sanitizeState(data.state);
          if (!remote || remote.updatedAt === latest.current?.updatedAt) return;
          baseRef.current = remote;
          latest.current = remote;
          setState(remote);
          writeStored(remote);
        } catch {
          // Keep the list on screen.
        }
      })();
    }, 12000);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (!ready || pinRequired) return;
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [tab, ready, pinRequired]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function send() {
    const current = latest.current;
    if (!current) return;
    const result = sendToJoe(current, new Date().toISOString());
    if (!result.batch) {
      setLive("Nothing is marked low or out.");
      return;
    }
    apply(() => result.state);
    setHighlight(result.batch.id);
    setTab("order");
    setLive(`Order list sent to Joe, ${result.batch.lines.length} items.`);
  }

  const draftCount = state ? state.items.filter(needsOrder).length : 0;
  const waitingCount = state ? pendingCount(state) : 0;

  let panel: ReactNode = <p>Loading the list…</p>;
  if (ready && pinRequired) {
    panel = <PinForm />;
  } else if (ready && state) {
    switch (tab) {
      case "count":
        panel = (
          <CountView
            state={state}
            headingRef={headingRef}
            onStock={(id, stock: StockFlag) => apply((current) => setStock(current, id, stock))}
            onHand={(id, value) => apply((current) => setOnHand(current, id, value))}
            onQty={(id, value) => apply((current) => setOrderQty(current, id, value))}
            onNote={(id, note) => apply((current) => setNote(current, id, note))}
            onEdit={(item) => setEditor({ mode: "edit", item })}
            onPull={(id) =>
              apply((current) => {
                const item = current.items.find((entry) => entry.id === id);
                if (!item?.activeBatchId) return current;
                return pullLine(current, item.activeBatchId, id);
              })
            }
          />
        );
        break;
      case "order":
        panel = (
          <OrderView
            state={state}
            headingRef={headingRef}
            highlightId={highlight}
            onQty={(id, value) => apply((current) => setOrderQty(current, id, value))}
            onNote={(id, note) => apply((current) => setNote(current, id, note))}
            onVendor={(id, vendor: VendorId) => apply((current) => setVendor(current, id, vendor))}
            onClear={(id) => apply((current) => setStock(current, id, "ok"))}
            onSend={send}
          />
        );
        break;
      case "joe":
        panel = (
          <JoeView
            state={state}
            headingRef={headingRef}
            onStatus={(batchId, itemId, status: LineStatus) =>
              apply((current) => setLineStatus(current, batchId, itemId, status, new Date().toISOString()))
            }
            onVendorStatus={(batchId, vendor, status) =>
              apply((current) => setVendorStatus(current, batchId, vendor, status, new Date().toISOString()))
            }
            onPull={(batchId, itemId) => apply((current) => pullLine(current, batchId, itemId))}
          />
        );
        break;
      case "items":
        panel = (
          <ItemsView
            state={state}
            headingRef={headingRef}
            onEdit={(item) => setEditor({ mode: "edit", item })}
            onCreate={() => setEditor({ mode: "new" })}
          />
        );
        break;
      default: {
        const unexpected: never = tab;
        panel = unexpected;
      }
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-paper pt-[max(0.5rem,env(safe-area-inset-top))] text-ink">
        <div className="mx-auto flex w-full max-w-xl items-end justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Hiking Hawaii Cafe</p>
            <h1 className="font-display text-[2.35rem] leading-[0.9]">Inventory</h1>
            <p className="mt-2 text-xs font-medium text-muted">
              {state
                ? state.updatedAt === SEED_UPDATED_AT
                  ? "No counts saved yet"
                  : `Updated ${formatWhen(state.updatedAt)}`
                : "Loading the list"}
            </p>
          </div>
          <p className="order-pill">
            <span className="font-display text-3xl leading-none">{ready && state ? draftCount : "–"}</span>
            <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase">to order</span>
          </p>
        </div>
      </header>
      {warning ? <LocalBanner warning={warning} /> : null}
      {saveError ? (
        <p role="alert" className="bg-[var(--out-bg)] px-4 py-3 text-center text-sm text-[var(--out)]">
          {saveError}
        </p>
      ) : null}
      <main className="mx-auto w-full max-w-xl px-3 pt-4 pb-28">{panel}</main>
      <p className="sr-only" role="status">
        {live}
      </p>
      {ready && !pinRequired ? (
        <nav
          aria-label="Inventory sections"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto grid w-full max-w-xl grid-cols-4">
            <TabButton id="count" label="Count" current={tab} onSelect={setTab} />
            <TabButton id="order" label="Order" count={draftCount} current={tab} onSelect={setTab} />
            <TabButton id="joe" label="Joe" count={waitingCount} current={tab} onSelect={setTab} />
            <TabButton id="items" label="Items" current={tab} onSelect={setTab} />
          </div>
        </nav>
      ) : null}
      {editor ? (
        <ItemFormDialog
          key={editor.mode === "edit" ? editor.item.id : "new"}
          item={editor.mode === "edit" ? editor.item : null}
          onDismiss={() => setEditor(null)}
          onSave={(input: CatalogInput) => {
            const id = editor.mode === "edit" ? editor.item.id : null;
            apply((current) => saveCatalog(current, id, input));
            setEditor(null);
            setLive(id ? "Item saved." : "Item added.");
          }}
          onDelete={
            editor.mode === "edit"
              ? () => {
                  const id = editor.item.id;
                  apply((current) => removeItem(current, id));
                  setEditor(null);
                  setLive("Item removed.");
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function LocalBanner({ warning }: { warning: Exclude<Warning, null> }) {
  const text =
    warning === "unconfigured"
      ? "This phone only. Shared storage isn’t set up, so other people won’t see these changes."
      : "Shared storage didn’t respond. Changes stay on this phone until it reconnects.";
  return (
    <p role="status" className="border-b-[3px] border-moss bg-sand px-4 py-3 text-center text-sm font-semibold text-ink">
      {text}
    </p>
  );
}

function TabButton({
  id,
  label,
  count = 0,
  current,
  onSelect,
}: {
  id: Tab;
  label: string;
  count?: number;
  current: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${selected ? "text-moss" : "text-muted"}`}
      onClick={() => onSelect(id)}
    >
      <span>{label}</span>
      <span aria-hidden="true" className={`text-xs ${count > 0 ? "" : "opacity-0"}`}>
        {count > 0 ? count : "0"}
      </span>
      {count > 0 ? <span className="sr-only">{count}</span> : null}
    </button>
  );
}

function PinForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const errorId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        setError("That PIN doesn’t match.");
        setPending(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Couldn’t check the PIN. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-[20px] border border-line bg-card p-4">
      <h2 className="font-display text-2xl">Enter the PIN</h2>
      <p className="mt-1 text-sm text-muted">This list is shared with the cafe. Ask Joe if you don’t have the PIN.</p>
      <div className="field mt-4">
        <label htmlFor="cafe-pin">PIN</label>
        <input
          id="cafe-pin"
          name="pin"
          type="password"
          autoComplete="current-password"
          enterKeyHint="done"
          autoFocus
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={pin}
          onChange={(event) => {
            setPin(event.target.value);
            if (error) setError("");
          }}
        />
        {error ? (
          <span id={errorId} role="alert" className="text-sm text-out">
            {error}
          </span>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary mt-4 w-full" disabled={pending}>
        {pending ? "Checking…" : "Open the list"}
      </button>
    </form>
  );
}
