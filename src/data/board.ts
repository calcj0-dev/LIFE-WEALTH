import type { RouteKind, Square, SquareType } from '../game/types';

/**
 * 元の道のマスの種類ごとの数（合計200）。design.md 3.3。分かれた道のマスは、下の BRANCHES に書く。数を変えれば、盤面のマスの数も変わる。
 * 出来事のマスは、お金が増える（プラス）か減る（マイナス）かで分ける。マイナスはプラスの約7割（段階7）
 */
export const SQUARE_COUNTS: Record<SquareType, number> = {
  start: 1,
  family: 6,
  plusSmall: 36,
  minusSmall: 25,
  plusMedium: 18,
  minusMedium: 13,
  plusLarge: 8,
  minusLarge: 6,
  job: 6,
  chance: 4,
  card: 28,
  luckyCard: 5,
  stock: 17,
  investTalk: 8,
  gamble: 8,
  realEstate: 11,
};

/**
 * マスの並び順を作る。スタートは0番に置き、
 * ほかの種類は盤面全体にむらなく散らす。乱数は使わないので、毎回同じ並びになる。
 */
function buildOrder(): SquareType[] {
  const total = Object.values(SQUARE_COUNTS).reduce((a, b) => a + b, 0);
  const fixed = new Map<number, SquareType>([[0, 'start']]);
  const free: number[] = [];
  for (let i = 0; i < total; i++) if (!fixed.has(i)) free.push(i);

  // 種類ごとに「盤面上の理想の位置」を等間隔に並べ、近い順に空きマスへ割り当てる
  const wanted: { type: SquareType; pos: number }[] = [];
  const order: SquareType[] = [
    'minusSmall',
    'plusSmall',
    'card',
    'minusMedium',
    'plusMedium',
    'minusLarge',
    'plusLarge',
    'stock',
    'realEstate',
    'gamble',
    'investTalk',
    'family',
    'chance',
    'job',
    'luckyCard',
  ];
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
 * マスはこの道の上に等間隔に並べる。道の長さ（200）をマスの数に合わせておくと、マスどうしが重ならない。
 * マスを増やすときは、横の長さか、折り返しの数を増やす。
 */
const ROUTE: [number, number][] = [
  [1, 0], [22, 0], [22, 2], [1, 2], [1, 4], [22, 4], [22, 6], [1, 6], [1, 8], [22, 8],
  [22, 10], [1, 10], [1, 12], [22, 12], [22, 14], [-1, 14], [-1, 0], [1, 0],
];

/**
 * 分かれ道（design.md 3.11）。from の近くの元の道のマスが分かれ道になり、via を通って、to の近くの元の道のマスに合流する。
 * 座標は ROUTE と同じ（1マス分の長さが1）。偶数の段（y = 0, 4, 8, 12）は左から右へ、奇数の段は右から左へ進む
 */
interface BranchDef {
  route: Exclude<RouteKind, 'main'>;
  from: [number, number];
  via: [number, number][];
  to: [number, number];
  /** 分かれた道のマス（並ぶ順） */
  types: SquareType[];
}

export const BRANCHES: BranchDef[] = [
  // ハイリスクの道: 盤面の上の外側をまわる。お金が大きく動く
  {
    route: 'risk',
    from: [4, 0],
    via: [
      [4, -1.6],
      [15, -1.6],
    ],
    to: [15, 0],
    types: ['plusLarge', 'minusLarge', 'gamble', 'minusLarge', 'plusLarge', 'minusMedium', 'plusLarge', 'minusLarge', 'gamble', 'plusMedium', 'minusLarge', 'plusLarge'],
  },
  // 戻る道と近道（段階7で6本ずつに増やした）。段と段の間に1本ずつ。近道は下の段へ（少し先へ）、戻る道は上の段へ（少し手前へ）
  { route: 'shortcut', from: [16, 0], via: [], to: [16, 2], types: ['minusSmall', 'card'] },
  { route: 'back', from: [19, 2], via: [], to: [19, 0], types: ['plusSmall', 'card'] },
  { route: 'shortcut', from: [4, 2], via: [], to: [4, 4], types: ['plusSmall', 'minusMedium'] },
  { route: 'back', from: [7, 4], via: [], to: [7, 2], types: ['card', 'plusMedium'] },
  { route: 'shortcut', from: [16, 4], via: [], to: [16, 6], types: ['card', 'plusSmall'] },
  { route: 'back', from: [19, 6], via: [], to: [19, 4], types: ['minusSmall', 'plusSmall'] },
  { route: 'shortcut', from: [4, 6], via: [], to: [4, 8], types: ['plusMedium', 'card'] },
  { route: 'back', from: [7, 8], via: [], to: [7, 6], types: ['plusSmall', 'minusSmall'] },
  { route: 'shortcut', from: [16, 8], via: [], to: [16, 10], types: ['card', 'minusSmall'] },
  { route: 'back', from: [19, 10], via: [], to: [19, 8], types: ['plusSmall', 'card'] },
  { route: 'shortcut', from: [4, 10], via: [], to: [4, 12], types: ['minusSmall', 'plusSmall'] },
  { route: 'back', from: [7, 12], via: [], to: [7, 10], types: ['card', 'plusMedium'] },
  // 投資の道: 盤面の下の外側をまわる。株のマスと投資の話のマスが多い
  {
    route: 'invest',
    from: [18, 14],
    via: [
      [18, 15.6],
      [5, 15.6],
    ],
    to: [5, 14],
    types: ['stock', 'investTalk', 'stock', 'card', 'stock', 'investTalk', 'plusSmall', 'stock', 'investTalk', 'stock', 'minusSmall', 'stock', 'investTalk', 'stock'],
  },
];

const ALL_POINTS = [...ROUTE, ...BRANCHES.flatMap((b) => [b.from, ...b.via, b.to])];
const ROUTE_MIN_X = Math.min(...ALL_POINTS.map((p) => p[0]));
const ROUTE_MAX_X = Math.max(...ALL_POINTS.map((p) => p[0]));
const ROUTE_MIN_Y = Math.min(...ALL_POINTS.map((p) => p[1]));
const ROUTE_MAX_Y = Math.max(...ALL_POINTS.map((p) => p[1]));

/** 1マス分の長さ（画面上の大きさ） */
const UNIT = 130;
const MARGIN = 150;

/** 盤面全体の大きさ */
export const BOARD_WORLD = {
  width: (ROUTE_MAX_X - ROUTE_MIN_X) * UNIT + MARGIN * 2,
  height: (ROUTE_MAX_Y - ROUTE_MIN_Y) * UNIT + MARGIN * 2,
};

/** 座標を画面上の位置にする */
export function toWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x - ROUTE_MIN_X) * UNIT + MARGIN, y: (y - ROUTE_MIN_Y) * UNIT + MARGIN };
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
/** 分かれた道の折れ線（画面上の位置。道を描くのと、飾りを道からはなすのに使う） */
export const BRANCH_POINTS = BRANCHES.map((b) => [b.from, ...b.via, b.to].map(([x, y]) => toWorld(x, y)));

/** 折れ線の上に、端を除いて n 個のマスを等間隔に置く */
function positionsAlong(points: [number, number][], n: number): { x: number; y: number }[] {
  const segs = points.slice(1).map((p, i) => ({ a: points[i], b: p, len: Math.hypot(p[0] - points[i][0], p[1] - points[i][1]) }));
  const total = segs.reduce((a, x) => a + x.len, 0);
  const out: { x: number; y: number }[] = [];
  for (let j = 0; j < n; j++) {
    let d = ((j + 1) / (n + 1)) * total;
    for (const seg of segs) {
      if (d <= seg.len) {
        const r = d / seg.len;
        const pos = toWorld(seg.a[0] + (seg.b[0] - seg.a[0]) * r, seg.a[1] + (seg.b[1] - seg.a[1]) * r);
        out.push({ x: Math.round(pos.x), y: Math.round(pos.y) });
        break;
      }
      d -= seg.len;
    }
  }
  return out;
}

export function buildBoard(): Square[] {
  const types = buildOrder();
  const positions = positionsAlongRoute(types.length);
  const squares: Square[] = types.map((type, i) => ({
    id: i,
    type,
    ...positions[i],
    next: [(i + 1) % types.length],
    route: 'main',
  }));
  /** 座標にいちばん近い、元の道のマス */
  const nearestMain = ([x, y]: [number, number]) => {
    const w = toWorld(x, y);
    let best = 0;
    for (let i = 0; i < types.length; i++) {
      if (Math.hypot(squares[i].x - w.x, squares[i].y - w.y) < Math.hypot(squares[best].x - w.x, squares[best].y - w.y)) best = i;
    }
    return best;
  };
  for (const b of BRANCHES) {
    const fork = nearestMain(b.from);
    const join = nearestMain(b.to);
    const pts = positionsAlong([b.from, ...b.via, b.to], b.types.length);
    const first = squares.length;
    b.types.forEach((type, j) => {
      const id = first + j;
      squares.push({ id, type, ...pts[j], next: [j === b.types.length - 1 ? join : id + 1], route: b.route });
    });
    // 分かれ道: 1つ目が元の道（まっすぐ）、2つ目が分かれた道
    squares[fork].next = [squares[fork].next[0], first];
  }
  return squares;
}

export const BOARD: Square[] = buildBoard();
