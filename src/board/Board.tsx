// 盤面。ほかの画面から切り離した部品にして、あとで Phaser に差し替えられるようにする（design.md 11章）。
// 段階2では簡単な表示。桃鉄風の地図とスクロールは段階4で作る。

import { BOARD } from '../data/board';
import type { SquareType } from '../game/types';
import { t } from '../i18n';

export const SQUARE_COLORS: Record<SquareType, string> = {
  start: 'var(--yellow)',
  stopMarriage: 'var(--pink)',
  life: 'var(--blue)',
  good: 'var(--good)',
  bad: 'var(--bad)',
  gamble: 'var(--purple)',
  insurance: 'var(--sky)',
  realEstate: 'var(--orange)',
};

const SIZE = 46;

interface Props {
  /** 駒がいるマス */
  position: number;
}

export function Board({ position }: Props) {
  const here = BOARD[position];
  const route = BOARD.map((sq) => `${sq.x},${sq.y}`).join(' ');
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('app.title')}>
      <polygon points={route} fill="none" stroke="#c9e4d3" strokeWidth="26" strokeLinejoin="round" />
      {BOARD.map((sq) => (
        <g key={sq.id}>
          <rect
            x={sq.x - SIZE / 2}
            y={sq.y - SIZE / 2}
            width={SIZE}
            height={SIZE}
            rx="10"
            fill={SQUARE_COLORS[sq.type]}
            stroke="#fff"
            strokeWidth="4"
          />
          <text x={sq.x} y={sq.y + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
            {t(`squareMark.${sq.type}`)}
          </text>
        </g>
      ))}
      <g style={{ transform: `translate(${here.x}px, ${here.y - 46}px)`, transition: 'transform 0.25s ease' }}>
        <ellipse cx="0" cy="44" rx="16" ry="5" fill="rgba(0,0,0,0.18)" />
        <rect x="-13" y="6" width="26" height="34" rx="12" fill="var(--primary)" stroke="#fff" strokeWidth="3" />
        <circle cx="0" cy="-6" r="13" fill="#ffd9b8" stroke="#fff" strokeWidth="3" />
      </g>
    </svg>
  );
}
