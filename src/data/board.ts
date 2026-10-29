import type { RouteKind, Square, SquareType } from '../game/types';

/**
 * 外周のマスの種類ごとの数（合計160）。design.md 3.3。十字の道と四隅の近道のマスは、下の BRANCHES に書く。数を変えれば、盤面のマスの数も変わる。
 * 段階7の元の道（200マス）の割合のまま、外周の数に合わせて減らした（段階8）。マイナスはプラスの約7割
 */
export const SQUARE_COUNTS: Record<SquareType, number> = {
  start: 1,
  family: 5,
  plusSmall: 29,
  minusSmall: 20,
  plusMedium: 14,
  minusMedium: 10,
  plusLarge: 6,
  minusLarge: 5,
  job: 5,
  chance: 3,
  card: 22,
  luckyCard: 4,
  stock: 14,
  investTalk: 6,
  gamble: 7,
  realEstate: 9,
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

// ---------------------------------------------------------------- 十字型の盤面（design.md 3.11。段階8）

/** 外周の横と縦の長さ（1マス分の長さが1） */
const W = 44;
const H = 36;
/** 外周の角の丸み */
const R = 2;
/** 真ん中の交差点 */
const CENTER: [number, number] = [W / 2, H / 2];

/** 角を丸くする点（cx, cy を中心に、from 度から to 度まで） */
function arc(cx: number, cy: number, from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 1; k < 4; k++) {
    const a = ((from + ((to - from) * k) / 4) * Math.PI) / 180;
    out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return out;
}

/**
 * 外周。時計回り（上の辺は右へ、右の辺は下へ、下の辺は左へ、左の辺は上へ）。
 * スタート（0番）は左の辺の下のほう。マスはこの道の上に等間隔に並べる。道の長さ（約157）をマスの数に合わせておくと、マスどうしが重ならない
 */
const ROUTE: [number, number][] = [
  [0, H - 7],
  [0, R],
  ...arc(R, R, 180, 270),
  [R, 0],
  [W - R, 0],
  ...arc(W - R, R, 270, 360),
  [W, R],
  [W, H - R],
  ...arc(W - R, H - R, 0, 90),
  [W - R, H],
  [R, H],
  ...arc(R, H - R, 90, 180),
  [0, H - R],
  [0, H - 7],
];

/** 種類の並びを、n マス分くり返す */
const repeat = (pattern: SquareType[], n: number): SquareType[] => Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);

/** ハイリスクの道の中身。お金が大きく動く */
const RISK: SquareType[] = ['plusLarge', 'minusLarge', 'gamble', 'plusMedium', 'minusLarge', 'plusLarge', 'minusMedium', 'card'];
/** 投資の道の中身。株のマスと投資の話のマスが多い */
const INVEST: SquareType[] = ['stock', 'investTalk', 'card', 'stock', 'plusSmall', 'stock', 'investTalk', 'minusSmall'];

/**
 * 外周から分かれる道。from の近くの外周のマスが分かれ道になり、via を通って、to に合流する。
 * to が 'center' なら真ん中の交差点へ、from が 'center' なら交差点から分かれる
 */
interface BranchDef {
  route: Exclude<RouteKind, 'main'>;
  from: [number, number] | 'center';
  via: [number, number][];
  to: [number, number] | 'center';
  /** 分かれた道のマス（並ぶ順） */
  types: SquareType[];
}

export const BRANCHES: BranchDef[] = [
  // 四隅の近道。角を斜めに抜ける
  { route: 'shortcut', from: [0, 5], via: [], to: [5, 0], types: ['plusSmall', 'card', 'minusSmall', 'plusMedium'] },
  { route: 'shortcut', from: [W - 5, 0], via: [], to: [W, 5], types: ['card', 'plusSmall', 'minusMedium', 'plusSmall'] },
  { route: 'shortcut', from: [W, H - 5], via: [], to: [W - 5, H], types: ['minusSmall', 'plusSmall', 'card', 'plusMedium'] },
  { route: 'shortcut', from: [5, H], via: [], to: [0, H - 5], types: ['plusMedium', 'minusSmall', 'card', 'plusSmall'] },
  // ハイリスクの道（十字の縦）。上の辺と下の辺のまん中から入り、真ん中の交差点へ向かう
  { route: 'risk', from: [W / 2, 0], via: [[W / 2 + 1.5, H / 4]], to: 'center', types: repeat(RISK, 17) },
  { route: 'risk', from: [W / 2, H], via: [[W / 2 - 1.5, (H * 3) / 4]], to: 'center', types: repeat([...RISK].reverse(), 17) },
  // 投資の道（十字の横）。交差点から、右か左へ進み、右の辺か左の辺のまん中で外周に合流する。1つ目（まっすぐ）は右
  { route: 'invest', from: 'center', via: [[(W * 3) / 4, H / 2 + 1.5]], to: [W, H / 2], types: repeat(INVEST, 21) },
  { route: 'invest', from: 'center', via: [[W / 4, H / 2 - 1.5]], to: [0, H / 2], types: repeat([...INVEST].reverse(), 21) },
];

/** 真ん中の交差点のマスの種類（分かれ道なので、ボーナスマスは置かない） */
const CENTER_TYPE: SquareType = 'luckyCard';

const pointOf = (p: [number, number] | 'center'): [number, number] => (p === 'center' ? CENTER : p);
const branchLine = (b: BranchDef) => [pointOf(b.from), ...b.via, pointOf(b.to)];

const ALL_POINTS = [...ROUTE, ...BRANCHES.flatMap(branchLine)];
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

/** 外周の折れ線（画面上の位置） */
export const ROUTE_POINTS = ROUTE.map(([x, y]) => toWorld(x, y));
/** 分かれた道の折れ線と道の種類（画面上の位置。道を描くのと、飾りを道からはなすのに使う） */
export const BRANCH_LINES = BRANCHES.map((b) => ({ route: b.route, points: branchLine(b).map(([x, y]) => toWorld(x, y)) }));
export const BRANCH_POINTS = BRANCH_LINES.map((l) => l.points);

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
  /** 座標にいちばん近い、外周のマス */
  const nearestMain = ([x, y]: [number, number]) => {
    const w = toWorld(x, y);
    let best = 0;
    for (let i = 0; i < types.length; i++) {
      if (Math.hypot(squares[i].x - w.x, squares[i].y - w.y) < Math.hypot(squares[best].x - w.x, squares[best].y - w.y)) best = i;
    }
    return best;
  };
  // 真ん中の交差点。行き先は、投資の道を作るときに足す
  const center = squares.length;
  squares.push({ id: center, type: CENTER_TYPE, ...toWorld(...CENTER), next: [], route: 'risk' });
  for (const b of BRANCHES) {
    const join = b.to === 'center' ? center : nearestMain(b.to);
    const pts = positionsAlong(branchLine(b), b.types.length);
    const first = squares.length;
    b.types.forEach((type, j) => {
      const id = first + j;
      squares.push({ id, type, ...pts[j], next: [j === b.types.length - 1 ? join : id + 1], route: b.route });
    });
    if (b.from === 'center') squares[center].next.push(first);
    // 外周の分かれ道: 1つ目が外周（まっすぐ）、2つ目が分かれた道
    else {
      const fork = nearestMain(b.from);
      squares[fork].next = [squares[fork].next[0], first];
    }
  }
  return squares;
}

export const BOARD: Square[] = buildBoard();
