import type { Square, SquareType } from '../game/types';

/** マスの種類ごとの数（合計72）。design.md 3.3 */
export const SQUARE_COUNTS: Record<SquareType, number> = {
  start: 1,
  stopMarriage: 1,
  life: 24,
  good: 17,
  bad: 13,
  gamble: 3,
  insurance: 3,
  realEstate: 10,
};

/** 結婚ストップのマスの位置（スタートから何マス先か） */
export const MARRIAGE_STOP_INDEX = 18;

/**
 * 72マスの並び順を作る。スタートと結婚ストップは決まった位置に置き、
 * ほかの種類は盤面全体にむらなく散らす。乱数は使わないので、毎回同じ並びになる。
 */
function buildOrder(): SquareType[] {
  const total = Object.values(SQUARE_COUNTS).reduce((a, b) => a + b, 0);
  const fixed = new Map<number, SquareType>([
    [0, 'start'],
    [MARRIAGE_STOP_INDEX, 'stopMarriage'],
  ]);
  const free: number[] = [];
  for (let i = 0; i < total; i++) if (!fixed.has(i)) free.push(i);

  // 種類ごとに「盤面上の理想の位置」を等間隔に並べ、近い順に空きマスへ割り当てる
  const wanted: { type: SquareType; pos: number }[] = [];
  const order: SquareType[] = ['life', 'good', 'bad', 'realEstate', 'gamble', 'insurance'];
  order.forEach((type, k) => {
    const n = SQUARE_COUNTS[type];
    for (let j = 0; j < n; j++) {
      wanted.push({ type, pos: ((j + 0.5 + k * 0.13) / n) * free.length });
    }
  });
  wanted.sort((a, b) => a.pos - b.pos);

  const result: SquareType[] = new Array(total);
  fixed.forEach((type, i) => (result[i] = type));
  wanted.forEach((w, i) => (result[free[i]] = w.type));

  // 同じ種類が3つ以上続かないように、隣と入れ替えて整える
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 2; i < total; i++) {
      if (fixed.has(i) || fixed.has(i - 1)) continue;
      if (result[i] === result[i - 1] && result[i] === result[i - 2]) {
        const j = i + 1 < total && !fixed.has(i + 1) ? i + 1 : -1;
        if (j > 0) [result[i], result[j]] = [result[j], result[i]];
      }
    }
  }
  return result;
}

/** 仮の地図上の位置（段階4で地図に合わせて置き直す） */
function positionOf(i: number, total: number): { x: number; y: number } {
  const t = (i / total) * Math.PI * 2;
  return {
    x: Math.round(500 + 420 * Math.cos(t) + 40 * Math.cos(3 * t)),
    y: Math.round(500 + 300 * Math.sin(t) + 40 * Math.sin(2 * t)),
  };
}

export function buildBoard(): Square[] {
  const types = buildOrder();
  return types.map((type, i) => ({
    id: i,
    type,
    ...positionOf(i, types.length),
    next: [(i + 1) % types.length],
  }));
}

export const BOARD: Square[] = buildBoard();
