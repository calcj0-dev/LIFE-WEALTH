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

// ---------------------------------------------------------------- ニュース（1年のどの月でも起きる。design.md 7章）

/** 大事なニュースか（金融危機、技術革新ブームなど）。ニュースの画面で強調する */
export function isImportantNews(id: string): boolean {
  return !!newsById(id).important;
}

export function NewsModal({ s, onNext }: { s: GameState; onNext: () => void }) {
  const ev = s.newsEvent!;
  const news = newsById(ev.id);
  const keys = [...ASSET_IDS, 'realEstate'].filter((k) => Math.abs(ev.rates[k] ?? 0) >= 0.005);
  const owned = keys.filter((k) => Math.abs(ev.amounts[k] ?? 0) >= 0.5);
  return (
    <Overlay>
      <div className="muted">{t('news.heading', { year: ev.year, month: ev.month })}</div>
      <h2>📰 {t(`news.${news.id}.title`)}</h2>
      <p>{t(`news.${news.id}.text`)}</p>
      {keys.length > 0 && (
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
                <td className={ev.rates[k] >= 0 ? 'plus' : 'minus'}>{formatSigned(ev.rates[k] * 100)}%</td>
                <td>{owned.includes(k) ? <MoneyDelta v={ev.amounts[k]} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {owned.length > 0 ? (
        <p className="summary-line">
          {t('news.table.mine')}: <MoneyDelta v={ev.moved} big />
        </p>
      ) : (
        <p className="muted">{t('news.noHoldings')}</p>
      )}
      {news.economy && news.economy !== ev.prevEconomy && (
        <p className="muted">
          {t('news.economy', { prev: t(`economy.${ev.prevEconomy}`), now: t(`economy.${news.economy}`) })}
          <br />
          {t(`economy.${news.economy}.desc`)}
        </p>
      )}
      {news.important && (
        <p>
          <strong>{t('news.important')}</strong>
        </p>
      )}
      <div className="options">
        <button onClick={onNext}>{t('option.ok')}</button>
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

/** 年末の決算。「取引タイムへ」と「次の年へ」のボタンを置く（design.md 2.1）。最後の年は「結果を見る」だけ */
export function YearEndModal({ s, onNext, onTrade }: { s: GameState; onNext: () => void; onTrade?: () => void }) {
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
      {st.talks.length > 0 && (
        <div className="card talk-results">
          <h4>{t('yearEnd.talks')}</h4>
          {st.talks.map((r, i) => (
            <div key={i} className="kv">
              <span>{t(`talk.${r.id}.title`)}</span>
              <span className={r.back >= r.amount ? 'plus' : 'minus'}>
                {t(r.back < 0 ? 'yearEnd.talkDebt' : 'yearEnd.talkResult', { amount: r.amount, back: Math.abs(r.back) })}
              </span>
            </div>
          ))}
        </div>
      )}
      <Details>
        <LedgerTable income={st.income} expense={st.expense} />
        <h4 className="section-title">{t('worth.title')}</h4>
        <NetWorthTable s={s} />
      </Details>
      <div className="options">
        {!last && onTrade && (
          <button className="secondary" onClick={onTrade}>
            {t('yearEnd.trade')}
          </button>
        )}
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
      <HistoryTabs s={s} />
      <div className="options">
        <button className="secondary" onClick={onClose}>
          {t('history.close')}
        </button>
      </div>
    </Overlay>
  );
}
