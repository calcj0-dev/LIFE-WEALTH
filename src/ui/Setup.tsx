import { useRef, useState } from 'react';
import { Roulette, SPIN_DURATION_MS } from '../board/Roulette';
import { ASSET_IDS, NO_INVEST_POLICY, POLICY_PRESETS, policyFromShares, sharesOf, type PolicyPresetId, type Shares } from '../data/assets';
import { JOB_IDS } from '../data/jobs';
import { estimateYear, rollJob } from '../game/engine';
import type { GameState, Policy } from '../game/types';
import { formatMoney, t } from '../i18n';
import { MoneyDelta } from './Delta';

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

// ---------------------------------------------------------------- 家計の予定

export function BudgetCard({ s, title }: { s: GameState; title: string }) {
  const { income, expense, net } = estimateYear(s);
  const rows = (items: Record<string, number>) =>
    Object.entries(items)
      .filter(([, v]) => Math.round(v) !== 0)
      .map(([k, v]) => (
        <div key={k} className="kv">
          <span>{t(`settle.${k}`)}</span>
          <span className="v">{formatMoney(v)}</span>
        </div>
      ));
  const sum = (items: Record<string, number>) => Object.values(items).reduce((a, b) => a + b, 0);
  return (
    <div className="card budget">
      <h4>{title}</h4>
      <div className="two-col">
        <div>
          <div className="kv">
            <strong className="plus">{t('budget.income')}</strong>
            <strong>{formatMoney(sum(income))}</strong>
          </div>
          {rows(income)}
        </div>
        <div>
          <div className="kv">
            <strong className="minus">{t('budget.expense')}</strong>
            <strong>{formatMoney(sum(expense))}</strong>
          </div>
          {rows(expense)}
        </div>
      </div>
      <p className="summary-line">
        {t('budget.net')}: <MoneyDelta v={net} big />
        {Math.round(net) === 0 && formatMoney(0)}
      </p>
      <p className="muted">{t('budget.note')}</p>
    </div>
  );
}

// ---------------------------------------------------------------- 投資方針

type Choice = 'none' | PolicyPresetId | 'manual';
const CHOICES: Choice[] = ['none', 'safe', 'balanced', 'aggressive', 'manual'];
const SHARE_KEYS = ['deposit', ...ASSET_IDS] as const;
type ShareKey = (typeof SHARE_KEYS)[number];

/** 割合を「銀行預金50%、投資信託35%」のような文にする */
export function describeShares(shares: Shares): string {
  return SHARE_KEYS.filter((k) => shares[k] > 0)
    .map((k) => `${t(`asset.${k}`)}${shares[k]}%`)
    .join('、');
}

/** 投資方針の名前（例: バランス型、手動、預金だけ） */
export function policyName(policy: Policy): string {
  if (policy.kind === 'none' || policy.investRatio === 0) return t('policy.none');
  if (policy.kind && policy.kind !== 'manual') return t(`policy.${policy.kind}`);
  return t('policy.manual');
}

function choiceOf(policy?: Policy): Choice {
  if (!policy) return 'balanced';
  if (policy.kind === 'none' || policy.investRatio === 0) return 'none';
  if (policy.kind && policy.kind !== 'manual') return policy.kind;
  return 'manual';
}

function policyFor(choice: Choice, manual: Shares): Policy {
  if (choice === 'none') return NO_INVEST_POLICY;
  if (choice === 'manual') return policyFromShares('manual', manual);
  return POLICY_PRESETS[choice];
}

export function PolicySetup({
  initial,
  onDone,
  doneLabel,
  header,
  compact,
}: {
  initial?: Policy;
  onDone: (p: Policy) => void;
  doneLabel: string;
  header?: React.ReactNode;
  compact?: boolean;
}) {
  const [choice, setChoice] = useState<Choice>(choiceOf(initial));
  const [manual, setManual] = useState<Shares>(initial ? sharesOf(initial) : sharesOf(POLICY_PRESETS.balanced));
  const total = SHARE_KEYS.reduce((a, k) => a + manual[k], 0);
  const valid = choice !== 'manual' || total === 100;
  const setShare = (k: ShareKey, v: number) => setManual((m) => ({ ...m, [k]: v }));

  const body = (
    <>
      {header}
      {!compact && <h2>{t('setup.policy.title')}</h2>}
      <p className="muted" style={{ maxWidth: 600 }}>{t('setup.policy.lead')}</p>
      <div className="card-grid">
        {CHOICES.map((c) => (
          <div key={c} className={`card choice-card${choice === c ? ' selected' : ''}`} onClick={() => setChoice(c)} role="button" tabIndex={0}>
            <h3>{t(`policy.${c}`)}</h3>
            <div className="muted">{c === 'manual' ? t('policy.manual.desc') : describeShares(sharesOf(policyFor(c, manual)))}</div>
          </div>
        ))}
      </div>
      {choice === 'manual' && (
        <div className="card" style={{ width: 'min(560px, 100%)', display: 'grid', gap: 8 }}>
          {SHARE_KEYS.map((k) => (
            <div key={k} className="slider-row">
              <span>{t(`asset.${k}`)}</span>
              <input type="range" min={0} max={100} step={10} value={manual[k]} onChange={(e) => setShare(k, Number(e.target.value))} />
              <span>{manual[k]}%</span>
            </div>
          ))}
          <div className={total === 100 ? 'muted' : 'minus'}>{t('setup.policy.total', { total })}</div>
        </div>
      )}
      <button disabled={!valid} onClick={() => onDone(structuredClone(policyFor(choice, manual)))}>
        {doneLabel}
      </button>
    </>
  );
  return compact ? <div className="policy-compact">{body}</div> : <div className="center-screen">{body}</div>;
}
