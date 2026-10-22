// プレイヤーごとの記録（design.md 12章）。あなたの記録は GameState にそのまま持ち、ライバル（CPU）の記録は
// s.rivals に同じ形で持つ。ライバルの番では、記録を GameState と入れ替えて、あなたと同じ計算を使う。

import type { GameState, SeatData, SeatKey } from './types';

export const SEAT_KEYS: SeatKey[] = [
  'player',
  'yearFlows',
  'lastSettlement',
  'history',
  'log',
  'stats',
  'queue',
  'lastMonth',
  'marketChange',
  'yearMarket',
  'newsEvent',
  'bigEvent',
  'decision',
  'decisionFrom',
  'cardUsed',
  'lastRoll',
  'lastFace',
  'lastCard',
  'lastPath',
  'result',
];

/** GameState と、i 番目のライバルの記録を入れ替える。もう一度呼ぶと元に戻る */
function swapSeat(s: GameState, i: number) {
  const a = s as unknown as Record<SeatKey, unknown>;
  const b = s.rivals[i] as unknown as Record<SeatKey, unknown>;
  for (const k of SEAT_KEYS) [a[k], b[k]] = [b[k], a[k]];
}

/** i 番目のライバルとして fn を行う（i が -1 なら、あなたとして）。fn の中では s.player などがその人のものになる */
export function asSeat<T>(s: GameState, i: number, fn: () => T): T {
  if (i < 0) return fn();
  swapSeat(s, i);
  try {
    return fn();
  } finally {
    swapSeat(s, i);
  }
}

/** 全員（あなた、ライバルの順）に fn を行う。fn には、ライバルなら番号、あなたなら -1 が渡る */
export function forEachSeat(s: GameState, fn: (i: number) => void) {
  fn(-1);
  s.rivals.forEach((_, i) => asSeat(s, i, () => fn(i)));
}

/** 全員の記録（入れ替えなしで見る。値動きを全員の資産に反映するときに使う） */
export function seatViews(s: GameState): SeatData[] {
  return [s, ...s.rivals];
}
