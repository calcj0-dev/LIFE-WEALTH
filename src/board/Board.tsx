// 盤面。ほかの画面から切り離した部品にして、あとで Phaser に差し替えられるようにする（design.md 11章）。
// 曲がりくねった道に色とりどりのマスが並び、まわりに家や木がある、にぎやかな盤面（design.md 3.1）。

import { useEffect, useRef, useState } from 'react';
import { PLAYER_LOOKS, type FamilyMember, type Look } from '../data/characters';
import { AvatarBody } from './Avatar';
import { BOARD, BOARD_WORLD, ROUTE_POINTS } from '../data/board';
import type { SquareType } from '../game/types';
import { t } from '../i18n';

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
  card: '#8ecae6',
  luckyCard: '#4d96ff',
  stock: '#2ec4b6',
  investTalk: '#6c7a89',
  gamble: '#9b5de5',
  realEstate: '#f9a03f',
};

export const SQUARE_ICONS: Record<SquareType, string> = {
  start: '🏁',
  family: '💍',
  // 出来事の大きさ（小・中・大）は、絵の数で見せる
  plusSmall: '🪙',
  plusMedium: '🪙🪙',
  plusLarge: '🪙🪙🪙',
  minusSmall: '💸',
  minusMedium: '💸💸',
  minusLarge: '💸💸💸',
  chance: '✨',
  card: '🃏',
  luckyCard: '🍀',
  stock: '📈',
  investTalk: '🗣️',
  gamble: '🎰',
  realEstate: '🏠',
};

const SIZE = 74;
/** マスの絵の数（出来事の大きさ）と、その文字の大きさ */
const SQUARE_ICON_COUNT = (type: SquareType) => (type.endsWith('Large') ? 3 : type.endsWith('Medium') ? 2 : 1);
const ICON_FONT: Record<number, { size: number; y: number }> = { 1: { size: 34, y: 12 }, 2: { size: 26, y: 9 }, 3: { size: 19, y: 7 } };
/** 画面に映す範囲の大きさ（駒を追うとき） */
const VIEW = { width: 1000, height: 560 };
const FOLLOW_SCALE = 1;
/** 全体図で、盤面を収める横の幅（PC やスマホの横向きの枠で、左右が切れても見える幅） */
const OVERVIEW_WIDTH = 780;

// ---------------------------------------------------------------- 背景の飾り（毎回同じ配置）

type Deco = { kind: 'tree' | 'house' | 'flower'; x: number; y: number; color: string; size: number };

function buildDecorations(): Deco[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roofColors = ['#ff6b6b', '#4d96ff', '#ffb703', '#9b5de5', '#2ec4b6'];
  const items: Deco[] = [];
  const nearSquare = (x: number, y: number, d: number) => BOARD.some((sq) => Math.hypot(sq.x - x, sq.y - y) < d);
  const nearRoad = (x: number, y: number) => {
    for (let i = 1; i < ROUTE_POINTS.length; i++) {
      const a = ROUTE_POINTS[i - 1];
      const b = ROUTE_POINTS[i];
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const r = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / len2));
      if (Math.hypot(x - (a.x + r * (b.x - a.x)), y - (a.y + r * (b.y - a.y))) < 70) return true;
    }
    return false;
  };
  // 盤面の広さに合わせて、飾りの数を決める
  const want = Math.round((BOARD_WORLD.width * BOARD_WORLD.height) / 60000);
  for (let i = 0; i < want * 6 && items.length < want; i++) {
    const x = 40 + rand() * (BOARD_WORLD.width - 80);
    const y = 40 + rand() * (BOARD_WORLD.height - 80);
    if (nearRoad(x, y) || nearSquare(x, y, 80) || items.some((d) => Math.hypot(d.x - x, d.y - y) < 60)) continue;
    const r = rand();
    items.push({
      kind: r < 0.5 ? 'tree' : r < 0.8 ? 'house' : 'flower',
      x,
      y,
      color: roofColors[Math.floor(rand() * roofColors.length)],
      size: 0.8 + rand() * 0.5,
    });
  }
  return items.sort((a, b) => a.y - b.y);
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
}

/** 人の駒（キャラクター）。家族は、うしろに小さく並んで一緒に歩く（design.md 10.1） */
function Piece({ x, y, look, family = [] }: { x: number; y: number; look: Look; family?: FamilyMember[] }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y - 40}px)`, transition: 'transform 0.22s ease-out' }}>
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

export function Board({ position, overview, bonus, married, look = PLAYER_LOOKS[0], family = [], others = [], focus }: Props) {
  const here = BOARD[focus ?? position];
  const svgRef = useRef<SVGSVGElement>(null);
  // 全体図での映し方。開くたびに、全体が入る大きさから始める（design.md 3.1）
  const [camera, setCamera] = useState<Camera>(fitCamera);
  /** ドラッグやつまむ操作の途中か（途中は、なめらかに動かす演出を止める） */
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  useEffect(() => {
    if (overview) setCamera(fitCamera());
  }, [overview]);

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
    if (!overview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toView(e.clientX, e.clientY));
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const map = pointers.current;
    const before = map.get(e.pointerId);
    if (!overview || !before) return;
    const now = toView(e.clientX, e.clientY);
    if (map.size >= 2) {
      // 2本の指でつまむ: 指の間の長さの変わり方で拡大・縮小し、指の真ん中の動きでずらす
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(before.x - other.x, before.y - other.y);
      const d1 = Math.hypot(now.x - other.x, now.y - other.y);
      const mid = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
      const shift = { x: (now.x - before.x) / 2, y: (now.y - before.y) / 2 };
      if (d0 > 0) setCamera((c) => zoomAt({ ...c, tx: c.tx + shift.x, ty: c.ty + shift.y }, d1 / d0, mid.x, mid.y));
    } else {
      setCamera((c) => clampCamera({ ...c, tx: c.tx + now.x - before.x, ty: c.ty + now.y - before.y }));
    }
    map.set(e.pointerId, now);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const scale = overview ? camera.scale : FOLLOW_SCALE;
  const tx = overview ? camera.tx : VIEW.width / 2 - here.x * scale;
  const ty = overview ? camera.ty : VIEW.height / 2 - here.y * scale;
  const road = ROUTE_POINTS.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t('app.title')}
        className={overview ? 'board-overview' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect width={VIEW.width} height={VIEW.height} fill="#bfe8c8" />
        <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: dragging ? 'none' : 'transform 0.3s ease', transformOrigin: '0 0' }}>
          <rect width={BOARD_WORLD.width} height={BOARD_WORLD.height} rx="40" fill="#c9eccf" />
          {DECORATIONS.map((d, i) => (
            <Decoration key={i} d={d} />
          ))}
          <polyline points={road} fill="none" stroke="#e9d3a5" strokeWidth="104" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={road} fill="none" stroke="#f6e7c4" strokeWidth="92" strokeLinejoin="round" strokeLinecap="round" />
          {BOARD.map((sq) => (
            <g key={sq.id} transform={`translate(${sq.x} ${sq.y})`}>
              <rect x={-SIZE / 2} y={-SIZE / 2 + 5} width={SIZE} height={SIZE} rx="16" fill="rgba(0,0,0,0.12)" />
              <rect x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={SIZE} rx="16" fill={SQUARE_COLORS[sq.type]} stroke="#fff" strokeWidth="5" />
              <text y={ICON_FONT[SQUARE_ICON_COUNT(sq.type)].y} textAnchor="middle" fontSize={ICON_FONT[SQUARE_ICON_COUNT(sq.type)].size}>
                {sq.type === 'family' && married ? '👶' : SQUARE_ICONS[sq.type]}
              </text>
              {sq.id === bonus && (
                <g>
                  <rect x={-SIZE / 2 - 6} y={-SIZE / 2 - 6} width={SIZE + 12} height={SIZE + 12} rx="20" fill="none" stroke="#ff4d6d" strokeWidth="6" strokeDasharray="10 6" />
                  <text y={-SIZE / 2 - 12} textAnchor="middle" fontSize="20" fontWeight="900" fill="#ff4d6d">
                    BONUS
                  </text>
                </g>
              )}
              {sq.type === 'start' && (
                <text y={-SIZE / 2 - 10} textAnchor="middle" fontSize="20" fontWeight="900" fill="#b36b00">
                  START
                </text>
              )}
            </g>
          ))}
          {/* 同じマスにいる駒は、横に少しずらして重ならないようにする。あなたの駒は一番手前 */}
          {[...others.map((o) => ({ ...o, me: false })), { position, look, family, me: true }].map((piece, k, all) => {
            const sq = BOARD[piece.position];
            const same = all.filter((o) => o.position === piece.position);
            const shift = same.length > 1 ? (same.indexOf(piece) - (same.length - 1) / 2) * 30 : 0;
            return <Piece key={piece.me ? 'me' : k} x={sq.x + shift} y={sq.y} look={piece.look} family={piece.family} />;
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
