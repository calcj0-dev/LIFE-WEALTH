import { useRef, useState } from 'react';
import { Roulette, SPIN_DURATION_MS } from '../board/Roulette';
import { ASSET_IDS, NO_INVEST_POLICY, POLICY_PRESETS, type PolicyPresetId } from '../data/assets';
import { JOB_IDS } from '../data/jobs';
import { estimateYear, rollJob, validatePolicy } from '../game/engine';
import type { AssetId, GameState, Policy } from '../game/types';
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

type Mode = 'auto' | 'manual' | 'none';
const PRESET_IDS = Object.keys(POLICY_PRESETS) as PolicyPresetId[];

/** 配分を「債券70%、ゴールド30%」のような文にする */
export function describeAllocation(policy: Policy): string {
  return ASSET_IDS.filter((id) => policy.allocation[id] > 0)
    .map((id) => `${t(`asset.${id}`)}${Math.round(policy.allocation[id] * 100)}%`)
    .join('、');
}

/** 投資方針の名前（例: バランス型、手動で投資設定、投資しない） */
export function policyName(policy: Policy): string {
  if (policy.kind === 'none' || policy.investRatio === 0) return t('policy.none');
  if (policy.kind && policy.kind !== 'manual') return t(`policy.${policy.kind}`);
  return t('policy.manual');
}

function modeOf(policy?: Policy): Mode {
  if (!policy) return 'auto';
  if (policy.kind === 'none' || policy.investRatio === 0) return 'none';
  if (policy.kind === 'manual') return 'manual';
  return 'auto';
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
  const [mode, setMode] = useState<Mode>(modeOf(initial));
  const [preset, setPreset] = useState<PolicyPresetId>(
    initial?.kind && PRESET_IDS.includes(initial.kind as PolicyPresetId) ? (initial.kind as PolicyPresetId) : 'balanced',
  );
  const [custom, setCustom] = useState<Policy>(
    structuredClone(initial?.kind === 'manual' ? initial : { ...POLICY_PRESETS.balanced, kind: 'manual' }),
  );
  const policy: Policy = mode === 'none' ? NO_INVEST_POLICY : mode === 'manual' ? { ...custom, kind: 'manual' } : POLICY_PRESETS[preset];
  const valid = validatePolicy(policy);

  const setShare = (id: AssetId, pct: number) =>
    setCustom((c) => ({ ...c, allocation: { ...c.allocation, [id]: pct / 100 } }));

  const body = (
    <>
      {header}
      {!compact && <h2>{t('setup.policy.title')}</h2>}
      <div className="card-grid">
        {(['auto', 'manual', 'none'] as Mode[]).map((m) => (
          <div key={m} className={`card choice-card${mode === m ? ' selected' : ''}`} onClick={() => setMode(m)} role="button" tabIndex={0}>
            <h3>{t(`policy.mode.${m}`)}</h3>
            <div className="muted">{t(`policy.mode.${m}.desc`)}</div>
          </div>
        ))}
      </div>
      {mode === 'auto' && (
        <div className="card-grid">
          {PRESET_IDS.map((id) => (
            <div key={id} className={`card choice-card${preset === id ? ' selected' : ''}`} onClick={() => setPreset(id)} role="button" tabIndex={0}>
              <h3>{t(`policy.${id}`)}</h3>
              <div>{t('setup.policy.ratio', { ratio: Math.round(POLICY_PRESETS[id].investRatio * 100) })}</div>
              <div className="muted">{describeAllocation(POLICY_PRESETS[id])}</div>
            </div>
          ))}
        </div>
      )}
      {mode === 'manual' && (
        <div className="card" style={{ width: 'min(560px, 100%)', display: 'grid', gap: 8 }}>
          <div className="slider-row">
            <span>{t('setup.policy.ratioLabel')}</span>
            <input type="range" min={0} max={100} step={10} value={Math.round(custom.investRatio * 100)}
              onChange={(e) => setCustom((c) => ({ ...c, investRatio: Number(e.target.value) / 100 }))} />
            <span>{Math.round(custom.investRatio * 100)}%</span>
          </div>
          {ASSET_IDS.map((id) => (
            <div key={id} className="slider-row">
              <span>{t(`asset.${id}`)}</span>
              <input type="range" min={0} max={100} step={10} value={Math.round(custom.allocation[id] * 100)}
                onChange={(e) => setShare(id, Number(e.target.value))} />
              <span>{Math.round(custom.allocation[id] * 100)}%</span>
            </div>
          ))}
          {!valid && <div className="minus">{t('setup.policy.invalid')}</div>}
        </div>
      )}
      <button disabled={!valid} onClick={() => onDone(structuredClone(policy))}>
        {doneLabel}
      </button>
    </>
  );
  return compact ? <div className="policy-compact">{body}</div> : <div className="center-screen">{body}</div>;
}
