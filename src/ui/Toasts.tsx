import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../game/types';
import { MoneyDelta } from './Delta';
import { logLabel, visibleEntries } from './logLabel';

interface Toast {
  id: number;
  entry: LogEntry;
}

/** 小さな出来事やお知らせを、画面の端に約2秒出す（design.md 2.2） */
const SHOW_MS = 2200;

export function Toasts({ log }: { log: LogEntry[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(log.length);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (log.length < seen.current) seen.current = 0;
    const fresh = visibleEntries(log.slice(seen.current));
    seen.current = log.length;
    if (!fresh.length) return;
    const added = fresh.map((entry) => ({ id: nextId.current++, entry }));
    setToasts((ts) => [...ts, ...added].slice(-5));
    timers.current.push(
      window.setTimeout(() => setToasts((ts) => ts.filter((x) => !added.some((a) => a.id === x.id))), SHOW_MS),
    );
  }, [log]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(({ id, entry }) => (
        <div key={id} className="toast">
          <span>{logLabel(entry)}</span>
          {entry.cash !== undefined && <MoneyDelta v={entry.cash} />}
        </div>
      ))}
    </div>
  );
}
