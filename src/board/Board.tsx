// 盤面。ほかの画面から切り離した部品にして、あとで Phaser に差し替えられるようにする（design.md 11章）。
// 曲がりくねった道に色とりどりのマスが並び、まわりに家や木がある、にぎやかな盤面（design.md 3.1）。

import { BOARD, BOARD_WORLD, ROUTE_POINTS } from '../data/board';
import type { SquareType } from '../game/types';
import { t } from '../i18n';

export const SQUARE_COLORS: Record<SquareType, string> = {
  start: '#ffb703',
  stopMarriage: '#ff6b9a',
  birth: '#ff9fc2',
  small: '#8ecae6',
  card: '#ffd166',
  luckyCard: '#ffb703',
  medium: '#4d96ff',
  large: '#3a0ca3',
  stock: '#2ec4b6',
  investTalk: '#ff6b6b',
  gamble: '#9b5de5',
  realEstate: '#f9a03f',
};

export const SQUARE_ICONS: Record<SquareType, string> = {
  start: '🏁',
  stopMarriage: '💍',
  birth: '👶',
  small: '🪙',
  card: '🃏',
  luckyCard: '🍀',
  medium: '⭐',
  large: '🌟',
  stock: '📈',
  investTalk: '🗣️',
  gamble: '🎰',
  realEstate: '🏠',
};

const SIZE = 74;
/** 画面に映す範囲の大きさ（駒を追うとき） */
const VIEW = { width: 1000, height: 560 };
const FOLLOW_SCALE = 1;

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
  for (let i = 0; i < 400 && items.length < 70; i++) {
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
}

export function Board({ position, overview, bonus }: Props) {
  const here = BOARD[position];
  const fit = Math.min(VIEW.width / BOARD_WORLD.width, VIEW.height / BOARD_WORLD.height);
  const scale = overview ? fit : FOLLOW_SCALE;
  const tx = overview ? (VIEW.width - BOARD_WORLD.width * fit) / 2 : VIEW.width / 2 - here.x * scale;
  const ty = overview ? (VIEW.height - BOARD_WORLD.height * fit) / 2 : VIEW.height / 2 - here.y * scale;
  const road = ROUTE_POINTS.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={t('app.title')}>
      <rect width={VIEW.width} height={VIEW.height} fill="#bfe8c8" />
      <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: 'transform 0.45s ease', transformOrigin: '0 0' }}>
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
            <text y="12" textAnchor="middle" fontSize="34">
              {SQUARE_ICONS[sq.type]}
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
        <g style={{ transform: `translate(${here.x}px, ${here.y - 40}px)`, transition: 'transform 0.22s ease-out' }}>
          <ellipse cx="0" cy="52" rx="22" ry="7" fill="rgba(0,0,0,0.2)" />
          <rect x="-17" y="8" width="34" height="42" rx="15" fill="#ff7a45" stroke="#fff" strokeWidth="4" />
          <circle cx="0" cy="-8" r="17" fill="#ffd9b8" stroke="#fff" strokeWidth="4" />
          <path d="M-17,-12 Q0,-34 17,-12 Z" fill="#5a3b2e" />
          <circle cx="-6" cy="-6" r="2.5" fill="#2d2a32" />
          <circle cx="6" cy="-6" r="2.5" fill="#2d2a32" />
        </g>
      </g>
    </svg>
  );
}
