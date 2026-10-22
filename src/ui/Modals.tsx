import { useEffect, useState } from 'react';
import { ASSET_IDS } from '../data/assets';
import { BIRTH, HIGH_SCHOOL_FACES, MARRIAGE, SPOUSE_WORK_FACES, UNIVERSITY_FACES } from '../data/rules';
import { Roulette, SPIN_DURATION_MS } from '../board/Roulette';
import { SQUARE_COLORS } from '../board/Board';
import { getOptions } from '../game/engine';
import { newsById } from '../game/market';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { describeDecision } from './decisionText';
import { MoneyDelta } from './Delta';
import { HistoryTabs } from './HistoryTabs';
import { Details, VerticalLedger } from './Ledger';
import { EveryoneMoved } from './Rivals';

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
  const owned = keys.filter((k) => Math.round(ev.amounts[k] ?? 0) !== 0);
  // 合計は、表に出す行（1万円単位に丸めたもの）を足して出す（design.md 2.2）
  const total = owned.reduce((a, k) => a + Math.round(ev.amounts[k]), 0);
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
          {t('news.table.mine')}: <MoneyDelta v={total} big />
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
      <EveryoneMoved s={s} amountOf={(v) => Object.values(v.newsEvent?.amounts ?? {}).reduce((a, x) => a + Math.round(x), 0)} />
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

// ---------------------------------------------------------------- ルーレットで決まる出来事（design.md 3.8）

/** ルーレットの種類。何を決めるか、なぜ大事か、どの目で何になるかを、言語ファイルから出す */
type Topic = 'marriage' | 'spouseWork' | 'birth' | 'highSchool' | 'university';

/** 出目から、結果の種類を決める */
function outcomeOf(topic: Topic, face: number): string {
  switch (topic) {
    case 'marriage':
      return MARRIAGE.faces.includes(face) ? 'yes' : 'no';
    case 'birth':
      return BIRTH.faces.includes(face) ? 'yes' : 'no';
    case 'spouseWork':
      return SPOUSE_WORK_FACES.full.includes(face) ? 'full' : 'none';
    case 'highSchool':
      return HIGH_SCHOOL_FACES.public.includes(face) ? 'public' : 'private';
    case 'university':
      return (Object.keys(UNIVERSITY_FACES) as (keyof typeof UNIVERSITY_FACES)[]).find((k) => UNIVERSITY_FACES[k].includes(face))!;
  }
}

/** お知らせの種類から、回したルーレットの種類を決める */
function topicsOf(messageKey: string): Topic[] {
  if (messageKey.startsWith('marriage.yes')) return ['marriage', 'spouseWork'];
  if (messageKey.startsWith('marriage.')) return ['marriage'];
  if (messageKey.startsWith('birth.')) return ['birth'];
  if (messageKey.startsWith('school.highSchool')) return ['highSchool'];
  if (messageKey.startsWith('school.university')) return ['university'];
  return [];
}

/** ルーレットの説明（何を決めるか、なぜ大事か、どの目で何になるか） */
function TopicGuide({ topic, index }: { topic: Topic; index?: number }) {
  return (
    <div className="roulette-guide">
      <div className="roulette-guide-title">
        {index !== undefined ? `${'①②③'[index]} ` : ''}
        {t(`roulette.${topic}.title`)}
      </div>
      <div className="muted">{t(`roulette.${topic}.why`)}</div>
      <div className="roulette-guide-faces">{t(`roulette.${topic}.faces`)}</div>
    </div>
  );
}

/**
 * 回したルーレットを、1つずつ見せる。1つめが止まって結果を読み、「次へ」を押してから2つめを出す。
 * auto なら、1つめはすぐに回し始める（「ルーレットを回す」を押した直後のとき）
 */
function RouletteSteps({ topics, faces, auto, onDone }: { topics: Topic[]; faces: number[]; auto: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<'ready' | 'spinning' | 'done'>(auto ? 'spinning' : 'ready');
  const [turned, setTurned] = useState(false);
  const topic = topics[step];
  const face = faces[step];

  useEffect(() => {
    if (stage !== 'spinning') return;
    // 描いたあとに回し始める（止まっている向きから、出目の向きへ動かすため）
    setTurned(false);
    const start = window.setTimeout(() => setTurned(true), 50);
    const stop = window.setTimeout(() => setStage('done'), SPIN_DURATION_MS + 400);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [stage, step]);

  const resultText = (k: number) => t(`roulette.${topics[k]}.result.${outcomeOf(topics[k], faces[k])}`, { face: faces[k] });
  const last = step >= topics.length - 1;
  return (
    <div className="roulette-steps">
      {topics.slice(0, step).map((_, k) => (
        <div key={k} className="roulette-done-line">
          ✔ {resultText(k)}
        </div>
      ))}
      <TopicGuide topic={topic} index={topics.length > 1 ? step : undefined} />
      <Roulette value={stage === 'ready' ? null : face} spinning={stage === 'spinning' && turned} canSpin={false} onSpin={() => {}} resultLabel=" " />
      {stage === 'ready' && <button onClick={() => setStage('spinning')}>{t('roulette.spin')}</button>}
      {stage === 'done' && (
        <>
          <div className="roulette-result">{resultText(step)}</div>
          {!last ? (
            <button
              onClick={() => {
                setStep(step + 1);
                setStage('ready');
              }}
            >
              {t('roulette.next', { title: t(`roulette.${topics[step + 1]}.title`) })}
            </button>
          ) : (
            <button onClick={onDone}>{t('roulette.seeResult')}</button>
          )}
        </>
      )}
    </div>
  );
}

export function DecisionModal({ s, onChoose }: { s: GameState; onChoose: (id: string) => void }) {
  const { title, text, squareType } = describeDecision(s);
  const options = getOptions(s);
  const single = options.length === 1 ? options[0] : null;
  const d = s.decision!;
  const params = d.params;
  const faces = [params?.face, params?.workFace].filter((f): f is number => typeof f === 'number');
  const topics = d.kind === 'notice' && d.messageKey ? topicsOf(d.messageKey).slice(0, faces.length) : [];
  /** ルーレットを回し終わるまでは、結果の文章とボタンを隠す */
  const [revealed, setRevealed] = useState(topics.length === 0);
  if (topics.length > 0 && !revealed) {
    const auto = d.messageKey!.startsWith('marriage.') || d.messageKey!.startsWith('birth.');
    return (
      <Overlay>
        <h2>{t(`roulette.${topics[0]}.heading`)}</h2>
        <RouletteSteps topics={topics} faces={faces} auto={auto} onDone={() => setRevealed(true)} />
      </Overlay>
    );
  }
  // 結婚マス・出産マスで、ルーレットを回す前（何を決めるかを先に出す）
  const before: Topic | null = d.kind === 'marriage' ? 'marriage' : d.kind === 'birth' ? 'birth' : null;
  return (
    <Overlay>
      {squareType && (
        <span className="tag" style={{ background: SQUARE_COLORS[squareType] }}>
          {t(`squareType.${squareType}`)}
        </span>
      )}
      <h2>{title}</h2>
      {topics.length > 0 && (
        <div className="roulette-done">
          {topics.map((tp, k) => (
            <div key={k} className="roulette-done-line">
              ✔ {t(`roulette.${tp}.result.${outcomeOf(tp, faces[k])}`, { face: faces[k] })}
            </div>
          ))}
        </div>
      )}
      <p>{text}</p>
      {before && (
        <>
          <TopicGuide topic={before} />
          <Roulette value={null} spinning={false} canSpin={false} onSpin={() => {}} resultLabel=" " />
        </>
      )}
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

/**
 * 年末の決算（design.md 2.1）。今の純資産を一番上に大きく出し、純資産の中身と、去年から増えた・減ったわけを出す。
 * 「取引タイムへ」と「次の年へ」のボタンを置く。最後の年は「結果を見る」だけ
 */
export function YearEndModal({ s, onNext, onTrade }: { s: GameState; onNext: () => void; onTrade?: () => void }) {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const last = s.year >= s.years;
  const now = Math.round(rec.netWorth);
  // 増えた・減ったわけ。画面に出す行を足したものを、去年からの増減にする（行と必ず合う）
  const reasons = [
    { key: 'work', icon: '💼', v: Math.round(b.work) },
    { key: 'investment', icon: '💰', v: Math.round(b.investment) },
    { key: 'revaluation', icon: '📈', v: Math.round(b.revaluation) },
    { key: 'other', icon: '🎲', v: Math.round(b.other) },
  ].filter((r) => r.v !== 0);
  const change = reasons.reduce((a, r) => a + r.v, 0);
  const investments = Object.entries(rec.assets).reduce((a, [k, v]) => a + (k === 'realEstate' ? 0 : v), 0);
  const parts = [
    { key: 'deposit', icon: '🏦', v: Math.round(rec.cash) },
    { key: 'investments', icon: '📈', v: Math.round(investments) },
    { key: 'home', icon: '🏠', v: Math.round(rec.assets.realEstate ?? 0) },
    { key: 'debt', icon: '💳', v: -Math.round(rec.debt) },
  ];
  return (
    <Overlay wide>
      <h2>{t('yearEnd.heading', { year: st.year })}</h2>
      <div className="worth-hero">
        <div className="muted">{t('yearEnd.nowWorth')}</div>
        <div className="worth-hero-value">{formatMoney(now)}</div>
        <div>
          {t('yearEnd.fromLastYear')} <MoneyDelta v={change} big />
          {change === 0 && formatMoney(0)}
          <span className="muted">{t('yearEnd.lastYear', { amount: now - change })}</span>
        </div>
      </div>
      <div className="year-end-grid">
        <div className="card">
          <h4>{t('yearEnd.parts')}</h4>
          <table className="worth-table">
            <tbody>
              {parts.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.icon} {t(`yearEnd.part.${r.key}`)}
                  </td>
                  <td className={`ledger-money${r.v < 0 ? ' minus' : ''}`}>{formatMoney(r.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h4>{t('yearEnd.reasons')}</h4>
          <table className="worth-table">
            <tbody>
              {reasons.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.icon} {t(`yearEnd.reason.${r.key}`)}
                  </td>
                  <td className="ledger-money">
                    <MoneyDelta v={r.v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {st.sold > 0.5 && <div className="warning">{t('summary.sold', { amount: st.sold })}</div>}
      {st.borrowed > 0.5 && <div className="warning">{t('summary.borrowed', { amount: st.borrowed })}</div>}
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
      <Details label={t('yearEnd.ledger')}>
        <VerticalLedger income={st.income} expense={st.expense} saved={st.saved} repaid={st.repaid} />
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
