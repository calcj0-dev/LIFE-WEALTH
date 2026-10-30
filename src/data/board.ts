import type { AssetId, PetalId, RouteKind, Square, SquareType } from '../game/types';

/**
 * ふつうの道（真ん中の輪と4つの花びら）のマスの種類ごとの数。design.md 3.3。
 * ハイリスクの道、投資の道、花びらの近道のマスは、下に書く。
 * 段階7の元の道（200マス）の割合のまま、ふつうの道のマスの数に合わせた（段階9）。マイナスはプラスの約7割。株は4つの花びらに散らす（3.4）
 */
export const SQUARE_COUNTS: Record<SquareType, number> = {
  start: 1,
  family: 6,
  plusSmall: 37,
  minusSmall: 25,
  plusMedium: 18,
  minusMedium: 13,
  plusLarge: 8,
  minusLarge: 6,
  job: 6,
  chance: 4,
  card: 28,
  luckyCard: 5,
  stock: 16,
  investTalk: 8,
  gamble: 8,
  realEstate: 12,
};

/**
 * マスの並び順を作る。スタートは0番に置き、
 * ほかの種類は盤面全体にむらなく散らす。乱数は使わないので、毎回同じ並びになる。
 */
function buildOrder(total: number): SquareType[] {
  if (total !== Object.values(SQUARE_COUNTS).reduce((a, b) => a + b, 0)) throw new Error(`SQUARE_COUNTS must add up to ${total}`);
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

// ---------------------------------------------------------------- 真ん中の輪と4つの花びら（design.md 3.11。段階9）

/** 真ん中の輪（四角）の左上と右下（1マス分の長さが1） */
const X0 = 15;
const Y0 = 9;
const X1 = 29;
const Y1 = 23;
/** 真ん中の輪を突っ切る道の位置 */
const MID_X = (X0 + X1) / 2;
const MID_Y = (Y0 + Y1) / 2;

/** 道の折れ線の決め方。closed なら輪 */
interface RoadDef {
  route: RouteKind;
  /** 花びらの道なら、どの花びらか */
  petal?: PetalId;
  pts: [number, number][];
  closed?: boolean;
  /** 角の丸み */
  radius: number;
}

/**
 * 真ん中の輪。時計回り（上の辺は右へ、右の辺は下へ、下の辺は左へ、左の辺は上へ）。
 * 左上の角から始めるので、0番（スタート）は左上の角になる
 */
const HUB: RoadDef = { route: 'main', pts: [[X0, Y1], [X0, Y0], [X1, Y0], [X1, Y1]], closed: true, radius: 2 };

/**
 * 4つの花びら。真ん中の輪の辺から外へ出て、ぐるっと回り、手前の辺から真ん中の輪に戻る（v0.14.0 で向きを逆にした）。
 * 戻った先から真ん中の輪を数マス進むと、また同じ花びらの入り口に着くので、花びらごとに1周できる
 */
const PETALS: RoadDef[] = [
  { route: 'petal', petal: 'tl', pts: [[19, Y0], [19, 3], [5, 3], [5, 12.5], [X0, 12.5]], radius: 1.6 },
  { route: 'petal', petal: 'tr', pts: [[X1, 12.5], [39, 12.5], [39, 3], [25, 3], [25, Y0]], radius: 1.6 },
  { route: 'petal', petal: 'br', pts: [[25, Y1], [25, 29], [39, 29], [39, 19.5], [X1, 19.5]], radius: 1.6 },
  { route: 'petal', petal: 'bl', pts: [[X0, 19.5], [5, 19.5], [5, 29], [19, 29], [19, Y1]], radius: 1.6 },
];

/** 花びらの中の近道（青い道）。花びらの中を突っ切る */
const SHORTCUTS: (RoadDef & { petal: PetalId })[] = [
  { route: 'shortcut', petal: 'tl', pts: [[10, 3], [10, 12.5]], radius: 1 },
  { route: 'shortcut', petal: 'tr', pts: [[34, 12.5], [34, 3]], radius: 1 },
  { route: 'shortcut', petal: 'br', pts: [[34, 29], [34, 19.5]], radius: 1 },
  { route: 'shortcut', petal: 'bl', pts: [[10, 19.5], [10, 29]], radius: 1 },
];

/** ハイリスクの道（縦、上から下へ）と投資の道（横、左から右へ）。真ん中で立体交差する（曲がれない） */
const RISK_ROAD: RoadDef = { route: 'risk', pts: [[MID_X, Y0], [MID_X, Y1]], radius: 1 };
const INVEST_ROAD: RoadDef = { route: 'invest', pts: [[X0, MID_Y], [X1, MID_Y]], radius: 1 };

/** 花びらごとの株（design.md 3.4） */
export const PETAL_STOCK: Record<PetalId, AssetId> = { tl: 'it', tr: 'food', br: 'energy', bl: 'bank' };

/** 種類の並びを、n マス分くり返す */
const repeat = (pattern: SquareType[], n: number): SquareType[] => Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
/** ハイリスクの道の中身。お金が大きく動く */
const RISK: SquareType[] = ['plusLarge', 'minusLarge', 'gamble', 'plusMedium', 'minusLarge', 'plusLarge', 'minusMedium', 'card'];
/** 投資の道の中身。株のマスと投資の話のマスが多い */
const INVEST: SquareType[] = ['stock', 'investTalk', 'card', 'stock', 'plusSmall', 'stock', 'investTalk', 'minusSmall'];
/** 近道の中身。小さめの出来事 */
const SHORTCUT: SquareType[] = ['plusSmall', 'card', 'minusSmall', 'plusMedium', 'plusSmall', 'minusSmall', 'card', 'minusMedium'];

/** ボーナスマスが出る場所（design.md 3.10）。花びら1つに4か所と、真ん中の輪の4つの辺に1か所ずつ */
const BONUS_POINTS: [number, number][] = [
  [5, 5], [5, 10], [7.5, 12.5], [15, 3],
  [39, 5], [39, 10], [36.5, 3], [29, 3],
  [39, 22], [39, 27], [36.5, 29], [29, 29],
  [5, 27], [5, 22], [7.5, 19.5], [15, 29],
  [27.5, Y0], [X1, 15], [24, Y1], [X0, 21.5],
];

const ALL_POINTS = [HUB, ...PETALS, ...SHORTCUTS, RISK_ROAD, INVEST_ROAD].flatMap((r) => r.pts);
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

/** 角を丸くした折れ線（角の手前 r から先 r までを、なめらかな曲線にする） */
function rounded(pts: [number, number][], closed: boolean, r: number): [number, number][] {
  if (pts.length < 3) return pts;
  const P = closed ? [...pts, pts[0], pts[1]] : pts;
  const out: [number, number][] = closed ? [] : [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const [a, b, c] = [P[i - 1], P[i], P[i + 1]];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(r, la / 2.2, lc / 2.2);
    const p0: [number, number] = [b[0] + ((a[0] - b[0]) * k) / la, b[1] + ((a[1] - b[1]) * k) / la];
    const p2: [number, number] = [b[0] + ((c[0] - b[0]) * k) / lc, b[1] + ((c[1] - b[1]) * k) / lc];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      out.push([(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1]]);
    }
  }
  if (!closed) out.push(P[P.length - 1]);
  return out;
}

/** 道の折れ線（角を丸くしたもの。輪なら最初の点に戻る） */
function lineOf(r: RoadDef): [number, number][] {
  const line = rounded(r.pts, !!r.closed, r.radius);
  return r.closed ? [...line, line[0]] : line;
}

/** 折れ線の上に、マスを等間隔に置く。輪なら始めから、輪でなければ両端（分かれ道と合流するマス）を除いて置く */
function positionsAlong(points: [number, number][], closed: boolean): { x: number; y: number }[] {
  const segs = points.slice(1).map((p, i) => ({ a: points[i], b: p, len: Math.hypot(p[0] - points[i][0], p[1] - points[i][1]) }));
  const total = segs.reduce((a, x) => a + x.len, 0);
  const n = Math.max(1, Math.round(total));
  const out: { x: number; y: number }[] = [];
  for (let j = closed ? 0 : 1; j < n; j++) {
    let d = (j / n) * total;
    for (const seg of segs) {
      if (d <= seg.len + 1e-9) {
        const r = seg.len ? d / seg.len : 0;
        const pos = toWorld(seg.a[0] + (seg.b[0] - seg.a[0]) * r, seg.a[1] + (seg.b[1] - seg.a[1]) * r);
        out.push({ x: Math.round(pos.x), y: Math.round(pos.y) });
        break;
      }
      d -= seg.len;
    }
  }
  return out;
}

/** 真ん中の輪の折れ線（画面上の位置） */
export const ROUTE_POINTS = lineOf(HUB).map(([x, y]) => toWorld(x, y));
/** 分かれた道の折れ線と道の種類（画面上の位置。道を描くのと、飾りを道からはなすのに使う）。投資の道は最後に描く（立体交差の橋） */
export const BRANCH_LINES = [...PETALS, ...SHORTCUTS, RISK_ROAD, INVEST_ROAD].map((r) => ({ route: r.route, points: lineOf(r).map(([x, y]) => toWorld(x, y)) }));
export const BRANCH_POINTS = BRANCH_LINES.map((l) => l.points);
/** 立体交差の場所（画面上の位置） */
export const CROSSING = toWorld(MID_X, MID_Y);

export function buildBoard(): Square[] {
  // 1. ふつうの道（真ん中の輪と4つの花びら）にマスを置き、種類を決める
  const hubPos = positionsAlong(lineOf(HUB), true);
  const petalPos = PETALS.map((r) => positionsAlong(lineOf(r), false));
  const types = buildOrder(hubPos.length + petalPos.reduce((a, p) => a + p.length, 0));
  const squares: Square[] = [];
  let t = 0;
  const add = (pos: { x: number; y: number }, type: SquareType, route: RouteKind, petal?: PetalId) => {
    const id = squares.length;
    squares.push({ id, type, ...pos, next: [], route, ...(petal ? { petal } : {}) });
    return id;
  };
  const hub = hubPos.map((pos) => add(pos, types[t++], 'main'));
  hub.forEach((id, i) => squares[id].next.push(hub[(i + 1) % hub.length]));
  /** 座標にいちばん近いマス（among の中から） */
  const nearest = ([x, y]: [number, number], among: number[]) => {
    const w = toWorld(x, y);
    const d = (i: number) => Math.hypot(squares[i].x - w.x, squares[i].y - w.y);
    return among.reduce((best, i) => (d(i) < d(best) ? i : best), among[0]);
  };
  /** 道を from のマスから分け、to のマスに合流させる。分かれ道の1つ目がまっすぐ、2つ目が分かれた道 */
  const link = (ids: number[], from: number, to: number) => {
    ids.forEach((id, k) => k + 1 < ids.length && squares[id].next.push(ids[k + 1]));
    squares[from].next.push(ids[0]);
    squares[ids[ids.length - 1]].next.push(to);
  };
  const petalIds: Record<PetalId, number[]> = { tl: [], tr: [], br: [], bl: [] };
  PETALS.forEach((r, k) => {
    const ids = petalPos[k].map((pos) => add(pos, types[t++], 'petal', r.petal));
    petalIds[r.petal!] = ids;
    link(ids, nearest(r.pts[0], hub), nearest(r.pts[r.pts.length - 1], hub));
  });
  // 2. 花びらの近道
  for (const r of SHORTCUTS) {
    const ids = positionsAlong(lineOf(r), false).map((pos, k) => add(pos, SHORTCUT[k % SHORTCUT.length], 'shortcut', r.petal));
    link(ids, nearest(r.pts[0], petalIds[r.petal]), nearest(r.pts[r.pts.length - 1], petalIds[r.petal]));
  }
  // 3. ハイリスクの道と投資の道。投資の道は、真ん中でハイリスクの道のマスと重ならないように、交差するところにはマスを置かない（橋）
  const riskPos = positionsAlong(lineOf(RISK_ROAD), false);
  const riskIds = repeat(RISK, riskPos.length).map((type, k) => add(riskPos[k], type, 'risk'));
  link(riskIds, nearest(RISK_ROAD.pts[0], hub), nearest(RISK_ROAD.pts[1], hub));
  const investPos = positionsAlong(lineOf(INVEST_ROAD), false).filter((p) => Math.hypot(p.x - CROSSING.x, p.y - CROSSING.y) > UNIT * 0.6);
  const investIds = repeat(INVEST, investPos.length).map((type, k) => add(investPos[k], type, 'invest'));
  link(investIds, nearest(INVEST_ROAD.pts[0], hub), nearest(INVEST_ROAD.pts[1], hub));
  return squares;
}

export const BOARD: Square[] = buildBoard();

/** ボーナスマスが出る場所（マスの番号。design.md 3.10）。スタートと分かれ道のマスは、近くのほかのマスにずらす */
export const BONUS_SPOTS: number[] = BONUS_POINTS.map(([x, y]) => {
  const w = toWorld(x, y);
  const near = [...BOARD].sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y));
  return near.find((sq) => sq.type !== 'start' && sq.next.length === 1 && (sq.route === 'main' || sq.route === 'petal'))!.id;
});
