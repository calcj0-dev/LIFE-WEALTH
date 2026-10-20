import { ASSET_IDS } from '../data/assets';
import { SQUARE_COLORS } from '../board/Board';
import { getOptions } from '../game/engine';
import { newsById } from '../game/market';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { describeDecision } from './decisionText';
import { MoneyDelta } from './Delta';
import { HistoryTabs } from './HistoryTabs';
import { Details, LedgerTable, MoneySummary, NetWorthTable } from './Ledger';

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="overlay">
      <div className={`modal${wide ? ' wide' : ''}`}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 年末のニュース

/** 大事なニュースの年か（金融危機、技術革新ブームなど）。大事な年だけポップアップで出す（design.md 2.2） */
export function isImportantNews(s: GameState): boolean {
  return !!s.newsId && !!newsById(s.newsId).important;
}

/** 大事な決算の年か。大事な年だけポップアップで出す（design.md 2.2） */
export function isNotableYearEnd(s: GameState): boolean {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  const prev = rec.netWorth - change;
  // 借金や資産の売却は、始まった年だけ（続いている年は、お知らせだけにする）
  const lastYear = (key: string) => s.log.some((l) => l.year === st.year - 1 && l.key === key);
  const newBorrow = st.borrowed > 0 && !lastYear('shortfall.loan');
  const newSell = st.sold > 0 && !lastYear('shortfall.sell') && !lastYear('shortfall.loan');
  // 貯金の増え方ではなく、値動きやマスの出来事で大きく動いた年
  const unusual = Math.abs(b.revaluation + b.other) > Math.max(500, Math.abs(prev) * 0.3);
  const last = s.year >= s.years;
  return last || newBorrow || newSell || unusual || st.year % 10 === 0;
}

export function NewsModal({ s, onNext, closeOnly }: { s: GameState; onNext: () => void; closeOnly?: boolean }) {
  const news = newsById(s.newsId!);
  const change = s.marketChange;
  const keys = [...ASSET_IDS, 'realEstate'];
  const owned = change ? keys.filter((k) => Math.abs(change.amounts[k]) >= 0.5) : [];
  const total = owned.reduce((a, k) => a + change!.amounts[k], 0);
  return (
    <Overlay>
      <div className="muted">{t('news.heading', { year: s.year })}</div>
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
      <div className="options">
        <button onClick={onNext}>{t(closeOnly ? 'news.close' : 'news.next')}</button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- マスの出来事

export function DecisionModal({ s, onChoose }: { s: GameState; onChoose: (id: string) => void }) {
  const { title, text, squareType } = describeDecision(s);
  const options = getOptions(s);
  const single = options.length === 1 ? options[0] : null;
  const face = s.decision?.params?.face;
  return (
    <Overlay>
      {squareType && (
        <span className="tag" style={{ background: SQUARE_COLORS[squareType] }}>
          {t(`squareType.${squareType}`)}
        </span>
      )}
      <h2>{title}</h2>
      {face !== undefined && <div className="die-face" aria-label={t('roulette.face', { face })}>{face}</div>}
      <p>{text}</p>
      {single && single.cash !== undefined && (
        <p className="summary-line">
          <MoneyDelta v={single.cash} big />
        </p>
      )}
      <div className="options">
        {options.map((o) => (
          <button
            key={o.id}
            className={o.id === 'skip' ? 'secondary' : undefined}
            disabled={!o.enabled}
            title={o.enabled ? undefined : t('decision.unavailable')}
            onClick={() => onChoose(o.id)}
          >
            <span>{t(o.key, o.params)}</span>
            {!single && o.cash !== undefined && (
              <span className="option-deltas">
                <MoneyDelta v={o.cash} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- 年末の決算

export function YearEndModal({ s, onNext, closeOnly }: { s: GameState; onNext: () => void; closeOnly?: boolean }) {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  const income = Object.values(st.income).reduce((a, v) => a + v, 0);
  const expense = Object.values(st.expense).reduce((a, v) => a + v, 0);
  const last = s.year >= s.years;
  return (
    <Overlay wide>
      <h2>{t('yearEnd.heading', { year: st.year })}</h2>
      <MoneySummary income={income} expense={expense} />
      <div className="summary-rows">
        <div className="summary-row">
          <span>{t('worth.line', { prev: formatMoney(rec.netWorth - change), now: formatMoney(rec.netWorth) })}</span>
          <MoneyDelta v={change} big />
        </div>
        {st.sold > 0 && <div className="warning">{t('summary.sold', { amount: st.sold })}</div>}
        {st.borrowed > 0 && <div className="warning">{t('summary.borrowed', { amount: st.borrowed })}</div>}
      </div>
      <Details>
        <LedgerTable income={st.income} expense={st.expense} />
        <h4 className="section-title">{t('worth.title')}</h4>
        <NetWorthTable s={s} />
      </Details>
      <div className="options">
        <button onClick={onNext}>{t(closeOnly ? 'news.close' : last ? 'yearEnd.finish' : 'yearEnd.next')}</button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- 資産の推移

export function HistoryModal({ s, onClose }: { s: GameState; onClose: () => void }) {
  return (
    <Overlay wide>
      <h2>{t('history.title')}</h2>
      <HistoryTabs s={s} />
      <div className="options">
        <button className="secondary" onClick={onClose}>
          {t('history.close')}
        </button>
      </div>
    </Overlay>
  );
}
