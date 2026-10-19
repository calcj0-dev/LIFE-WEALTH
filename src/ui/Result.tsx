import type { GameState } from '../game/types';
import { formatMoney, has, t } from '../i18n';
import { HistoryTabs } from './HistoryTabs';

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
          <HistoryTabs history={s.history} />
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
