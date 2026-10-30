// ボーナスゲットの演出（design.md 3.10。v0.13.2）。だれが取っても同じ演出で、盤面の上に大きく出す。
// 約3秒で自動で終わる（「動きを減らす」設定の人には、文字だけを約2秒）。

import { useEffect, useRef, type CSSProperties } from 'react';
import { formatMoney, t } from '../i18n';
import { Confetti } from './Confetti';
import { sfx } from './sound';

/** 演出の長さ */
const CELEBRATE_MS = 3000;
const CELEBRATE_REDUCED_MS = 2000;
/** ライバルのとき、「キラキラ♪」のあとに「ガーン」を鳴らすまでの間 */
const TAKEN_SOUND_DELAY_MS = 900;
/** 飛び散るコインの数 */
const COINS = 12;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function BonusCelebration({ name, amount, rival, onDone }: { name: string; amount: number; /** ライバルが取ったとき（くやしい効果音を足す） */ rival: boolean; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const reduced = reducedMotion();
  useEffect(() => {
    sfx.bonus();
    const taken = rival ? window.setTimeout(() => sfx.bonusTaken(), TAKEN_SOUND_DELAY_MS) : 0;
    const end = window.setTimeout(() => done.current(), reduced ? CELEBRATE_REDUCED_MS : CELEBRATE_MS);
    return () => {
      window.clearTimeout(taken);
      window.clearTimeout(end);
    };
  }, []);
  return (
    <div className="bonus-celebration" role="status">
      {!reduced && (
        <>
          <Confetti count={70} seed={amount + name.length} />
          <div className="bonus-burst" />
          {Array.from({ length: COINS }, (_, i) => {
            const a = (i / COINS) * Math.PI * 2;
            return <span key={i} className="bonus-coin" style={{ '--dx': `${Math.cos(a) * 260}px`, '--dy': `${Math.sin(a) * 180}px`, animationDelay: `${(i % 3) * 0.08}s` } as CSSProperties} />;
          })}
        </>
      )}
      <div className="bonus-celebration-card">
        <div className="bonus-celebration-star">★</div>
        <div className="bonus-celebration-title">{t('bonus.celebrate', { name })}</div>
        <div className="bonus-celebration-amount">+{formatMoney(amount)}</div>
      </div>
    </div>
  );
}
