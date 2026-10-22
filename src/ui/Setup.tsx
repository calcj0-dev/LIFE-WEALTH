import { useRef, useState } from 'react';
import { Roulette, SPIN_DURATION_MS } from '../board/Roulette';
import { JOB_IDS } from '../data/jobs';
import { DEFAULT_YEARS, MONTHS_PER_YEAR, YEAR_OPTIONS } from '../data/rules';
import { estimateMonth, rollJob } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney, t } from '../i18n';
import { Details, MoneySummary, VerticalLedger, shownTotal } from './Ledger';

/** 1ターンにかかる時間の目安（秒）。design.md 1.1 */
const SECONDS_PER_TURN = 8;

/** 遊ぶ時間の目安（分）。5分単位に丸める */
export const minutesFor = (years: number) => Math.round((years * MONTHS_PER_YEAR * SECONDS_PER_TURN) / 60 / 5) * 5;

// ---------------------------------------------------------------- 年数を選ぶ

export function YearsSetup({ onDone }: { onDone: (years: number) => void }) {
  const [years, setYears] = useState(DEFAULT_YEARS);
  return (
    <div className="center-screen">
      <h2>{t('setup.years.title')}</h2>
      <p className="muted" style={{ maxWidth: 560 }}>
        {t('setup.years.lead')}
      </p>
      <div className="card-grid">
        {YEAR_OPTIONS.map((y) => (
          <div
            key={y}
            className={`card choice-card${years === y ? ' selected' : ''}`}
            onClick={() => setYears(y)}
            role="button"
            tabIndex={0}
          >
            <h3>{t('setup.years.option', { years: y })}</h3>
            <div className="muted">{t('setup.years.time', { minutes: minutesFor(y) })}</div>
            {y === DEFAULT_YEARS && <span className="tag">{t('setup.years.default')}</span>}
          </div>
        ))}
      </div>
      <button onClick={() => onDone(years)}>{t('setup.years.next')}</button>
    </div>
  );
}

// ---------------------------------------------------------------- 職業のルーレット

export function JobRoulette({ s, onDone }: { s: GameState; onDone: (next: GameState) => void }) {
  const [next, setNext] = useState<GameState | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<number>();
  const labels = JOB_IDS.map((id) => t(`job.${id}`));

  const spin = () => {
    const rolled = rollJob(s);
    setNext(rolled);
    setSpinning(true);
    timer.current = window.setTimeout(() => setSpinning(false), SPIN_DURATION_MS + 200);
  };

  const job = next?.player.jobId;
  return (
    <div className="center-screen">
      <h2>{t('setup.jobRoulette.title')}</h2>
      <Roulette
        large
        labels={labels}
        value={job ? JOB_IDS.indexOf(job) + 1 : null}
        spinning={spinning}
        canSpin={!next}
        onSpin={spin}
        buttonLabel={t('setup.jobRoulette.spin')}
        resultLabel={job ? t('setup.jobRoulette.result', { job }) : undefined}
      />
      {next && !spinning && (
        <>
          <div className="muted">{t(`job.${job}.desc`)}</div>
          <BudgetCard s={next} title={t('budget.title')} />
          <button onClick={() => onDone(next)}>{t('setup.jobRoulette.next')}</button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 今月の家計

export function BudgetCard({ s, title }: { s: GameState; title: string }) {
  const { income, expense, saving } = estimateMonth(s);
  // 合計は、画面に出す行を足したもの（行と必ず合う）
  const net = shownTotal(income) - shownTotal(expense);
  const save = Math.round(saving);
  return (
    <div className="card budget">
      <h4>{title}</h4>
      <MoneySummary income={income} expense={expense} plan />
      {save > 0 && (
        <div className={`saving-line ${net - save >= 0 ? '' : 'minus'}`}>
          {t('budget.saving', { amount: save, rest: formatMoney(net - save) })}
        </div>
      )}
      <Details label={t('budget.details')}>
        <VerticalLedger income={income} expense={expense} saved={saving} />
        <p className="muted">{t('budget.note')}</p>
      </Details>
    </div>
  );
}
