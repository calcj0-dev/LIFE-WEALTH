import type { LogEntry } from '../game/types';
import { has, t } from '../i18n';

/** 記録1件を、画面に出す短い名前にする（例: 「旅行」「結婚した」） */
export function logLabel(entry: LogEntry): string {
  const { key, params } = entry;
  if (has(`label.${key}`)) return t(`label.${key}`, params);
  if (has(`log.${key}`)) return t(`log.${key}`, params);
  if (key.startsWith('event.')) {
    const [, id, suffix] = key.split('.');
    const base = t(`event.${id}.title`);
    return suffix && has(`label.suffix.${suffix}`) ? base + t(`label.suffix.${suffix}`, params) : base;
  }
  return key;
}

/** お金が動いた記録と、お知らせの記録だけ */
export function visibleEntries(entries: LogEntry[]): LogEntry[] {
  return entries.filter((e) => (e.cash !== undefined && Math.round(e.cash) !== 0) || e.notice);
}
