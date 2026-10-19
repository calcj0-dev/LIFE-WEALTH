import { useState } from 'react';
import { ASSET_IDS, POLICY_PRESETS, type PolicyPresetId } from '../data/assets';
import { JOBS, JOB_IDS } from '../data/jobs';
import { validatePolicy } from '../game/engine';
import type { AssetId, JobId, Policy } from '../game/types';
import { t } from '../i18n';

export function JobSelect({ onChoose }: { onChoose: (job: JobId) => void }) {
  return (
    <div className="center-screen">
      <h2>{t('setup.job.title')}</h2>
      <div className="card-grid">
        {JOB_IDS.map((id) => (
          <div key={id} className="card choice-card" onClick={() => onChoose(id)} role="button" tabIndex={0}>
            <h3>{t(`job.${id}`)}</h3>
            <div>{t('setup.job.salary', { salary: JOBS[id].startSalary })}</div>
            <div className="muted">{t(`job.${id}.desc`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRESET_IDS = Object.keys(POLICY_PRESETS) as PolicyPresetId[];

/** 配分を「債券70%、ゴールド30%」のような文にする */
export function describeAllocation(policy: Policy): string {
  return ASSET_IDS.filter((id) => policy.allocation[id] > 0)
    .map((id) => `${t(`asset.${id}`)}${Math.round(policy.allocation[id] * 100)}%`)
    .join('、');
}

export function PolicySetup({ initial, onDone, doneLabel }: { initial?: Policy; onDone: (p: Policy) => void; doneLabel: string }) {
  const [mode, setMode] = useState<PolicyPresetId | 'custom'>('balanced');
  const [custom, setCustom] = useState<Policy>(structuredClone(initial ?? POLICY_PRESETS.balanced));
  const policy = mode === 'custom' ? custom : POLICY_PRESETS[mode];
  const valid = validatePolicy(policy);

  const setShare = (id: AssetId, pct: number) =>
    setCustom((c) => ({ ...c, allocation: { ...c.allocation, [id]: pct / 100 } }));

  return (
    <div className="center-screen">
      <h2>{t('setup.policy.title')}</h2>
      <p className="muted" style={{ maxWidth: 560 }}>{t('setup.policy.lead')}</p>
      <div className="card-grid">
        {PRESET_IDS.map((id) => (
          <div key={id} className={`card choice-card${mode === id ? ' selected' : ''}`} onClick={() => setMode(id)} role="button" tabIndex={0}>
            <h3>{t(`policy.${id}`)}</h3>
            <div>{t('setup.policy.ratio', { ratio: Math.round(POLICY_PRESETS[id].investRatio * 100) })}</div>
            <div className="muted">{describeAllocation(POLICY_PRESETS[id])}</div>
          </div>
        ))}
        <div className={`card choice-card${mode === 'custom' ? ' selected' : ''}`} onClick={() => setMode('custom')} role="button" tabIndex={0}>
          <h3>{t('setup.policy.custom')}</h3>
          <div className="muted">{describeAllocation(custom) || '—'}</div>
        </div>
      </div>
      {mode === 'custom' && (
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
      <button disabled={!valid} onClick={() => onDone(structuredClone(policy))}>{doneLabel}</button>
    </div>
  );
}
