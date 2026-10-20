// 資産運用の画面。投資方針（割合）の変更と、それに合わせた売り買い、ローンの繰り上げ返済、不動産の売却、保険の解約ができる（design.md 2.1、6.3）。
// 金額を決めて1つの銘柄だけを買う「スポット購入」は設けない。売り買いは割合を変えることで行う。

import { useState } from 'react';
import { ASSET_IDS, sharesOf, type Shares } from '../data/assets';
import { canSellProperty, cancelInsurance, changePolicy, prepay, rebalancePlan, sellProperty } from '../game/engine';
import { assetValue, financialAssets } from '../game/finance';
import type { GameState, Policy } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { PolicySetup, describeShares, policyName } from './Setup';

const PREPAY_AMOUNT = 100;
const SHARE_KEYS = ['deposit', ...ASSET_IDS] as const;

/** 今の割合（銀行預金と資産の合計に対する%） */
function currentShares(s: GameState): Shares {
  const total = Math.max(0, s.player.cash) + financialAssets(s);
  const shares: Shares = { deposit: 0, bond: 0, gold: 0, fund: 0, stock: 0 };
  if (total <= 0) return { ...shares, deposit: 100 };
  shares.deposit = Math.round((Math.max(0, s.player.cash) / total) * 100);
  for (const id of ASSET_IDS) shares[id] = Math.round((assetValue(s, id) / total) * 100);
  return shares;
}

export function AssetManager({ s, onChange, onClose }: { s: GameState; onChange: (next: GameState) => void; onClose: () => void }) {
  const [editPolicy, setEditPolicy] = useState(false);
  const [pending, setPending] = useState<Policy | null>(null);
  const p = s.player;
  const now = currentShares(s);
  const target = sharesOf(p.policy);

  return (
    <div className="overlay">
      <div className="modal wide">
        <h2>{t('manage.title')}</h2>
        <p className="summary-line">{t('manage.deposit', { v: formatMoney(p.cash) })}</p>

        <div className="card">
          <div className="kv">
            <h4>{t('policy.current', { name: policyName(p.policy) })}</h4>
            {!editPolicy && !pending && (
              <button className="secondary" onClick={() => setEditPolicy(true)}>
                {t('manage.policy')}
              </button>
            )}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>{t('manage.shares.title')}</th>
                <th>{t('manage.holding')}</th>
                <th>{t('manage.shares.now')}</th>
                <th>{t('manage.shares.target')}</th>
              </tr>
            </thead>
            <tbody>
              {SHARE_KEYS.map((k) => {
                const r = k === 'deposit' ? undefined : s.marketChange?.rates[k];
                return (
                  <tr key={k}>
                    <td>
                      {t(`asset.${k}`)}
                      {r !== undefined && (
                        <span className={`muted ${r >= 0 ? 'plus' : 'minus'}`}> （{t('manage.price', { v: `${formatSigned(r * 100)}%` })}）</span>
                      )}
                    </td>
                    <td>{formatMoney(k === 'deposit' ? p.cash : assetValue(s, k))}</td>
                    <td>{now[k]}%</td>
                    <td>{target[k]}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editPolicy && (
            <PolicySetup
              compact
              initial={p.policy}
              doneLabel={t('manage.policySave')}
              onDone={(policy) => {
                setEditPolicy(false);
                setPending(policy);
              }}
            />
          )}
          {pending && <RebalanceConfirm s={s} policy={pending} onCancel={() => setPending(null)} onOk={() => {
            onChange(changePolicy(s, pending));
            setPending(null);
          }} />}
        </div>

        <div className="card">
          <h4>{t('manage.properties')}</h4>
          {p.properties.length === 0 && <div className="muted">{t('manage.noProperties')}</div>}
          {p.properties.map((x) => (
            <div key={x.id} className="property-row">
              <span>
                <strong>{t(`manage.property.${x.use}`)}</strong> {t('manage.property.value', { value: formatMoney(x.value) })}
                {x.loan && <> / {t('manage.property.loan', { loan: formatMoney(x.loan.balance) })}</>}
              </span>
              <span className="manage-buttons">
                {x.loan && (
                  <button className="secondary" disabled={p.cash < 1} onClick={() => onChange(prepay(s, x.id, PREPAY_AMOUNT))}>
                    {t('manage.prepay')}
                  </button>
                )}
                <button className="secondary" disabled={!canSellProperty(s, x.id)} onClick={() => onChange(sellProperty(s, x.id))}>
                  {t('manage.sell')}
                </button>
              </span>
            </div>
          ))}
        </div>

        {(p.medicalPremium !== null || p.properties.some((x) => x.fireInsured)) && (
          <div className="card">
            <h4>{t('manage.insurance')}</h4>
            <div className="manage-buttons">
              {p.medicalPremium !== null && (
                <button className="secondary" onClick={() => onChange(cancelInsurance(s, 'medical'))}>
                  {t('manage.cancelMedical')}
                </button>
              )}
              {p.properties.some((x) => x.fireInsured) && (
                <button className="secondary" onClick={() => onChange(cancelInsurance(s, 'fire'))}>
                  {t('manage.cancelFire')}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="options">
          <button onClick={onClose}>{t('manage.close')}</button>
        </div>
      </div>
    </div>
  );
}

/** 方針を変える前に、どんな売り買いが起きるかを見せる */
function RebalanceConfirm({ s, policy, onOk, onCancel }: { s: GameState; policy: Policy; onOk: () => void; onCancel: () => void }) {
  const plan = rebalancePlan(s, policy);
  const moves = ASSET_IDS.filter((id) => Math.abs(plan[id]) >= 1);
  return (
    <div className="confirm">
      <h4>{t('manage.confirm.title')}</h4>
      <p className="muted">{describeShares(sharesOf(policy))}</p>
      {moves.length === 0 && <p>{t('manage.confirm.none')}</p>}
      <ul>
        {moves
          .sort((a, b) => plan[a] - plan[b])
          .map((id) => (
            <li key={id} className={plan[id] > 0 ? 'plus' : 'minus'}>
              {t(plan[id] > 0 ? 'manage.confirm.buy' : 'manage.confirm.sell', {
                name: t(`asset.${id}`),
                amount: Math.abs(plan[id]),
              })}
            </li>
          ))}
      </ul>
      <div className="manage-buttons">
        <button onClick={onOk}>{t('manage.confirm.ok')}</button>
        <button className="secondary" onClick={onCancel}>
          {t('manage.confirm.cancel')}
        </button>
      </div>
    </div>
  );
}
