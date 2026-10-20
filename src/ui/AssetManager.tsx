// 資産運用の画面。自分で売買、投資方針の変更、ローンの繰り上げ返済、不動産の売却、保険の解約ができる（design.md 2.1）。

import { useState } from 'react';
import { ASSET_IDS } from '../data/assets';
import { canSellProperty, cancelInsurance, changePolicy, prepay, sellProperty, trade } from '../game/engine';
import { assetValue } from '../game/finance';
import type { AssetId, GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { PolicySetup, describeAllocation, policyName } from './Setup';

const PREPAY_AMOUNT = 100;

export function AssetManager({ s, onChange, onClose }: { s: GameState; onChange: (next: GameState) => void; onClose: () => void }) {
  const [editPolicy, setEditPolicy] = useState(false);
  const p = s.player;
  const rate = (id: AssetId) => s.marketChange?.rates[id];

  const buy = (id: AssetId, amount: number) => onChange(trade(s, id, Math.min(amount, p.cash)));
  const sell = (id: AssetId, share: number) => onChange(trade(s, id, -assetValue(s, id) * share));

  return (
    <div className="overlay">
      <div className="modal wide">
        <h2>{t('manage.title')}</h2>
        <p className="summary-line">{t('manage.deposit', { v: formatMoney(p.cash) })}</p>

        <div className="manage-grid">
          {ASSET_IDS.map((id) => {
            const value = assetValue(s, id);
            const r = rate(id);
            return (
              <div key={id} className="card">
                <h4>{t(`asset.${id}`)}</h4>
                <div className="kv">
                  <span>{t('manage.holding')}</span>
                  <span className="v">{formatMoney(value)}</span>
                </div>
                {r !== undefined && (
                  <div className={`muted ${r >= 0 ? 'plus' : 'minus'}`}>{t('manage.price', { v: `${formatSigned(r * 100)}%` })}</div>
                )}
                <div className="manage-buttons">
                  <button disabled={p.cash < 10} onClick={() => buy(id, 10)}>{t('manage.buy10')}</button>
                  <button disabled={p.cash < 100} onClick={() => buy(id, 100)}>{t('manage.buy100')}</button>
                  <button className="secondary" disabled={value < 1} onClick={() => sell(id, 0.5)}>{t('manage.sellHalf')}</button>
                  <button className="secondary" disabled={value < 1} onClick={() => sell(id, 1)}>{t('manage.sellAll')}</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="kv">
            <h4>{t('policy.current', { name: policyName(p.policy) })}</h4>
            {!editPolicy && (
              <button className="secondary" onClick={() => setEditPolicy(true)}>{t('manage.policy')}</button>
            )}
          </div>
          {p.policy.investRatio > 0 && (
            <div className="muted">
              {t('setup.policy.ratio', { ratio: Math.round(p.policy.investRatio * 100) })}、{describeAllocation(p.policy)}
            </div>
          )}
          {editPolicy && (
            <PolicySetup
              compact
              initial={p.policy}
              doneLabel={t('manage.policySave')}
              onDone={(policy) => {
                onChange(changePolicy(s, policy));
                setEditPolicy(false);
              }}
            />
          )}
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
                <button className="secondary" onClick={() => onChange(cancelInsurance(s, 'medical'))}>{t('manage.cancelMedical')}</button>
              )}
              {p.properties.some((x) => x.fireInsured) && (
                <button className="secondary" onClick={() => onChange(cancelInsurance(s, 'fire'))}>{t('manage.cancelFire')}</button>
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
