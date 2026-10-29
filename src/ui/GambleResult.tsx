// ギャンブルの結果の画面（design.md 3.7。段階8）。短い動きのあと、結果を大きく出し、賭けた金額と戻ってきた金額を見せる。
// 結果はゲームの計算（engine.ts）で、確率でもう決まっている。動きは結果に合わせた見せ方だけ。

import { useEffect, useState, type CSSProperties } from 'react';
import type { GambleResult } from '../game/types';
import { formatMoney, t } from '../i18n';
import { Confetti } from './Confetti';
import { MoneyDelta } from './Delta';
import { sfx } from './sound';

/** 動きの長さ */
const ANIMATION_MS = 2200;

type Grade = 'jackpot' | 'win' | 'some' | 'lose';

export function gradeOf(r: GambleResult): Grade {
  if (r.multiplier >= 10) return 'jackpot';
  if (r.back > r.bet) return 'win';
  if (r.back > 0) return 'some';
  return 'lose';
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 宝くじ: 数字が1けたずつそろっていく */
function Lottery({ grade }: { grade: Grade }) {
  const digits = { jackpot: [7, 7, 7], win: [3, 3, 3], some: [5, 5, 2], lose: [3, 8, 1] }[grade];
  return (
    <div className="gamble-lottery">
      {digits.map((d, i) => (
        <div key={i} className="gamble-reel">
          <div className="gamble-reel-strip" style={{ '--stop': `${0.9 + i * 0.5}s` } as CSSProperties}>
            {[...Array.from({ length: 10 }, (_, k) => (d + k + 1) % 10), d].map((n, k) => (
              <span key={k}>{n}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 競馬: 3頭が走ってゴールする。あなたの馬は1番 */
function Horse({ grade }: { grade: Grade }) {
  // ゴールするまでの時間（短いほど先に着く）。当たりなら、あなたの馬が1着
  const times = grade === 'jackpot' || grade === 'win' ? [1.5, 1.8, 2.0] : [2.0, 1.5, 1.75];
  return (
    <div className="gamble-horse">
      {times.map((sec, i) => (
        <div key={i} className={`gamble-lane${i === 0 ? ' mine' : ''}`}>
          <span className="gamble-runner" style={{ '--run': `${sec}s` } as CSSProperties}>
            {i + 1}
          </span>
          {i === 0 && <span className="gamble-lane-label">{t('gambleResult.yourHorse')}</span>}
        </div>
      ))}
      <div className="gamble-goal" />
    </div>
  );
}

/** パチンコ: 玉がくぎの間を落ちて、穴に入る。真ん中が当たり、横が少し戻る、下まで落ちたらはずれ */
function Pachinko({ grade }: { grade: Grade }) {
  const endX = { jackpot: 0, win: 0, some: 70, lose: -95 }[grade];
  const endY = grade === 'lose' ? 150 : 118;
  return (
    <div className="gamble-pachinko">
      {Array.from({ length: 18 }, (_, k) => (
        <span key={k} className="gamble-pin" style={{ left: `${12 + (k % 6) * 15 + (Math.floor(k / 6) % 2) * 7}%`, top: `${18 + Math.floor(k / 6) * 22}%` }} />
      ))}
      <span className="gamble-hole center">{t('gambleResult.hole')}</span>
      <span className="gamble-hole side" />
      <span className="gamble-ball" style={{ '--end-x': `${endX}px`, '--end-y': `${endY}px` } as CSSProperties} />
    </div>
  );
}

export function GambleResultModal({ result, onClose }: { result: GambleResult; onClose: () => void }) {
  const grade = gradeOf(result);
  const [done, setDone] = useState(reducedMotion);
  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => setDone(true), ANIMATION_MS);
    return () => window.clearTimeout(id);
  }, [done]);
  useEffect(() => {
    if (!done) return;
    if (grade === 'jackpot') sfx.fanfare();
    else if (grade === 'win') sfx.coin();
    else sfx.loss();
  }, [done]);
  const times = Math.round(result.multiplier * 100) / 100;
  return (
    <div className="overlay">
      {done && (grade === 'jackpot' || grade === 'win') && <Confetti seed={result.bet} count={grade === 'jackpot' ? 64 : 32} />}
      <div className={`modal gamble-result gamble-${grade}`}>
        <h2>{t(`option.gamble.${result.id}`)}</h2>
        <div className={`gamble-stage${done ? ' done' : ''}`}>
          {result.id === 'lottery' && <Lottery grade={grade} />}
          {result.id === 'horse' && <Horse grade={grade} />}
          {result.id === 'pachinko' && <Pachinko grade={grade} />}
        </div>
        {done && (
          <>
            <div className="gamble-grade">{t(`gambleResult.${grade}`, { times })}</div>
            <p className="gamble-money">
              {t('gambleResult.bet')} {formatMoney(result.bet)} → {t('gambleResult.back')} {formatMoney(result.back)}（<MoneyDelta v={result.back - result.bet} />）
            </p>
          </>
        )}
        <div className="options">
          <button disabled={!done} onClick={onClose}>
            {t('option.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
