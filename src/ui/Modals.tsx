import { ASSET_IDS } from '../data/assets';
import { newsById } from '../game/market';
import { getOptions } from '../game/engine';
import type { GameState, Settlement } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { SQUARE_COLORS } from '../board/Board';
import { describeDecision } from './decisionText';
import { HappinessDelta, MoneyDelta } from './Delta';
import { logLabel, movingEntries } from './logLabel';
import { HistoryTabs } from './HistoryTabs';
import { BudgetCard } from './Setup';
import { useState } from 'react';

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

const INCOME_GROUPS: Record<string, string[]> = {
  work: ['salary', 'spouse', 'sideBusiness'],
  investment: ['interest', 'bond', 'dividend', 'rent'],
};
const EXPENSE_GROUPS: Record<string, string[]> = {
  job: ['jobCost'],
  living: ['living', 'hobby', 'pet'],
  children: ['education'],
  home: ['loan'],
  insurance: ['insurance'],
};

function grouped(items: Record<string, number>, groups: Record<string, string[]>) {
  return Object.entries(groups)
    .map(([g, keys]) => ({ g, total: keys.reduce((a, k) => a + (items[k] ?? 0), 0), keys }))
    .filter((x) => Math.round(x.total) !== 0);
}

function FlowBars({ st }: { st: Settlement }) {
  const income = grouped(st.income, INCOME_GROUPS);
  const expense = grouped(st.expense, EXPENSE_GROUPS);
  const totalIn = income.reduce((a, x) => a + x.total, 0);
  const totalOut = expense.reduce((a, x) => a + x.total, 0);
  const max = Math.max(totalIn, totalOut, 1);
  const colors: Record<string, string> = {
    work: 'var(--good)',
    investment: 'var(--blue)',
    job: '#8d99ae',
    living: 'var(--bad)',
    children: 'var(--pink)',
    home: 'var(--orange)',
    insurance: 'var(--purple)',
  };
  const bar = (items: typeof income, kind: 'income' | 'expense') => (
    <div className="flow-bar">
      {items.map((x) => (
        <div
          key={x.g}
          style={{ width: `${(x.total / max) * 100}%`, background: colors[x.g] }}
          title={`${t(`group.${kind}.${x.g}`)} ${formatMoney(x.total)}`}
        />
      ))}
    </div>
  );
  return (
    <div className="flows">
      <div className="flow-row">
        <strong className="plus">{t('yearEnd.income')}</strong>
        {bar(income, 'income')}
        <span>{formatMoney(totalIn)}</span>
      </div>
      <div className="flow-row">
        <strong className="minus">{t('yearEnd.expense')}</strong>
        {bar(expense, 'expense')}
        <span>{formatMoney(totalOut)}</span>
      </div>
      <div className="legend">
        {[...income.map((x) => ['income', x] as const), ...expense.map((x) => ['expense', x] as const)].map(([kind, x]) => (
          <span key={kind + x.g}>
            <i style={{ background: colors[x.g] }} />
            {t(`group.${kind}.${x.g}`)} {formatMoney(x.total)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailRows({ items }: { items: Record<string, number> }) {
  return (
    <>
      {Object.entries(items)
        .filter(([, v]) => Math.round(v) !== 0)
        .map(([k, v]) => (
          <tr key={k}>
            <td>{t(`settle.${k}`)}</td>
            <td>{formatMoney(v)}</td>
          </tr>
        ))}
    </>
  );
}

/** 借金をした年や、純資産が大きく動いた年は、はじめから詳しく見せる（design.md 2.2） */
function isNotableYear(s: GameState): boolean {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  const prev = rec.netWorth - change;
  return st.borrowed > 0 || st.sold > 0 || Math.abs(change) > Math.max(300, Math.abs(prev) * 0.2);
}

export function YearEndModal({ s, onNext, last }: { s: GameState; onNext: () => void; last: boolean }) {
  const [open, setOpen] = useState(() => last || isNotableYear(s));
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const prevWorth = rec.netWorth - (rec.breakdown.work + rec.breakdown.investment + rec.breakdown.revaluation + rec.breakdown.other);
  const events = movingEntries(s.log.filter((l) => l.age === st.age));
  const happinessChange = events.reduce((a, e) => a + (e.happiness ?? 0), 0);
  const why = (['work', 'investment', 'revaluation', 'other'] as const).filter((k) => Math.round(rec.breakdown[k]) !== 0);
  return (
    <Overlay wide>
      <h2>{t('yearEnd.heading', { age: st.age })}</h2>
      <p className="summary-line">
        {t('yearEnd.netWorth', { prev: formatMoney(prevWorth), now: formatMoney(rec.netWorth) })}{' '}
        <MoneyDelta v={rec.netWorth - prevWorth} big />
      </p>
      {happinessChange !== 0 && (
        <p className="summary-line">
          {t('yearEnd.happiness', { v: '' })}
          <HappinessDelta v={happinessChange} big />
        </p>
      )}
      {open && (
      <>
      <div className="two-col">
        <div>
          <h4>{t('yearEnd.why')}</h4>
          <table className="table">
            <tbody>
              {why.map((k) => (
                <tr key={k}>
                  <td>{t(`breakdown.${k}`)}</td>
                  <td>
                    <MoneyDelta v={rec.breakdown[k]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {st.invested > 0 && (
            <p className="muted">
              {t('yearEnd.invested')}: {formatMoney(st.invested)}
            </p>
          )}
          {st.sold > 0 && (
            <p className="minus">
              {t('yearEnd.sold')}: {formatMoney(st.sold)}
            </p>
          )}
          {st.borrowed > 0 && (
            <p className="minus">
              {t('yearEnd.borrowed')}: {formatMoney(st.borrowed)}
            </p>
          )}
        </div>
        <div>
          <h4>
            {t('yearEnd.events')} {happinessChange !== 0 && <HappinessDelta v={happinessChange} />}
          </h4>
          {events.length === 0 && <p className="muted">—</p>}
          <table className="table">
            <tbody>
              {events.map((e, i) => (
                <tr key={i}>
                  <td>{logLabel(e)}</td>
                  <td>
                    {e.cash !== undefined && <MoneyDelta v={e.cash} />}
                    {e.happiness !== undefined && <HappinessDelta v={e.happiness} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <FlowBars st={st} />
      <details>
        <summary>{t('yearEnd.details')}</summary>
        <table className="table">
          <tbody>
            <tr>
              <td colSpan={2}>
                <strong className="plus">{t('yearEnd.income')}</strong>
              </td>
            </tr>
            <DetailRows items={st.income} />
            <tr>
              <td colSpan={2}>
                <strong className="minus">{t('yearEnd.expense')}</strong>
              </td>
            </tr>
            <DetailRows items={st.expense} />
          </tbody>
        </table>
      </details>
      </>
      )}
      <div className="options">
        <button className="secondary" onClick={() => setOpen((v) => !v)}>
          {t(open ? 'yearEnd.less' : 'yearEnd.more')}
        </button>
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
