// 盤面。ほかの画面から切り離した部品にして、あとで Phaser に差し替えられるようにする（design.md 11章）。
// 真ん中の輪と4つの花びらの道に色とりどりのマスが並び、まわりに家や木がある、にぎやかな盤面（design.md 3.1、3.11）。

import { useEffect, useRef, useState } from 'react';
import { PLAYER_LOOKS, type FamilyMember, type Look } from '../data/characters';
import { AvatarBody } from './Avatar';
import { SquareIcon } from './SquareIcon';
import { BOARD, BOARD_WORLD, BRANCH_LINES, BRANCH_POINTS, CROSSING, PETAL_STOCK, ROUTE_POINTS } from '../data/board';
import type { RouteKind, Square, SquareType } from '../game/types';
import { formatMoney, t } from '../i18n';
import { BONUS } from '../data/rules';

export const SQUARE_COLORS: Record<SquareType, string> = {
  start: '#ffb703',
  family: '#ff6b9a',
  // 出来事のマス: プラスは緑、マイナスは赤、チャンスは黄色（design.md 3.3）
  plusSmall: '#58c35c',
  plusMedium: '#58c35c',
  plusLarge: '#58c35c',
  minusSmall: '#f25c54',
  minusMedium: '#f25c54',
  minusLarge: '#f25c54',
  chance: '#ffc94d',
  job: '#3f6fb5',
  card: '#8ecae6',
  luckyCard: '#4d96ff',
  stock: '#2ec4b6',
  investTalk: '#6c7a89',
  gamble: '#9b5de5',
  realEstate: '#f9a03f',
};

/** 道ごとの色（design.md 3.11）。arrow は看板と矢印、road は道の色 */
export const ROUTE_COLORS: Record<RouteKind, { arrow: string; road: string; edge: string }> = {
  main: { arrow: '#a8773f', road: '#f8ecd0', edge: '#d9bf8c' },
  petal: { arrow: '#a8773f', road: '#f8ecd0', edge: '#d9bf8c' },
  back: { arrow: '#4d96ff', road: '#dcebff', edge: '#9cc2f2' },
  risk: { arrow: '#d6336c', road: '#fbdce7', edge: '#eba3bd' },
  invest: { arrow: '#1fa89c', road: '#d3f2ee', edge: '#8fd6cd' },
};

/** 2つのマスの間の道の種類（分かれた道から外周に合流するところは、分かれた道の色にする） */
const edgeRoute = (from: Square, to: Square): RouteKind => (to.route === 'main' ? from.route : to.route);

/** 看板の幅（道の名前を書くときは広い） */
/** 看板の矢印の板に書く言葉。ハイリスクの道と投資の道は道の名前、花びらの入り口は花びらの株の名前（design.md 3.4、3.11） */
function plateLabel(from: Square, to: Square): string {
  const route = edgeRoute(from, to);
  if (route === 'risk' || route === 'invest') return t(`route.short.${route}`);
  if (to.route === 'petal' && from.route === 'main' && to.petal) return t(`assetShort.${PETAL_STOCK[to.petal]}`);
  return '';
}
const signWidth = (sq: Square) => (sq.next.some((to) => plateLabel(sq, BOARD[to])) ? 132 : 64);

/** 分かれ道のマスの横の、看板を立てる場所（近い順に試して、看板がまわりのマスと重ならない場所） */
function signSpot(sq: Square): { x: number; y: number } {
  const half = signWidth(sq) / 2;
  const height = sq.next.length * 36;
  // 看板の板の範囲と、マスとの間（マスの中心から、板の一番近い点まで）
  const gapAt = (x: number, y: number) =>
    Math.min(
      ...BOARD.filter((o) => o.id !== sq.id).map((o) => Math.hypot(Math.max(0, Math.abs(o.x - x) - half), Math.max(0, o.y - y, y - height - 20 - o.y))),
      Math.hypot(Math.max(0, Math.abs(sq.x - x) - half), Math.max(0, sq.y - y, y - height - 20 - sq.y)),
    );
  let best = { x: sq.x, y: sq.y - 110, gap: -1 };
  for (const r of [100, 130, 160, 200]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = sq.x + Math.cos(a) * r;
      const y = sq.y + Math.sin(a) * r;
      const gap = gapAt(x, y);
      if (gap > best.gap + 1) best = { x, y, gap };
    }
    if (best.gap >= 48) break;
  }
  return best;
}
const FORKS = BOARD.filter((sq) => sq.next.length > 1).map((sq) => ({ sq, spot: signSpot(sq) }));

/** 道案内の看板（design.md 3.11）。行ける道の数だけ矢印の板を並べ、矢印はそれぞれの道の向きを指す */
function Signpost({ sq, x, y }: { sq: Square; x: number; y: number }) {
  const plates = sq.next.map((to) => {
    const next = BOARD[to];
    const route = edgeRoute(sq, next);
    const angle = (Math.atan2(next.y - sq.y, next.x - sq.x) * 180) / Math.PI;
    const label = plateLabel(sq, next);
    return { to, route, angle, label };
  });
  const width = signWidth(sq);
  const top = -18 - plates.length * 36;
  return (
    <g transform={`translate(${x} ${y})`} className="signpost">
      <rect x="-4" y={top + 10} width="8" height={-top + 8} rx="3" fill="#8a5a33" />
      {plates.map((p, k) => (
        <g key={p.to} transform={`translate(0 ${top + 8 + k * 36})`}>
          <rect x={-width / 2} y="-15" width={width} height="30" rx="8" fill={ROUTE_COLORS[p.route].arrow} stroke="#fff" strokeWidth="3" />
          <g transform={`translate(${p.label ? -width / 2 + 20 : 0} 0) rotate(${p.angle})`}>
            <path d="M-11,-4 L2,-4 L2,-10 L12,0 L2,10 L2,4 L-11,4 Z" fill="#fff" />
          </g>
          {p.label && (
            <text x={12} y="6" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** 進む向きの印「＞」を描く、マスとマスの間（数マスおき。分かれ道と合流するところには必ず描く） */
const CHEVRONS = BOARD.flatMap((sq) =>
  sq.next
    .filter((to) => sq.next.length > 1 || BOARD[to].route !== sq.route || sq.id % 3 === 1)
    .map((to) => {
      const next = BOARD[to];
      return {
        key: `${sq.id}-${to}`,
        x: (sq.x + next.x) / 2,
        y: (sq.y + next.y) / 2,
        angle: (Math.atan2(next.y - sq.y, next.x - sq.x) * 180) / Math.PI,
        color: ROUTE_COLORS[edgeRoute(sq, next)].arrow,
      };
    }),
);

const SIZE = 74;
/** 画面に映す範囲の大きさ（駒を追うとき） */
const VIEW = { width: 1000, height: 560 };
const FOLLOW_SCALE = 1;
/** 全体図で、盤面を収める横の幅（PC やスマホの横向きの枠で、左右が切れても見える幅） */
const OVERVIEW_WIDTH = 780;

// ---------------------------------------------------------------- 背景の飾り（毎回同じ配置）

type Deco = { kind: 'tree' | 'pine' | 'house' | 'flower' | 'bush' | 'pond' | 'grass'; x: number; y: number; color: string; size: number };

function buildDecorations(): Deco[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roofColors = ['#ff6b6b', '#4d96ff', '#ffb703', '#9b5de5', '#2ec4b6'];
  const items: Deco[] = [];
  const nearSquare = (x: number, y: number, d: number) => BOARD.some((sq) => Math.hypot(sq.x - x, sq.y - y) < d);
  const nearRoad = (x: number, y: number, d = 70) => {
    for (const line of [ROUTE_POINTS, ...BRANCH_POINTS])
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const r = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / len2));
      if (Math.hypot(x - (a.x + r * (b.x - a.x)), y - (a.y + r * (b.y - a.y))) < d) return true;
    }
    return false;
  };
  const free = (x: number, y: number, road: number, gap: number) =>
    !nearRoad(x, y, road) && !nearSquare(x, y, road + 10) && !items.some((d) => Math.hypot(d.x - x, d.y - y) < gap + (d.kind === 'pond' ? 60 : 0));
  // 池は大きいので、先に、道から離れた場所に少しだけ置く
  for (let i = 0; i < 400 && items.filter((d) => d.kind === 'pond').length < 4; i++) {
    const x = 120 + rand() * (BOARD_WORLD.width - 240);
    const y = 120 + rand() * (BOARD_WORLD.height - 240);
    if (free(x, y, 120, 200)) items.push({ kind: 'pond', x, y, color: '#8fd3f4', size: 0.9 + rand() * 0.4 });
  }
  // 盤面の広さに合わせて、飾りの数を決める
  const want = Math.round((BOARD_WORLD.width * BOARD_WORLD.height) / 45000);
  for (let i = 0; i < want * 8 && items.length < want; i++) {
    const x = 40 + rand() * (BOARD_WORLD.width - 80);
    const y = 40 + rand() * (BOARD_WORLD.height - 80);
    const r = rand();
    const kind: Deco['kind'] = r < 0.3 ? 'tree' : r < 0.42 ? 'pine' : r < 0.62 ? 'house' : r < 0.74 ? 'flower' : r < 0.86 ? 'bush' : 'grass';
    if (!free(x, y, kind === 'grass' ? 60 : 70, kind === 'grass' ? 30 : 60)) continue;
    items.push({ kind, x, y, color: roofColors[Math.floor(rand() * roofColors.length)], size: 0.8 + rand() * 0.5 });
  }
  // 池と草は下に、ほかは奥（上）から順に描く
  const flat = (d: Deco) => (d.kind === 'pond' ? 0 : d.kind === 'grass' ? 1 : 2);
  return items.sort((a, b) => flat(a) - flat(b) || a.y - b.y);
}

const DECORATIONS = buildDecorations();

function Decoration({ d }: { d: Deco }) {
  const s = d.size;
  if (d.kind === 'tree') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
        <rect x="-5" y="4" width="10" height="20" rx="3" fill="#a0673a" />
        <circle cx="0" cy="-6" r="22" fill="#5cc275" />
        <circle cx="-9" cy="-12" r="9" fill="#7fd690" />
      </g>
    );
  }
  if (d.kind === 'pine') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
        <rect x="-4" y="10" width="8" height="14" rx="2" fill="#8a5a33" />
        <polygon points="0,-34 -20,0 20,0" fill="#3fa65c" />
        <polygon points="0,-20 -24,14 24,14" fill="#4cb86a" />
      </g>
    );
  }
  if (d.kind === 'bush') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
        <circle cx="-12" cy="4" r="12" fill="#6fcf7f" />
        <circle cx="10" cy="4" r="13" fill="#62c473" />
        <circle cx="0" cy="-6" r="14" fill="#7fd690" />
        <circle cx="-4" cy="-2" r="2.5" fill="#ff6b6b" />
        <circle cx="8" cy="-6" r="2.5" fill="#ff6b6b" />
      </g>
    );
  }
  if (d.kind === 'pond') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
        <ellipse rx="78" ry="44" fill="#b8e6c1" />
        <ellipse rx="66" ry="34" fill={d.color} />
        <ellipse cx="-18" cy="-10" rx="22" ry="6" fill="#fff" opacity="0.45" />
        <ellipse cx="34" cy="10" rx="9" ry="5" fill="#5cc275" />
        <circle cx="34" cy="8" r="2.5" fill="#ff9fc2" />
      </g>
    );
  }
  if (d.kind === 'grass') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`} stroke="#8fd19e" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M-8,6 L-10,-4 M-2,6 L-2,-8 M4,6 L7,-3" />
      </g>
    );
  }
  if (d.kind === 'house') {
    return (
      <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
        <rect x="-22" y="-8" width="44" height="32" rx="4" fill="#fff4dc" stroke="#e6d3ad" strokeWidth="2" />
        <polygon points="-28,-6 0,-30 28,-6" fill={d.color} />
        <rect x="-6" y="8" width="12" height="16" rx="2" fill="#c98b55" />
      </g>
    );
  }
  return (
    <g transform={`translate(${d.x} ${d.y}) scale(${s})`}>
      <circle cx="-8" cy="0" r="6" fill="#ff9fc2" />
      <circle cx="6" cy="-4" r="6" fill="#ffd166" />
      <circle cx="2" cy="7" r="6" fill="#ffffff" />
    </g>
  );
}

// ---------------------------------------------------------------- 盤面

interface Props {
  /** 駒がいるマス */
  position: number;
  /** ボーナスマスの目印が付いたマス */
  bonus?: number;
  /** true なら盤面全体を映す。false なら駒の周りを拡大して追いかける */
  overview: boolean;
  /** true なら、駒の周りの大きさのまま、盤面をドラッグして先を見られる（視点を移動。design.md 3.1） */
  pan?: boolean;
  /** 結婚しているか（結婚・出産マスの絵を、指輪から赤ちゃんに変える） */
  married?: boolean;
  /** あなたのキャラクター（design.md 10.1） */
  look?: Look;
  /** あなたの家族（駒のうしろに並ぶ） */
  family?: FamilyMember[];
  /** ライバルの駒（いるマス、キャラクター、家族。design.md 12.4） */
  others?: { position: number; look: Look; family?: FamilyMember[] }[];
  /** 映すマス（ライバルの番で、ライバルを追うとき）。なければ、あなたの駒を映す */
  focus?: number;
  /** 止まったばかりのマス（光らせる） */
  landed?: number;
  /** 駒の頭の上に浮かべる文字（お金の動き、もらったカード。design.md 10.1） */
  floats?: PieceFloat[];
  /** 分かれ道で選べる道（次のマス）。あれば、あなたの駒のマスから矢印を出す（design.md 3.11） */
  forks?: number[];
  onFork?: (to: number) => void;
}

/** 駒の頭の上に浮かべる文字 */
export interface PieceFloat {
  /** 何回目か（同じ文字でも、出すたびに動きをやり直すため） */
  key: number;
  /** どのマスの駒の上か */
  position: number;
  text: string;
  tone: 'plus' | 'minus' | 'card' | 'bonus';
  /** ライバルの分は小さめ */
  small?: boolean;
}

/** ボーナスマス。金色のマスに大きな星。光の輪とキラキラが回り、上に「BONUS ＋100万円」の札を立てる */
function BonusTile({ x, y, landed, overview }: { x: number; y: number; landed: boolean; overview: boolean }) {
  const r = SIZE / 2;
  return (
    // 全体図ではマスが小さいので、ボーナスマスだけ大きく描いて目立たせる
    <g transform={`translate(${x} ${y}) scale(${overview ? 1.9 : 1.18})`}>
      <circle className="bonus-glow" r={r + 16} fill="#ffe066" opacity="0.45" />
      <rect x={-r} y={-r + 6} width={SIZE} height={SIZE} rx="16" fill="rgba(0,0,0,0.16)" />
      <rect x={-r} y={-r} width={SIZE} height={SIZE} rx="16" fill="url(#bonus-gold)" stroke="#fff" strokeWidth="5" />
      <path
        d="M0,-26 L7.6,-10.5 L24.7,-8 L12.4,4 L15.3,21 L0,13 L-15.3,21 L-12.4,4 L-24.7,-8 L-7.6,-10.5 Z"
        fill="#fff8d6"
        stroke="#c98a00"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <g className="bonus-sparkles">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path key={deg} transform={`rotate(${deg}) translate(0 ${-r - 14})`} d="M0,-6 Q1,-1 6,0 Q1,1 0,6 Q-1,1 -6,0 Q-1,-1 0,-6 Z" fill="#fffbe6" stroke="#e0a800" strokeWidth="1" />
        ))}
      </g>
      {landed && <rect className="square-landed" x={-r - 4} y={-r - 4} width={SIZE + 8} height={SIZE + 8} rx="19" fill="none" stroke="#fff6a8" strokeWidth="6" />}
      <g transform={`translate(0 ${-r - 30})`}>
        <rect x="-68" y="-15" width="136" height="26" rx="13" fill="#ff4d6d" stroke="#fff" strokeWidth="3" />
        <text y="4" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">
          {`BONUS +${formatMoney(BONUS.amount)}`}
        </text>
      </g>
    </g>
  );
}

/** 人の駒（キャラクター）。家族は、うしろに小さく並んで一緒に歩く（design.md 10.1） */
function Piece({ x, y, look, family = [] }: { x: number; y: number; look: Look; family?: FamilyMember[] }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y - 40}px)`, transition: 'transform 0.22s ease-out' }}>
      {/* マスが変わるたびに作り直して、ぴょんと跳ねる動きをやり直す */}
      <g key={`${x},${y}`} className="piece-hop">
      {/* 遠くの家族から描き、近い家族が手前に重なるようにする。足もとの高さをそろえる */}
      {family
        .map((m, j) => (
          <g key={j} transform={`translate(${-30 - j * 19} ${(1 - m.scale) * 52})`}>
            <AvatarBody look={m.look} scale={m.scale} />
          </g>
        ))
        .reverse()}
      <AvatarBody look={look} />
      </g>
    </g>
  );
}

// 盤面の枠は画面より縦長になることが多く、そのときは左右が切れて映る（slice）。
// 全体図では、切れても全部が入るように、横は OVERVIEW_WIDTH の幅に収める
const FIT = Math.min(OVERVIEW_WIDTH / BOARD_WORLD.width, VIEW.height / BOARD_WORLD.height);

/** 全体図での映し方（拡大の倍率と、ずらす量） */
type Camera = { scale: number; tx: number; ty: number };

/** 全体図を開いたときの映し方（盤面の全体が入る） */
function fitCamera(): Camera {
  return { scale: FIT, tx: (VIEW.width - BOARD_WORLD.width * FIT) / 2, ty: (VIEW.height - BOARD_WORLD.height * FIT) / 2 };
}

/** 倍率を、全体が入る大きさから「駒を追う」大きさまでに収め、盤面の真ん中が画面から出ないようにする */
function clampCamera(c: Camera): Camera {
  const scale = Math.min(FOLLOW_SCALE, Math.max(FIT, c.scale));
  const w = BOARD_WORLD.width * scale;
  const h = BOARD_WORLD.height * scale;
  const tx = Math.min(VIEW.width / 2, Math.max(VIEW.width / 2 - w, c.tx));
  const ty = Math.min(VIEW.height / 2, Math.max(VIEW.height / 2 - h, c.ty));
  return { scale, tx, ty };
}

/** 画面上の点 (px, py) を中心に、factor 倍に拡大・縮小する */
function zoomAt(c: Camera, factor: number, px: number, py: number): Camera {
  const scale = Math.min(FOLLOW_SCALE, Math.max(FIT, c.scale * factor));
  const r = scale / c.scale;
  return clampCamera({ scale, tx: px - (px - c.tx) * r, ty: py - (py - c.ty) * r });
}

export function Board({ position, overview, pan = false, bonus, married, look = PLAYER_LOOKS[0], family = [], others = [], focus, landed, floats = [], forks = [], onFork }: Props) {
  const here = BOARD[focus ?? position];
  const svgRef = useRef<SVGSVGElement>(null);
  // 全体図での映し方。開くたびに、全体が入る大きさから始める（design.md 3.1）
  const [camera, setCamera] = useState<Camera>(fitCamera);
  /** ドラッグやつまむ操作の途中か（途中は、なめらかに動かす演出を止める） */
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  useEffect(() => {
    if (overview) setCamera(fitCamera());
    // 視点を移動: 駒の周りの大きさのまま、今の駒の場所から始める
    else if (pan) setCamera({ scale: FOLLOW_SCALE, tx: VIEW.width / 2 - here.x * FOLLOW_SCALE, ty: VIEW.height / 2 - here.y * FOLLOW_SCALE });
  }, [overview, pan]);
  /** ドラッグで動かせる（全体図か、視点を移動の間） */
  const free = overview || pan;

  /** 画面上の位置を、盤面の枠（viewBox）の中の位置にする */
  const toView = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: clientX, y: clientY };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  // マウスのホイールで拡大・縮小する。ページが動かないよう、自分で受け取る
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !overview) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toView(e.clientX, e.clientY);
      setCamera((c) => zoomAt(c, e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [overview]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!free) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toView(e.clientX, e.clientY));
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const map = pointers.current;
    const before = map.get(e.pointerId);
    if (!free || !before) return;
    const now = toView(e.clientX, e.clientY);
    if (map.size >= 2) {
      // 2本の指でつまむ: 指の間の長さの変わり方で拡大・縮小し、指の真ん中の動きでずらす
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(before.x - other.x, before.y - other.y);
      const d1 = Math.hypot(now.x - other.x, now.y - other.y);
      const mid = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
      const shift = { x: (now.x - before.x) / 2, y: (now.y - before.y) / 2 };
      if (d0 > 0 && overview) setCamera((c) => zoomAt({ ...c, tx: c.tx + shift.x, ty: c.ty + shift.y }, d1 / d0, mid.x, mid.y));
    } else {
      setCamera((c) => clampCamera({ ...c, tx: c.tx + now.x - before.x, ty: c.ty + now.y - before.y }));
    }
    map.set(e.pointerId, now);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const scale = free ? camera.scale : FOLLOW_SCALE;
  const tx = free ? camera.tx : VIEW.width / 2 - here.x * scale;
  const ty = free ? camera.ty : VIEW.height / 2 - here.y * scale;
  const road = ROUTE_POINTS.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t('app.title')}
        className={free ? 'board-overview' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <linearGradient id="bonus-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe27a" />
            <stop offset="1" stopColor="#f5a800" />
          </linearGradient>
        </defs>
        <rect width={VIEW.width} height={VIEW.height} fill="#bfe8c8" />
        <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: dragging ? 'none' : 'transform 0.3s ease', transformOrigin: '0 0' }}>
          <rect width={BOARD_WORLD.width} height={BOARD_WORLD.height} rx="40" fill="#c9eccf" />
          {DECORATIONS.map((d, i) => (
            <Decoration key={i} d={d} />
          ))}
          <polyline points={road} fill="none" stroke="#d9bf8c" strokeWidth="110" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={road} fill="none" stroke="#efdcae" strokeWidth="102" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={road} fill="none" stroke="#f8ecd0" strokeWidth="88" strokeLinejoin="round" strokeLinecap="round" />
          {/* 分かれた道（design.md 3.11）。外周より少し細く、道ごとの色にする */}
          {BRANCH_LINES.map((line, i) => {
            const pts = line.points.map((p) => `${p.x},${p.y}`).join(' ');
            const c = ROUTE_COLORS[line.route];
            return (
              <g key={i}>
                <polyline points={pts} fill="none" stroke={c.edge} strokeWidth="98" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pts} fill="none" stroke={c.road} strokeWidth="80" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {/* 立体交差の橋の手すり（投資の道がハイリスクの道の上を渡る。曲がれない） */}
          <g transform={`translate(${CROSSING.x} ${CROSSING.y})`}>
            <rect x="-62" y="-52" width="124" height="10" rx="5" fill="#8fd6cd" stroke="#fff" strokeWidth="3" />
            <rect x="-62" y="42" width="124" height="10" rx="5" fill="#8fd6cd" stroke="#fff" strokeWidth="3" />
          </g>
          {/* 進む向きの印（一方通行だと分かるように） */}
          {CHEVRONS.map((c) => (
            <path key={c.key} d="M-7,-11 L5,0 L-7,11" transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`} fill="none" stroke={c.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          ))}
          {BOARD.filter((sq) => sq.id !== bonus).map((sq) => (
            <g key={sq.id} transform={`translate(${sq.x} ${sq.y})`}>
              <rect x={-SIZE / 2} y={-SIZE / 2 + 6} width={SIZE} height={SIZE} rx="16" fill="rgba(0,0,0,0.14)" />
              <rect x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={SIZE} rx="16" fill={SQUARE_COLORS[sq.type]} stroke="#fff" strokeWidth="5" />
              {/* 上のほうを少し明るくして、ふっくらした見た目にする */}
              <path d={`M${-SIZE / 2 + 6},${-SIZE / 2 + 18} Q${-SIZE / 2 + 6},${-SIZE / 2 + 6} ${-SIZE / 2 + 18},${-SIZE / 2 + 6} L${SIZE / 2 - 18},${-SIZE / 2 + 6} Q${SIZE / 2 - 6},${-SIZE / 2 + 6} ${SIZE / 2 - 6},${-SIZE / 2 + 18} L${SIZE / 2 - 6},-4 L${-SIZE / 2 + 6},-4 Z`} fill="#fff" opacity="0.16" />
              <SquareIcon type={sq.type} married={married} />
              {sq.id === landed && (
                <rect className="square-landed" x={-SIZE / 2 - 4} y={-SIZE / 2 - 4} width={SIZE + 8} height={SIZE + 8} rx="19" fill="none" stroke="#fff6a8" strokeWidth="6" />
              )}
              {sq.type === 'start' && (
                <text y={-SIZE / 2 - 10} textAnchor="middle" fontSize="20" fontWeight="900" fill="#b36b00">
                  START
                </text>
              )}
            </g>
          ))}
          {/* ボーナスマスは、元のマスの見た目を残さず、専用の見た目で、ほかのマスより手前に少し大きく描く（design.md 3.10） */}
          {bonus !== undefined && BOARD[bonus] && <BonusTile x={BOARD[bonus].x} y={BOARD[bonus].y} landed={landed === bonus} overview={overview} />}
          {/* 道案内の看板（マスより手前、駒よりうしろ） */}
          {FORKS.map(({ sq, spot }) => (
            <Signpost key={`sign-${sq.id}`} sq={sq} x={spot.x} y={spot.y} />
          ))}
          {/* 同じマスにいる駒は、横に少しずらして重ならないようにする。あなたの駒は一番手前 */}
          {[...others.map((o) => ({ ...o, me: false })), { position, look, family, me: true }].map((piece, k, all) => {
            const sq = BOARD[piece.position];
            const same = all.filter((o) => o.position === piece.position);
            const shift = same.length > 1 ? (same.indexOf(piece) - (same.length - 1) / 2) * 30 : 0;
            return <Piece key={piece.me ? 'me' : k} x={sq.x + shift} y={sq.y} look={piece.look} family={piece.family} />;
          })}
          {/* 分かれ道の矢印（文字は出さない）。押すと、その道へ進む。色は看板の矢印と同じ */}
          {forks.map((to) => {
            const here = BOARD[position];
            const next = BOARD[to];
            const angle = (Math.atan2(next.y - here.y, next.x - here.x) * 180) / Math.PI;
            const mx = here.x + (next.x - here.x) * 0.55;
            const my = here.y + (next.y - here.y) * 0.55;
            return (
              <g key={`fork-${to}`} transform={`translate(${mx} ${my}) rotate(${angle})`} className="fork-arrow" onClick={() => onFork?.(to)} role="button" aria-label={t('fork.title')}>
                <g className="fork-arrow-pulse">
                  <path d="M-30,-16 L6,-16 L6,-32 L40,0 L6,32 L6,16 L-30,16 Z" fill={ROUTE_COLORS[edgeRoute(here, next)].arrow} stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
                </g>
              </g>
            );
          })}
          {/* 駒の頭の上の文字。全体図では駒が小さいので出さない */}
          {!overview &&
            floats.map((f) => {
              const sq = BOARD[f.position];
              if (!sq) return null;
              // 同じ駒の上にいくつも出ているときは、新しいものを下にして、古いものを上に押し上げる
              const same = floats.filter((o) => o.position === f.position);
              const above = same.length - 1 - same.indexOf(f);
              return (
                <g key={f.key} style={{ transform: `translate(${sq.x}px, ${sq.y - 112 - above * 40}px)`, transition: 'transform 0.3s ease-out' }}>
                  <g className={`piece-float ${f.tone}${f.small ? ' small' : ''}`}>
                    <text textAnchor="middle" fontSize={f.small ? 22 : f.tone === 'bonus' ? 36 : 30} fontWeight="900">
                      {f.text}
                    </text>
                  </g>
                </g>
              );
            })}
        </g>
      </svg>
      {overview && (
        <div className="board-zoom">
          <button className="secondary" aria-label={t('board.zoomIn')} title={t('board.zoomIn')} onClick={() => setCamera((c) => zoomAt(c, 1.5, VIEW.width / 2, VIEW.height / 2))}>
            ＋
          </button>
          <button className="secondary" aria-label={t('board.zoomOut')} title={t('board.zoomOut')} onClick={() => setCamera((c) => zoomAt(c, 1 / 1.5, VIEW.width / 2, VIEW.height / 2))}>
            −
          </button>
        </div>
      )}
    </>
  );
}
