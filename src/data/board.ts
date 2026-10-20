import type { Square, SquareType } from '../game/types';

/** マスの種類ごとの数（合計72）。design.md 3.3 */
export const SQUARE_COUNTS: Record<SquareType, number> = {
  start: 1,
  stopMarriage: 1,
  birth: 2,
  small: 34,
  medium: 12,
  large: 6,
  stock: 6,
  investTalk: 3,
  gamble: 3,
  realEstate: 4,
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
  const order: SquareType[] = ['small', 'medium', 'large', 'stock', 'realEstate', 'gamble', 'investTalk', 'birth'];
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

/**
 * 盤面の道。1マス分の長さを1とした座標で、曲がりくねった1本の道を折れ線で表す。
 * マスはこの道の上に等間隔に並べるので、マスの数を変えても形は崩れない。
 */
const ROUTE: [number, number][] = [
  [1, 0], [14, 0], [14, 2], [1, 2], [1, 4], [14, 4], [14, 6], [-1, 6], [-1, 0], [1, 0],
];

/** 1マス分の長さ（画面上の大きさ） */
const UNIT = 130;
const MARGIN = 150;

/** 盤面全体の大きさ */
export const BOARD_WORLD = {
  width: (14 - -1) * UNIT + MARGIN * 2,
  height: 6 * UNIT + MARGIN * 2,
};

/** 座標を画面上の位置にする */
export function toWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x + 1) * UNIT + MARGIN, y: y * UNIT + MARGIN };
}

/** 道に沿って、マスを等間隔に置く */
function positionsAlongRoute(count: number): { x: number; y: number }[] {
  const segs = ROUTE.slice(1).map((p, i) => {
    const a = ROUTE[i];
    return { a, b: p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    let d = (i / count) * total;
    for (const seg of segs) {
      if (d <= seg.len) {
        const r = d / seg.len;
        const pos = toWorld(seg.a[0] + (seg.b[0] - seg.a[0]) * r, seg.a[1] + (seg.b[1] - seg.a[1]) * r);
        result.push({ x: Math.round(pos.x), y: Math.round(pos.y) });
        break;
      }
      d -= seg.len;
    }
  }
  return result;
}

/** 道の折れ線（画面上の位置） */
export const ROUTE_POINTS = ROUTE.map(([x, y]) => toWorld(x, y));

export function buildBoard(): Square[] {
  const types = buildOrder();
  const positions = positionsAlongRoute(types.length);
  return types.map((type, i) => ({
    id: i,
    type,
    ...positions[i],
    next: [(i + 1) % types.length],
  }));
}

export const BOARD: Square[] = buildBoard();
