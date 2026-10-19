import { ASSET_IDS } from '../data/assets';
import type { YearRecord } from '../game/types';
import { formatMoney, t } from '../i18n';

type SeriesKey = 'deposit' | (typeof ASSET_IDS)[number] | 'realEstate';

const SERIES: { key: SeriesKey; color: string }[] = [
  { key: 'deposit', color: '#7cc6fe' },
  { key: 'bond', color: '#2ec4b6' },
  { key: 'gold', color: '#ffd166' },
  { key: 'fund', color: '#4d96ff' },
  { key: 'stock', color: '#9b5de5' },
  { key: 'realEstate', color: '#f9a03f' },
];

const valueOf = (r: YearRecord, key: SeriesKey) => (key === 'deposit' ? Math.max(0, r.cash) : r.assets[key]);

/** 「1億」「5,000万」のような、目盛りに使う区切りのよい値 */
function niceStep(max: number): number {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

/** 資産の種類ごとに色分けした積み上げグラフ。黒い線が純資産、赤い点線が借金 */
export function AssetChart({ history }: { history: YearRecord[] }) {
  if (history.length < 1) return <p className="muted">{t('history.empty')}</p>;
  const W = 640;
  const H = 260;
  const pad = { l: 74, r: 14, t: 12, b: 26 };
  const totals = history.map((r) => SERIES.reduce((a, s) => a + valueOf(r, s.key), 0));
  const minNet = Math.min(0, ...history.map((r) => r.netWorth), ...history.map((r) => -r.debt));
  const step = niceStep(Math.max(1, ...totals, ...history.map((r) => r.netWorth)) - minNet);
  const top = Math.ceil(Math.max(1, ...totals, ...history.map((r) => r.netWorth)) / step) * step;
  const bottom = Math.floor(minNet / step) * step;
  const n = history.length;
  const x = (i: number) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((top - v) / (top - bottom || 1)) * (H - pad.t - pad.b);

  const layers: { key: SeriesKey; color: string; d: string }[] = [];
  const base = history.map(() => 0);
  for (const s of SERIES) {
    const upper = history.map((r, i) => base[i] + valueOf(r, s.key));
    if (upper.every((v, i) => v === base[i])) continue;
    const top = upper.map((v, i) => `${x(i)},${y(v)}`);
    const bot = base.map((v, i) => `${x(i)},${y(v)}`).reverse();
    layers.push({ key: s.key, color: s.color, d: `M${top.join('L')}L${bot.join('L')}Z` });
    upper.forEach((v, i) => (base[i] = v));
  }
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-6; v += step) ticks.push(v);
  const netLine = history.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.netWorth)}`).join('');
  const debtLine = history.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(-r.debt)}`).join('');
  const hasDebt = history.some((r) => r.debt > 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('history.title')}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-sub)">
              {formatMoney(v)}
            </text>
          </g>
        ))}
        {layers.map((l) => (
          <path key={l.key} d={l.d} fill={l.color} fillOpacity="0.85" />
        ))}
        {hasDebt && <path d={debtLine} fill="none" stroke="var(--bad)" strokeWidth="2" strokeDasharray="5 4" />}
        <path d={netLine} fill="none" stroke="var(--text)" strokeWidth="2.5" />
        {history
          .filter((r) => r.age % 10 === 0 || history.length < 8)
          .map((r) => (
            <text key={r.age} x={x(history.indexOf(r))} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
              {t('hud.age', { age: r.age })}
            </text>
          ))}
      </svg>
      <div className="legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {t(`asset.${s.key}`)}
          </span>
        ))}
        <span>
          <i style={{ background: 'var(--text)', height: 3 }} />
          {t('history.netWorth')}
        </span>
        {hasDebt && (
          <span>
            <i style={{ background: 'var(--bad)', height: 3 }} />
            {t('history.debt')}
          </span>
        )}
      </div>
    </div>
  );
}
