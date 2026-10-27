// お金の数字。増えたら緑、減ったら赤に光り、動いた金額が浮かび上がる（design.md 2.2）。
// 光り方は3段階（弱・中・強）。凝った演出は段階4で作る。

import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../game/types';
import { formatMoney } from '../i18n';
import { sfx } from './sound';

export type MoneyLevel = 'weak' | 'medium' | 'strong';

/** 浮かび上がる金額を出す時間（ミリ秒） */
const FLOAT_MS = 1400;
/** 1回でこの割合以上動いたら、出来事の種類にかかわらず「強」にする */
const STRONG_SHARE = 0.1;

/**
 * 新しく増えた記録から、光り方の強さを決める。
 * 強: ニュース、大きなイベント。中: マスの出来事、ボーナスマス、売り買い、カード、投資の話など。弱: それ以外（お給料、生活費、ふつうの値動き）
 */
export function moneyLevelOf(entries: LogEntry[]): MoneyLevel {
  if (entries.some((e) => e.key === 'news.happened' || e.key.startsWith('bigEvent.'))) return 'strong';
  if (entries.some((e) => e.cash !== undefined || e.notice || e.key.startsWith('trade.'))) return 'medium';
  return 'weak';
}

export function AnimatedMoney({
  value,
  level = 'medium',
  className,
  label,
  sound,
  float = true,
}: {
  value: number;
  level?: MoneyLevel;
  className?: string;
  /** 浮かぶ金額に添える言葉（例: お給料） */
  label?: string;
  /** 動いたときに音を鳴らす（銀行預金の数字だけ） */
  sound?: boolean;
  /** false なら、浮かぶ金額とコインを出さない（光るだけ。金額は駒の頭の上に出す。design.md 10.1） */
  float?: boolean;
}) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; level: MoneyLevel; key: number; label?: string } | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    const before = prev.current;
    const d = value - before;
    prev.current = value;
    // 1万円より小さい動きは出さない（千円以下は扱わない）
    if (Math.round(d) === 0) return;
    const big = Math.abs(before) >= 1 && Math.abs(d) >= Math.abs(before) * STRONG_SHARE;
    const shown = big && !label ? 'strong' : level;
    setDelta({ v: d, level: shown, key: Date.now(), label });
    // 給料と生活費のアクション（label あり）は毎月なので、音は鳴らさない（240回聞くとうるさいため）
    if (sound && !label && shown !== 'weak') (d > 0 ? sfx.coin : sfx.loss)();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDelta(null), FLOAT_MS);
    // level と label は value と一緒に変わるので、依存には入れていない
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tone = delta ? ` flash-${delta.level}-${delta.v > 0 ? 'up' : 'down'}` : '';
  return (
    <span className={`animated-money${tone}${className ? ` ${className}` : ''}`} key={delta?.key}>
      {formatMoney(value)}
      {float && delta && delta.level !== 'weak' && delta.v > 0 && (
        <span className="coin-burst" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {float && delta && delta.level !== 'weak' && (
        <span className={`money-float ${delta.v > 0 ? 'plus' : 'minus'}${delta.level === 'strong' ? ' strong' : ''}`}>
          {delta.v > 0 ? '+' : ''}
          {formatMoney(delta.v)}
          {delta.label && ` ${delta.label}`}
        </span>
      )}
    </span>
  );
}
