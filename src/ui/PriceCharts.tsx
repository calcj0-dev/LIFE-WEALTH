// 値動きのチャートと年利の実績の表。ゲーム開始時を0%として、値上がりだけを見せる（配当・利息は含めない）。

import { ASSETS, ASSET_IDS, START_DEPOSIT_RATE } from '../data/assets';
import type { YearRecord } from '../game/types';
import { formatSigned, t } from '../i18n';

type Key = (typeof ASSET_IDS)[number] | 'realEstate' | 'living';

export const PRICE_LINES: { key: Key; color: string; dashed?: boolean }[] = [
  { key: 'bond', color: '#2ec4b6' },
  { key: 'gold', color: '#e0a800' },
  { key: 'fund', color: '#4d96ff' },
  { key: 'stock', color: '#9b5de5' },
  { key: 'realEstate', color: '#f9a03f' },
  { key: 'living', color: '#6b6573', dashed: true },
];

const START: Record<Key, number> = {
  ...(Object.fromEntries(ASSET_IDS.map((id) => [id, ASSETS[id].startPrice])) as Record<(typeof ASSET_IDS)[number], number>),
  realEstate: 1,
  living: 1,
};

function priceOf(r: YearRecord, key: Key): number {
  const m = r.market!;
  if (key === 'realEstate') return m.realEstateIndex;
  if (key === 'living') return m.livingIndex;
  return m.prices[key];
}

const usable = (history: YearRecord[]) => history.filter((r) => r.market);

const pct = (v: number) => `${formatSigned(v * 100)}%`;

/** ゲーム開始時を0%とした値動きの線グラフ。不況の年は背景を薄く塗る */
export function PriceChart({ history }: { history: YearRecord[] }) {
  const rows = usable(history);
  if (rows.length < 1) return <p className="muted">{t('history.empty')}</p>;
  const W = 640;
  const H = 260;
  const pad = { l: 52, r: 14, t: 12, b: 26 };
  const series = PRICE_LINES.map((l) => ({
    ...l,
    values: [0, ...rows.map((r) => priceOf(r, l.key) / START[l.key] - 1)],
  }));
  const all = series.flatMap((s) => s.values);
  const step = niceStep(Math.max(...all) - Math.min(0, ...all));
  const top = Math.ceil(Math.max(0.1, ...all) / step) * step;
  const bottom = Math.floor(Math.min(0, ...all) / step) * step;
  const n = rows.length + 1;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((top - v) / (top - bottom || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(v);
  const bandW = (W - pad.l - pad.r) / (n - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('prices.title')}>
        {rows.map((r, i) =>
          r.economy === 'recession' ? (
            <rect key={r.age} x={x(i + 1) - bandW / 2} y={pad.t} width={bandW} height={H - pad.t - pad.b} fill="#ff6b6b" fillOpacity="0.1" />
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
            stroke={s.color}
            strokeWidth={s.dashed ? 2 : 2.5}
            strokeDasharray={s.dashed ? '6 4' : undefined}
          />
        ))}
        <text x={x(0)} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
          {t('prices.start')}
        </text>
        {rows
          .filter((r) => r.age % 10 === 0)
          .map((r) => (
            <text key={r.age} x={x(rows.indexOf(r) + 1)} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
              {t('hud.age', { age: r.age })}
            </text>
          ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color, height: 3 }} />
            {t(s.key === 'living' ? 'prices.living' : `asset.${s.key}`)} {pct(s.values[s.values.length - 1])}
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

/** 1年ごとの値上がり率の表。いちばん上に、これまでの年平均（複利）を出す */
export function ReturnTable({ history }: { history: YearRecord[] }) {
  const rows = usable(history);
  if (rows.length < 1) return <p className="muted">{t('history.empty')}</p>;
  const keys = PRICE_LINES.map((l) => l.key);
  const yearly = rows.map((r, i) => {
    const prev = i === 0 ? null : rows[i - 1];
    const rates = Object.fromEntries(
      keys.map((k) => [k, priceOf(r, k) / (prev ? priceOf(prev, k) : START[k]) - 1]),
    ) as Record<Key, number>;
    return { r, rates };
  });
  const years = rows.length;
  const average = Object.fromEntries(
    keys.map((k) => [k, Math.pow(priceOf(rows[years - 1], k) / START[k], 1 / years) - 1]),
  ) as Record<Key, number>;
  const avgDeposit = rows.reduce((a, r) => a + r.market!.depositRate, 0) / years;

  return (
    <div>
      <div className="return-table">
        <table className="table">
          <thead>
            <tr>
              <th>{t('prices.year')}</th>
              <th>{t('hud.economy')}</th>
              {keys.map((k) => (
                <th key={k}>{t(k === 'living' ? 'prices.living' : `asset.${k}`)}</th>
              ))}
              <th>{t('prices.depositRate')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="average-row">
              <td>{t('prices.average', { years })}</td>
              <td>—</td>
              {keys.map((k) => (
                <td key={k} className={average[k] >= 0 ? 'plus' : 'minus'}>
                  {pct(average[k])}
                </td>
              ))}
              <td>{(avgDeposit * 100).toFixed(1)}%</td>
            </tr>
            {[...yearly].reverse().map(({ r, rates }) => (
              <tr key={r.age}>
                <td>{t('hud.age', { age: r.age })}</td>
                <td>{t(`economy.${r.economy}`)}</td>
                {keys.map((k) => (
                  <td key={k} className={rates[k] >= 0 ? 'plus' : 'minus'}>
                    {pct(rates[k])}
                  </td>
                ))}
                <td>{(r.market!.depositRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        {t('prices.incomeNote', {
          dividend: Math.round(ASSETS.stock.incomeYield * 1000) / 10,
          coupon: Math.round(ASSETS.bond.incomeYield * 1000) / 10,
          deposit: Math.round(START_DEPOSIT_RATE * 1000) / 10,
        })}
      </p>
    </div>
  );
}

function niceStep(range: number): number {
  const raw = Math.max(range, 0.05) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}
