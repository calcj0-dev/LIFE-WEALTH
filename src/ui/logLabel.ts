import type { LogEntry } from '../game/types';
import { has, t } from '../i18n';

/** 記録1件を、画面に出す短い名前にする（例: 「海外旅行」「結婚」） */
export function logLabel(entry: LogEntry): string {
  const key = entry.key;
  if (has(`label.${key}`)) return t(`label.${key}`);
  if (has(`log.${key}`)) return t(`log.${key}`);
  if (key.startsWith('event.')) {
    const [, id, suffix] = key.split('.');
    const base = t(`event.${id}.title`);
    const extra = suffix && has(`label.${id}.${suffix}`) ? t(`label.${id}.${suffix}`) : '';
    return base + extra;
  }
  return key;
}

/** お金や幸福ポイントが動いた記録だけ */
export function movingEntries(entries: LogEntry[]): LogEntry[] {
  return entries.filter((e) => (e.cash && Math.round(e.cash) !== 0) || (e.happiness && e.happiness !== 0));
}
