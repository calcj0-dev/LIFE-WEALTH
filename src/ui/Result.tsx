import type { GameState } from '../game/types';
import { formatMoney, has, t } from '../i18n';
import { HistoryTabs } from './HistoryTabs';
import { logLabel } from './logLabel';

/** 結果画面。最後の純資産を大きく出す（design.md 9章） */
export function Result({ s, onAgain }: { s: GameState; onAgain: () => void }) {
  const result = s.result!;
  const st = s.stats;
  const timeline = s.log.filter((l) => has(`log.${l.key}`));
  return (
    <div className="result">
      <h2 style={{ margin: 0 }}>{t('result.title')}</h2>
      <div className="muted">{t('result.years', { years: s.years })}</div>
      <div className="muted">{t('result.netWorth')}</div>
      <div className="rank">{formatMoney(result.netWorth)}</div>
      <div className="result-grid">
        <div className="card">
          <div className="kv">
            <span>{t('result.netWorth')}</span>
            <span className="v">{formatMoney(result.netWorth)}</span>
          </div>
          <div className="kv">
            <span>{t('result.investmentIncome')}</span>
            <span className="v">{formatMoney(st.investmentIncome)}</span>
          </div>
          <div className="muted">{t('result.gamble', { spent: st.gambleSpent, returned: st.gambleReturned })}</div>
          <div className="muted">{t('result.insurance', { paid: st.premiumsPaid, received: st.insurancePaid })}</div>
        </div>
        <div className="card">
          <h4 style={{ margin: '0 0 6px' }}>{t('result.chart')}</h4>
          <HistoryTabs s={s} />
        </div>
        <div className="card">
          <h4 style={{ margin: '0 0 6px' }}>{t('result.timeline')}</h4>
          <div className="timeline">
            {timeline.map((l, i) => (
              <div key={i} className="kv">
                <span>{t('hud.date', { year: l.year, month: l.month })}</span>
                <span>{logLabel(l)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button onClick={onAgain}>{t('result.again')}</button>
    </div>
  );
}
