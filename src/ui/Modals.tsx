import { ASSET_IDS } from '../data/assets';
import { newsById } from '../game/market';
import { getOptions } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { SQUARE_COLORS } from '../board/Board';
import { describeDecision } from './decisionText';
import { HappinessDelta, MoneyDelta } from './Delta';
import { movingEntries } from './logLabel';
import { HistoryTabs } from './HistoryTabs';
import { BudgetCard } from './Setup';
import { Details, HappinessList, LedgerTable, MoneySummary, NetWorthTable } from './Ledger';

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="overlay">
      <div className={`modal${wide ? ' wide' : ''}`}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 年初のニュース

export function NewsModal({ s, onNext, onOpenManager }: { s: GameState; onNext: () => void; onOpenManager?: () => void }) {
  const news = newsById(s.newsId!);
  const change = s.marketChange;
  const keys = [...ASSET_IDS, 'realEstate' as const];
  const owned = change ? keys.filter((k) => Math.abs(change.amounts[k]) >= 0.5) : [];
  const total = owned.reduce((a, k) => a + change!.amounts[k], 0);
  return (
    <Overlay>
      <div className="muted">{t('news.heading', { age: s.player.age })}</div>
      <h2>{t(`news.${news.id}.title`)}</h2>
      <p>{t(`news.${news.id}.text`)}</p>
      {change && (
        <table className="table">
          <thead>
            <tr>
              <th>{t('news.table.asset')}</th>
              <th>{t('news.table.rate')}</th>
              <th>{t('news.table.mine')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>{t(`asset.${k}`)}</td>
                <td className={change.rates[k] >= 0 ? 'plus' : 'minus'}>{formatSigned(change.rates[k] * 100)}%</td>
                <td>{owned.includes(k) ? <MoneyDelta v={change.amounts[k]} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {owned.length > 0 ? (
        <p className="summary-line">
          {t('news.table.mine')}: <MoneyDelta v={total} big />
        </p>
      ) : (
        <p className="muted">{t('news.noHoldings')}</p>
      )}
      <p className="muted">
        {t('news.economy', {
          prev: t(`economy.${change?.prevEconomy ?? s.market.economy}`),
          now: t(`economy.${s.market.economy}`),
        })}
        <br />
        {t(`economy.${s.market.economy}.desc`)}
      </p>
      {news.important && (
        <p>
          <strong>{t('news.important')}</strong>
        </p>
      )}
      <BudgetCard s={s} title={t('budget.yearTitle')} />
      <div className="options">
        {onOpenManager && (
          <button className="secondary" onClick={onOpenManager}>
            {t('news.openManage')}
          </button>
        )}
        <button onClick={onNext}>{t('news.next')}</button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- マスの出来事

export function DecisionModal({ s, onChoose }: { s: GameState; onChoose: (id: string) => void }) {
  const { title, text, squareType } = describeDecision(s);
  const options = getOptions(s);
  const single = options.length === 1 ? options[0] : null;
  return (
    <Overlay>
      {squareType && (
        <span className="tag" style={{ background: SQUARE_COLORS[squareType] }}>
          {t(`squareType.${squareType}`)}
        </span>
      )}
      <h2>{title}</h2>
      <p>{text}</p>
      {single && (single.cash !== undefined || single.happiness !== undefined) && (
        <p className="summary-line">
          {single.cash !== undefined && <MoneyDelta v={single.cash} big />}
          {single.happiness !== undefined && <HappinessDelta v={single.happiness} big />}
        </p>
      )}
      <div className="options">
        {options.map((o) => (
          <button
            key={o.id}
            className={o.id === 'skip' || o.id === 'decline' ? 'secondary' : undefined}
            disabled={!o.enabled}
            title={o.enabled ? undefined : t('decision.unavailable')}
            onClick={() => onChoose(o.id)}
          >
            <span>{t(o.key, o.params)}</span>
            {!single && (o.cash !== undefined || o.happiness !== undefined) && (
              <span className="option-deltas">
                {o.cash !== undefined && <MoneyDelta v={o.cash} />}
                {o.happiness !== undefined && <HappinessDelta v={o.happiness} />}
              </span>
            )}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- 年末決算

export function YearEndModal({ s, onNext, last }: { s: GameState; onNext: () => void; last: boolean }) {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  const happiness = movingEntries(s.log.filter((l) => l.age === st.age)).reduce((a, e) => a + (e.happiness ?? 0), 0);
  const income = Object.values(st.income).reduce((a, v) => a + v, 0);
  const expense = Object.values(st.expense).reduce((a, v) => a + v, 0);
  return (
    <Overlay wide>
      <h2>{t('yearEnd.heading', { age: st.age })}</h2>
      <MoneySummary income={income} expense={expense} />
      <div className="summary-rows">
        <div className="summary-row">
          <span>{t('worth.line', { prev: formatMoney(rec.netWorth - change), now: formatMoney(rec.netWorth) })}</span>
          <MoneyDelta v={change} big />
        </div>
        {happiness !== 0 && (
          <div className="summary-row">
            <span>{t('happiness.line')}</span>
            <HappinessDelta v={happiness} big />
          </div>
        )}
        {st.sold > 0 && <div className="warning">{t('summary.sold', { amount: st.sold })}</div>}
        {st.borrowed > 0 && <div className="warning">{t('summary.borrowed', { amount: st.borrowed })}</div>}
      </div>
      <Details>
        <LedgerTable income={st.income} expense={st.expense} />
        <h4 className="section-title">{t('worth.title')}</h4>
        <NetWorthTable s={s} />
        {happiness !== 0 && <h4 className="section-title">{t('happiness.title')}</h4>}
        <HappinessList s={s} />
      </Details>
      <div className="options">
        <button onClick={onNext}>{t(last ? 'yearEnd.finish' : 'yearEnd.next')}</button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- 資産の推移

export function HistoryModal({ s, onClose }: { s: GameState; onClose: () => void }) {
  return (
    <Overlay wide>
      <h2>{t('history.title')}</h2>
      <HistoryTabs history={s.history} />
      <div className="options">
        <button className="secondary" onClick={onClose}>
          {t('history.close')}
        </button>
      </div>
    </Overlay>
  );
}
