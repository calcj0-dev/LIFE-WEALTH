// 値動きのチャートと年利の実績の表。ゲーム開始時を0%として、値上がりだけを見せる（配当・利息は含めない）。
// チャートは毎月の価格、表は1年ごとの値上がり率。

import { ASSETS, ASSET_IDS, START_DEPOSIT_RATE } from '../data/assets';
import type { PricePoint, YearRecord } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { colorOf, yearTickStep } from './chartColors';

const KEYS = [...ASSET_IDS, 'realEstate', 'living'];
const START: Record<string, number> = { ...Object.fromEntries(ASSET_IDS.map((id) => [id, ASSETS[id].startPrice])), realEstate: 1, living: 1 };

const nameOf = (key: string) => t(key === 'living' ? 'prices.living' : `asset.${key}`);

function priceAt(p: { prices: Record<string, number>; realEstateIndex: number; livingIndex: number }, key: string): number {
  if (key === 'realEstate') return p.realEstateIndex;
  if (key === 'living') return p.livingIndex;
  return p.prices[key];
}

const pct = (v: number) => `${formatSigned(v * 100)}%`;

/** ゲーム開始時を0%とした、毎月の値動きの線グラフ。不況の年は背景を薄く塗る */
export function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return <p className="muted">{t('history.empty')}</p>;
  const W = 640;
  const H = 260;
  const pad = { l: 52, r: 14, t: 12, b: 26 };
  const series = KEYS.map((key) => ({ key, values: points.map((p) => priceAt(p, key) / START[key] - 1) }));
  const all = series.flatMap((s) => s.values);
  const step = niceStep(Math.max(...all) - Math.min(0, ...all));
  const top = Math.ceil(Math.max(0.1, ...all) / step) * step;
  const bottom = Math.floor(Math.min(0, ...all) / step) * step;
  const n = points.length;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((top - v) / (top - bottom || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(v);
  const bandW = (W - pad.l - pad.r) / (n - 1);
  const years = Math.ceil((n - 1) / 12);
  const tick = yearTickStep(years);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('prices.title')}>
        {points.map((p, i) =>
          i > 0 && p.economy === 'recession' ? (
            <rect key={i} x={x(i) - bandW / 2} y={pad.t} width={bandW} height={H - pad.t - pad.b} fill="#ff6b6b" fillOpacity="0.1" />
          ) : null,
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={Math.abs(v) < 1e-9 ? 'var(--text-sub)' : 'var(--line)'} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-sub)">
              {pct(v)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path
            key={s.key}
            d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')}
            fill="none"
            stroke={colorOf(s.key)}
            strokeWidth={s.key === 'living' ? 2 : 2}
            strokeDasharray={s.key === 'living' ? '6 4' : undefined}
          />
        ))}
        <text x={x(0)} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
          {t('prices.start')}
        </text>
        {points.map((p, i) =>
          p.month === 12 && p.year % tick === 0 ? (
            <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
              {t('hud.year', { year: p.year })}
            </text>
          ) : null,
        )}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: colorOf(s.key), height: 3 }} />
            {nameOf(s.key)} {pct(s.values[s.values.length - 1])}
          </span>
        ))}
        <span>
          <i style={{ background: '#ff6b6b', opacity: 0.25 }} />
          {t('economy.recession')}
        </span>
      </div>
      <p className="muted">{t('prices.note')}</p>
    </div>
  );
}

/**
 * 1つの銘柄の値段のグラフ（取引タイムの「チャート」ボタンで開く。design.md 2.1）。
 * 株は1株の値段、ほかは1口の値段を、ゲームの始めからの割合（％）で出す。avgCost を渡すと、買った平均の値段を点線で出す
 */
export function AssetPriceChart({ points, id, avgCost, compact }: { points: PricePoint[]; id: string; avgCost?: number; /** 取引タイムの右側など、せまい場所に出すとき */ compact?: boolean }) {
  if (points.length < 2) return <p className="muted">{t('history.empty')}</p>;
  const W = compact ? 360 : 560;
  const H = compact ? 140 : 180;
  const pad = { l: compact ? 52 : 64, r: 12, t: 10, b: 24 };
  const share = ASSETS[id].unit === 'share';
  const values = points.map((p) => p.prices[id]);
  // 株は値段（万円）、ほかは始めからの値上がり（％）で見せる
  const toY = (price: number) => (share ? price : price / START[id] - 1);
  const ys = values.map(toY);
  const avgY = avgCost !== undefined ? toY(avgCost) : undefined;
  const all = avgY !== undefined ? [...ys, avgY] : ys;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || Math.abs(hi) || 1;
  const top = hi + span * 0.1;
  const bottom = lo - span * 0.1;
  const n = points.length;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((top - v) / (top - bottom || 1)) * (H - pad.t - pad.b);
  const label = (v: number) => (share ? formatMoney(v) : pct(v));
  const years = Math.ceil((n - 1) / 12);
  const tick = yearTickStep(years);
  return (
    <div className="asset-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('trade.chartTitle', { name: t(`asset.${id}`) })}>
        {[top, (top + bottom) / 2, bottom].map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-sub)">
              {label(v)}
            </text>
          </g>
        ))}
        <path d={ys.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke={colorOf(id)} strokeWidth="2.5" />
        {avgY !== undefined && (
          <line x1={pad.l} x2={W - pad.r} y1={y(avgY)} y2={y(avgY)} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="6 4" />
        )}
        {points.map((p, i) =>
          p.month === 12 && p.year % tick === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
              {t('hud.year', { year: p.year })}
            </text>
          ) : null,
        )}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: colorOf(id), height: 3 }} />
          {t(share ? 'trade.chartPrice' : 'trade.chartRate')}
        </span>
        {avgY !== undefined && (
          <span>
            <i style={{ background: 'var(--text)', height: 2 }} />
            {t('trade.chartCost', { amount: share ? formatMoney(avgCost!) : pct(avgY) })}
          </span>
        )}
      </div>
    </div>
  );
}

/** 1年ごとの値上がり率の表。いちばん上に、これまでの年平均（複利）を出す */
export function ReturnTable({ history }: { history: YearRecord[] }) {
  if (history.length < 1) return <p className="muted">{t('history.empty')}</p>;
  const yearly = history.map((r, i) => {
    const prev = i === 0 ? null : history[i - 1].market;
    const rates = Object.fromEntries(KEYS.map((k) => [k, priceAt(r.market, k) / (prev ? priceAt(prev, k) : START[k]) - 1]));
    return { r, rates };
  });
  const years = history.length;
  const lastMarket = history[years - 1].market;
  const average = Object.fromEntries(KEYS.map((k) => [k, Math.pow(priceAt(lastMarket, k) / START[k], 1 / years) - 1]));
  const avgDeposit = history.reduce((a, r) => a + r.market.depositRate, 0) / years;

  return (
    <div>
      <div className="return-table">
        <table className="table">
          <thead>
            <tr>
              <th>{t('prices.year')}</th>
              <th>{t('hud.economy')}</th>
              {KEYS.map((k) => (
                <th key={k}>{nameOf(k)}</th>
              ))}
              <th>{t('prices.depositRate')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="average-row">
              <td>{t('prices.average', { years })}</td>
              <td>—</td>
              {KEYS.map((k) => (
                <td key={k} className={average[k] >= 0 ? 'plus' : 'minus'}>
                  {pct(average[k])}
                </td>
              ))}
              <td>{(avgDeposit * 100).toFixed(1)}%</td>
            </tr>
            {[...yearly].reverse().map(({ r, rates }) => (
              <tr key={r.year}>
                <td>{t('hud.year', { year: r.year })}</td>
                <td>{t(`economy.${r.economy}`)}</td>
                {KEYS.map((k) => (
                  <td key={k} className={rates[k] >= 0 ? 'plus' : 'minus'}>
                    {pct(rates[k])}
                  </td>
                ))}
                <td>{(r.market.depositRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{t('prices.incomeNote', { deposit: Math.round(START_DEPOSIT_RATE * 1000) / 10 })}</p>
    </div>
  );
}

function niceStep(range: number): number {
  const raw = Math.max(range, 0.05) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}
