import { useEffect, useState } from 'react';
import { ASSET_IDS } from '../data/assets';
import { Roulette, SPIN_DURATION_MS } from '../board/Roulette';
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

/** 大事なニュースの年か（金融危機、技術革新ブームなど）。ニュースの画面で強調する */
export function isImportantNews(s: GameState): boolean {
  return !!s.newsId && !!newsById(s.newsId).important;
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

/**
 * ルーレットが回って止まる部品（結婚、出産、配偶者の働き方、子どもの進学。design.md 2.2）。
 * faces の出目を順に回して見せ、全部止まったら onDone を呼ぶ
 */
export function RouletteReveal({ faces, onDone }: { faces: number[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (index >= faces.length) {
      onDone();
      return;
    }
    // 描いたあとに回し始める（回る前の向きから、出目の向きへ動かすため）
    const start = window.setTimeout(() => setSpinning(true), 50);
    const stop = window.setTimeout(() => {
      setSpinning(false);
      setIndex((i) => i + 1);
    }, SPIN_DURATION_MS + 400);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
    // onDone は表示のたびに変わらないよう呼び出し側で作る
  }, [index]);
  return (
    <div className="roulette-reveal">
      {faces.map((face, i) => (
        <Roulette key={i} value={i <= index ? face : null} spinning={i === index && spinning} canSpin={false} onSpin={() => {}} resultLabel={i < index ? t('roulette.face', { face }) : ' '} />
      ))}
    </div>
  );
}

export function DecisionModal({ s, onChoose }: { s: GameState; onChoose: (id: string) => void }) {
  const { title, text, squareType } = describeDecision(s);
  const options = getOptions(s);
  const single = options.length === 1 ? options[0] : null;
  const params = s.decision?.params;
  const faces = [params?.face, params?.workFace].filter((f): f is number => typeof f === 'number');
  /** ルーレットが止まるまでは、結果の文章とボタンを隠す */
  const [revealed, setRevealed] = useState(faces.length === 0);
  if (faces.length > 0 && !revealed) {
    return (
      <Overlay>
        <h2>{t('roulette.spinning')}</h2>
        <RouletteReveal faces={faces} onDone={() => setRevealed(true)} />
      </Overlay>
    );
  }
  return (
    <Overlay>
      {squareType && (
        <span className="tag" style={{ background: SQUARE_COLORS[squareType] }}>
          {t(`squareType.${squareType}`)}
        </span>
      )}
      <h2>{title}</h2>
      {faces.length > 0 && (
        <div className="die-faces">
          {faces.map((f, i) => (
            <div key={i} className="die-face" aria-label={t('roulette.face', { face: f })}>
              {f}
            </div>
          ))}
        </div>
      )}
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
