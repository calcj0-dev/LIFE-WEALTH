// お金の数字。増えたら緑、減ったら赤に光り、動いた金額が浮かび上がる（design.md 2.2、0.1）。
// 凝った演出は段階4で作る。

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../i18n';

/** 浮かび上がる金額を出す時間（ミリ秒） */
const FLOAT_MS = 1400;

export function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; key: number } | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    // 1万円より小さい動きは出さない（千円以下は扱わない）
    if (Math.round(d) === 0) return;
    setDelta({ v: d, key: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDelta(null), FLOAT_MS);
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tone = delta ? (delta.v > 0 ? ' flash-up' : ' flash-down') : '';
  return (
    <span className={`animated-money${tone}${className ? ` ${className}` : ''}`} key={delta?.key}>
      {formatMoney(value)}
      {delta && (
        <span className={`money-float ${delta.v > 0 ? 'plus' : 'minus'}`}>
          {delta.v > 0 ? '+' : ''}
          {formatMoney(delta.v)}
        </span>
      )}
    </span>
  );
}
