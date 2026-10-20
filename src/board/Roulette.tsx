// ルーレット。出目はゲームのルール側（engine.roll）で決め、ここは見せるだけ。
// あとでサイコロの見た目に差し替えられるよう、出目と見た目を分けている。

import { useEffect, useRef, useState } from 'react';
import { ROULETTE_MAX } from '../data/rules';
import { t } from '../i18n';

/** 盤が回る時間（ミリ秒）。App の待ち時間と合わせる */
export const SPIN_DURATION_MS = 2200;

const COLORS = ['#ff6b6b', '#ffb703', '#2ec4b6', '#4d96ff', '#9b5de5', '#ff6b9a', '#f9a03f', '#00bbf9'];
const R = 90;

interface Props {
  /** 出目（1から）。回り始めるときに決まっている */
  value: number | null;
  spinning: boolean;
  canSpin: boolean;
  onSpin: () => void;
  /** 盤に書く文字。なければ 1〜ROULETTE_MAX の数字 */
  labels?: string[];
  /** 回すボタンの文字 */
  buttonLabel?: string;
  /** 止まったあとに出す文字。なければ「n マス進む」 */
  resultLabel?: string;
  /** 大きく表示する（職業のルーレット） */
  large?: boolean;
}

export function Roulette({ value, spinning, canSpin, onSpin, labels, buttonLabel, resultLabel, large }: Props) {
  const names = labels ?? Array.from({ length: ROULETTE_MAX }, (_, i) => String(i + 1));
  const count = names.length;
  /** n 番目が真上の矢印の下に来る角度 */
  const angleFor = (n: number) => -((n - 0.5) * 360) / count;
  const [rotation, setRotation] = useState(0);
  const turns = useRef(0);

  useEffect(() => {
    if (!spinning || value === null) return;
    turns.current += 5;
    const wobble = (Math.random() - 0.5) * (300 / count);
    setRotation(turns.current * 360 + angleFor(value) + wobble);
    // angleFor は count だけで決まるので、依存には入れていない
  }, [spinning, value]);

  const step = 360 / count;
  const long = names.some((n) => n.length > 2);
  const sectors = Array.from({ length: count }, (_, i) => {
    const a0 = ((i * step - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * step - 90) * Math.PI) / 180;
    const mid = (((i + 0.5) * step - 90) * Math.PI) / 180;
    return {
      n: i + 1,
      label: names[i],
      d: `M0,0 L${R * Math.cos(a0)},${R * Math.sin(a0)} A${R},${R} 0 0 1 ${R * Math.cos(a1)},${R * Math.sin(a1)} Z`,
      tx: R * 0.62 * Math.cos(mid),
      ty: R * 0.62 * Math.sin(mid),
      color: COLORS[i % COLORS.length],
    };
  });

  return (
    <div className={`roulette${large ? ' large' : ''}`}>
      <svg viewBox="-110 -120 220 230" width="190" height="200" aria-label={buttonLabel ?? t('roll.button')}>
        <circle r={R + 12} fill="#fff" stroke="#e6d3ad" strokeWidth="4" />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)` : 'none',
          }}
        >
          {sectors.map((s) => (
            <g key={s.n}>
              <path d={s.d} fill={s.color} stroke="#fff" strokeWidth="3" />
              <text
                x={s.tx}
                y={s.ty + (long ? 5 : 11)}
                textAnchor="middle"
                fontSize={long ? 13 : 32}
                fontWeight="900"
                fill="#fff"
                transform={long ? `rotate(${(s.n - 0.5) * step} ${s.tx} ${s.ty})` : undefined}
              >
                {s.label}
              </text>
            </g>
          ))}
        </g>
        <circle r="16" fill="#fff" stroke="#e6d3ad" strokeWidth="4" />
        <polygon points="-14,-112 14,-112 0,-86" fill="#2d2a32" stroke="#fff" strokeWidth="3" />
      </svg>
      {!spinning && value !== null && !canSpin && (
        <div className="roll-result">{resultLabel ?? t('roll.result', { n: value })}</div>
      )}
      {canSpin && <button onClick={onSpin}>{buttonLabel ?? t('roll.button')}</button>}
    </div>
  );
}
