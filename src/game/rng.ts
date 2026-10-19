import type { GameState } from './types';

// シード値つきの乱数（mulberry32）。状態は GameState.rngState に持つので、
// セーブしても同じ続きが再現できる。

export function nextRandom(s: GameState): number {
  let t = (s.rngState = (s.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** min 以上 max 以下の整数 */
export function randomInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(nextRandom(s) * (max - min + 1));
}

/** 平均0、標準偏差1の正規乱数 */
export function randomNormal(s: GameState): number {
  const u = Math.max(nextRandom(s), 1e-12);
  const v = nextRandom(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 重みつきで1つ選ぶ。重みがすべて0なら null */
export function pickWeighted<T>(s: GameState, items: T[], weight: (item: T) => number): T | null {
  const weights = items.map((i) => Math.max(0, weight(i)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = nextRandom(s) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
