import type { GameState } from '../game/types';
import { t } from '../i18n';

/** 「3年目 4月」のような表示。1ターンが2ヶ月以上なら「3年目 4〜6月」（design.md 0.1） */
export function dateLabel(s: Pick<GameState, 'monthsPerTurn'>, year: number, month: number): string {
  const months = s.monthsPerTurn ?? 1;
  if (months <= 1) return t('hud.date', { year, month });
  return t('hud.dateRange', { year, month, end: month + months - 1 });
}
