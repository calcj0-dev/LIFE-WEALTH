// 積み立ての金額を決める画面と、取引タイムの画面（design.md 2.1、6.3）。

import { Fragment, useState } from 'react';
import { ASSETS, ASSET_IDS } from '../data/assets';
import { TRADE } from '../data/rules';
import {
  canQuitFire,
  canSellHome,
  homeSaleProceeds,
  joinMedical,
  medicalPremiumAt,
  prepay,
  quitMedical,
  recommendedSaving,
  sellHome,
  setFireInsurance,
  setSaving,
  trade,
  tradeShares,
} from '../game/engine';
import { assetValue, costOf } from '../game/finance';
import type { AssetId, GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { AssetPriceChart } from './PriceCharts';
import { BudgetCard } from './Setup';

const SAVING_IDS = ASSET_IDS.filter((id) => ASSETS[id].accumulate);

/** 積み立ての金額を、1万円ずつ増やしたり減らしたりする部品 */
function SavingEditor({ s, saving, onChange }: { s: GameState; saving: Record<AssetId, number>; onChange: (next: Record<AssetId, number>) => void }) {
  const set = (id: AssetId, v: number) => onChange({ ...saving, [id]: Math.max(0, v) });
  const recommend = recommendedSaving(s);
  return (
    <div className="saving-editor">
      {SAVING_IDS.map((id) => (
        <div key={id} className="saving-row">
          <span className="saving-name">{t(`asset.${id}`)}</span>
          <button className="secondary small" disabled={saving[id] <= 0} onClick={() => set(id, saving[id] - 1)}>
            −1万
          </button>
          <strong className="saving-amount">{t('saving.perMonth', { amount: saving[id] })}</strong>
          <button className="secondary small" onClick={() => set(id, saving[id] + 1)}>
            ＋1万
          </button>
          <button className="secondary small" onClick={() => set(id, recommend)}>
            {t('saving.recommend', { amount: recommend })}
          </button>
          <button className="secondary small" disabled={saving[id] === 0} onClick={() => set(id, 0)}>
            {t('saving.none')}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 積み立ての設定（ゲームの始め）

export function SavingSetup({ s, onDone }: { s: GameState; onDone: (next: GameState) => void }) {
  const [saving, setSavingDraft] = useState<Record<AssetId, number>>({ ...s.player.saving });
  const preview = { ...s, player: { ...s.player, saving } };
  return (
    <div className="center-screen">
      <h2>{t('setup.saving.title')}</h2>
      <p className="muted" style={{ maxWidth: 620 }}>
        {t('setup.saving.lead')}
      </p>
      <div className="card" style={{ width: 'min(640px, 100%)' }}>
        <SavingEditor s={s} saving={saving} onChange={setSavingDraft} />
        <p className="muted">{t('setup.saving.note')}</p>
      </div>
      <BudgetCard s={preview} title={t('budget.title')} />
      <button onClick={() => onDone(setSaving(s, saving))}>{t('setup.saving.start')}</button>
    </div>
  );
}

// ---------------------------------------------------------------- 取引タイム

export function TradeModal({
  s,
  onChange,
  onDone,
  card,
}: {
  s: GameState;
  onChange: (next: GameState) => void;
  onDone: () => void;
  /** 取引カードで開いたとき */
  card?: boolean;
}) {
  const [unit, setUnit] = useState(TRADE.amounts[1]);
  const [shareUnit, setShareUnit] = useState(TRADE.shares[0]);
  /** チャートを開いている銘柄 */
  const [chart, setChart] = useState<AssetId | null>(null);
  const p = s.player;
  const rates = s.marketChange?.rates;

  return (
    <div className="overlay">
      <div className="modal wide trade-modal">
        <h2>{card ? t('trade.cardTitle', { year: s.year, month: s.month }) : t('trade.title', { year: s.year })}</h2>
        <p className="muted">{t(card ? 'trade.cardLead' : 'trade.lead')}</p>
        <p className="summary-line">{t('trade.deposit', { amount: p.cash })}</p>

        <div className="card">
          <div className="trade-units">
            <span>{t('trade.unit')}</span>
            {TRADE.amounts.map((a) => (
              <button key={a} className={a === unit ? 'small' : 'secondary small'} onClick={() => setUnit(a)}>
                {formatMoney(a)}
              </button>
            ))}
            <span>{t('trade.shareUnit')}</span>
            {TRADE.shares.map((n) => (
              <button key={n} className={n === shareUnit ? 'small' : 'secondary small'} onClick={() => setShareUnit(n)}>
                {t('trade.sharesCount', { n })}
              </button>
            ))}
          </div>
          <div className="return-table">
            <table className="table trade-table">
              <thead>
                <tr>
                  <th>{t('trade.asset')}</th>
                  <th>{t('trade.price')}</th>
                  <th>{t('trade.rate')}</th>
                  <th>{t('trade.holding')}</th>
                  <th>{t('trade.cost')}</th>
                  <th>{t('trade.value')}</th>
                  <th>{t('trade.profit')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ASSET_IDS.map((id) => {
                  const share = ASSETS[id].unit === 'share';
                  const price = s.market.prices[id];
                  const value = assetValue(s, id);
                  const cost = costOf(s, id);
                  const profit = value - cost;
                  const held = p.holdings[id] ?? 0;
                  const r = rates?.[id];
                  const canBuy = share ? p.cash >= price : p.cash >= unit;
                  const buy = () => onChange(share ? tradeShares(s, id, shareUnit) : trade(s, id, unit));
                  const sell = () => onChange(share ? tradeShares(s, id, -shareUnit) : trade(s, id, -unit));
                  const sellAll = () => onChange(share ? tradeShares(s, id, -Math.round(held)) : trade(s, id, -value - 1));
                  return (
                    <Fragment key={id}>
                      <tr>
                        <td>{t(`asset.${id}`)}</td>
                        <td className="ledger-money">{share ? t('trade.pricePerShare', { amount: price }) : '—'}</td>
                        <td className={r === undefined ? '' : r >= 0 ? 'plus' : 'minus'}>{r === undefined ? '—' : `${formatSigned(r * 100)}%`}</td>
                        <td className="ledger-money">{share ? t('trade.sharesCount', { n: Math.round(held) }) : value >= 0.5 ? formatMoney(value) : '—'}</td>
                        <td className="ledger-money">{cost >= 0.5 ? formatMoney(cost) : '—'}</td>
                        <td className="ledger-money">{value >= 0.5 ? formatMoney(value) : '—'}</td>
                        <td className={`ledger-money ${profit >= 0 ? 'plus' : 'minus'}`}>
                          {cost >= 0.5 ? `${profit > 0 ? '+' : ''}${formatMoney(profit)}（${formatSigned((profit / cost) * 100)}%）` : '—'}
                        </td>
                        <td className="trade-buttons">
                          <button className="small" disabled={!canBuy} onClick={buy}>
                            {t('trade.buy')}
                          </button>
                          <button className="secondary small" disabled={value < 0.5} onClick={sell}>
                            {t('trade.sell')}
                          </button>
                          <button className="secondary small" disabled={value < 0.5} onClick={sellAll}>
                            {t('trade.sellAll')}
                          </button>
                          <button className="secondary small" onClick={() => setChart(chart === id ? null : id)}>
                            {t(chart === id ? 'trade.chartClose' : 'trade.chart')}
                          </button>
                        </td>
                      </tr>
                      {chart === id && (
                        <tr>
                          <td colSpan={8}>
                            <AssetPriceChart points={s.prices} id={id} avgCost={held > 0 ? cost / held : undefined} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h4>{t('trade.saving')}</h4>
          <SavingEditor s={s} saving={p.saving} onChange={(next) => onChange(setSaving(s, next))} />
        </div>

        <div className="card">
          <h4>{t('trade.insurance')}</h4>
          <div className="manage-buttons">
            {p.medicalPremium === null ? (
              <button className="secondary" onClick={() => onChange(joinMedical(s))}>
                {t('trade.medical.join', { premium: medicalPremiumAt(s.year) })}
              </button>
            ) : (
              <button className="secondary" onClick={() => onChange(quitMedical(s))}>
                {t('trade.medical.quit', { premium: p.medicalPremium })}
              </button>
            )}
            {p.home && !p.home.fireInsured && (
              <button className="secondary" onClick={() => onChange(setFireInsurance(s, true))}>
                {t('trade.fire.join')}
              </button>
            )}
            {p.home?.fireInsured && (
              <button className="secondary" disabled={!canQuitFire(s)} title={canQuitFire(s) ? undefined : t('trade.fire.loan')} onClick={() => onChange(setFireInsurance(s, false))}>
                {t('trade.fire.quit')}
              </button>
            )}
          </div>
        </div>

        {p.home && (
          <div className="card">
            <h4>{t('trade.home')}</h4>
            <div className="muted">
              {t('trade.home.value', { amount: p.home.value })}
              {p.home.loan && <> / {t('trade.home.loan', { amount: p.home.loan.balance })}</>}
            </div>
            <div className="manage-buttons">
              {p.home.loan && (
                <button className="secondary" disabled={p.cash < 1} onClick={() => onChange(prepay(s, TRADE.prepayUnit))}>
                  {t('trade.prepay', { amount: TRADE.prepayUnit })}
                </button>
              )}
              <button className="secondary" disabled={!canSellHome(s)} onClick={() => onChange(sellHome(s))}>
                {t('trade.sellHome', { amount: homeSaleProceeds(s) })}
              </button>
            </div>
          </div>
        )}

        <div className="options">
          <button onClick={onDone}>{t(card ? 'trade.cardDone' : 'trade.done')}</button>
        </div>
      </div>
    </div>
  );
}
