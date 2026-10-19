import type { GameState } from '../game/types';
import { formatMoney, has, t } from '../i18n';

function NetWorthChart({ s }: { s: GameState }) {
  const h = s.history;
  if (h.length < 2) return null;
  const W = 600;
  const H = 220;
  const pad = { l: 64, r: 16, t: 12, b: 28 };
  const values = h.map((r) => r.netWorth);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const x = (i: number) => pad.l + (i / (h.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((max - v) / (max - min || 1)) * (H - pad.t - pad.b);
  const line = h.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.netWorth)}`).join(' ');
  const ticks = [max, (max + min) / 2, min];
  const ageTicks = h.filter((r) => r.age % 10 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('result.chart')}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-sub)">
            {formatMoney(v)}
          </text>
        </g>
      ))}
      {min < 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--text-sub)" strokeDasharray="4 4" />}
      {ageTicks.map((r) => {
        const i = h.indexOf(r);
        return (
          <text key={r.age} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
            {t('hud.age', { age: r.age })}
          </text>
        );
      })}
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function Result({ s, onAgain }: { s: GameState; onAgain: () => void }) {
  const score = s.score!;
  const st = s.stats;
  const timeline = s.log.filter((l) => has(`log.${l.key}`));
  return (
    <div className="result">
      <h2 style={{ margin: 0 }}>{t('result.title')}</h2>
      <div className="rank">{t('result.rank', { rank: score.rank })}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{t('result.total', { total: Math.round(score.total) })}</div>
      <div className="result-grid">
        <div className="card">
          <div className="kv"><span>{t('result.happiness')}</span><span className="v">{Math.round(score.happinessPoints)}</span></div>
          <div className="kv"><span>{t('result.security')}</span><span className="v">{Math.round(score.securityPoints)}</span></div>
          <div className="kv"><span>{t('result.netWorth')}</span><span className="v">{formatMoney(score.netWorth)}</span></div>
          <div className="kv"><span>{t('result.investmentIncome')}</span><span className="v">{formatMoney(st.investmentIncome)}</span></div>
          <div className="muted">{t('result.gamble', { spent: st.gambleSpent, returned: st.gambleReturned })}</div>
          <div className="muted">{t('result.insurance', { paid: st.premiumsPaid, received: st.insurancePaid })}</div>
        </div>
        <div className="card">
          <h4 style={{ margin: '0 0 6px' }}>{t('result.chart')}</h4>
          <NetWorthChart s={s} />
        </div>
        <div className="card">
          <h4 style={{ margin: '0 0 6px' }}>{t('result.timeline')}</h4>
          <div className="timeline">
            {timeline.map((l, i) => (
              <div key={i} className="kv">
                <span>{t('hud.age', { age: l.age })}</span>
                <span>{t(`log.${l.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button onClick={onAgain}>{t('result.again')}</button>
    </div>
  );
}
