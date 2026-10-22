// 積み立ての金額を決める画面と、取引タイムの画面（design.md 2.1、6.3）。

import { useState } from 'react';
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

type Mode = 'buy' | 'sell';
/** 選んだ数。金額の銘柄は万円、株は株数。'all' は「全部」 */
type Qty = number | 'all';

/** 売り買いの中身（確定の前に見せる）。units は株数（株のとき）、amount は動く金額 */
function planOf(s: GameState, id: AssetId, mode: Mode, qty: Qty): { units: number; amount: number } {
  const p = s.player;
  const price = s.market.prices[id];
  if (ASSETS[id].unit === 'share') {
    const held = Math.round(p.holdings[id] ?? 0);
    const want = qty === 'all' ? (mode === 'buy' ? Infinity : held) : qty;
    const units = mode === 'buy' ? Math.min(want, Math.floor(Math.max(0, p.cash) / price + 1e-9)) : Math.min(want, held);
    return { units, amount: units * price };
  }
  const value = assetValue(s, id);
  const want = qty === 'all' ? Infinity : qty;
  const amount = mode === 'buy' ? Math.min(want, Math.floor(Math.max(0, p.cash))) : Math.min(want, value);
  return { units: 0, amount };
}

/** 銘柄を選んだあとに出す、売り買いの部分。「買う」「売る」を選んでから、金額（株数）を選び、「確定」で決める（design.md 2.1） */
function TradePanel({ s, id, onChange }: { s: GameState; id: AssetId; onChange: (next: GameState) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [qty, setQty] = useState<Qty | null>(null);
  const share = ASSETS[id].unit === 'share';
  const held = s.player.holdings[id] ?? 0;
  const value = assetValue(s, id);
  const cost = costOf(s, id);
  const choices: Qty[] = [...(share ? TRADE.shares : TRADE.amounts), 'all'];
  const plan = mode && qty !== null ? planOf(s, id, mode, qty) : null;
  const ok = !!plan && plan.amount >= 0.5;
  const cashAfter = plan && mode ? s.player.cash + (mode === 'buy' ? -plan.amount : plan.amount) : s.player.cash;
  const name = t(`asset.${id}`);
  const confirm = () => {
    if (!mode || !plan || !ok) return;
    if (share) onChange(tradeShares(s, id, mode === 'buy' ? plan.units : -plan.units));
    else onChange(trade(s, id, mode === 'buy' ? plan.amount : -(qty === 'all' ? value + 1 : plan.amount)));
    setQty(null);
  };
  return (
    <div className="trade-panel">
      <h4>{name}</h4>
      <AssetPriceChart points={s.prices} id={id} avgCost={held > 0 ? cost / held : undefined} />
      <div className="trade-step">
        <span className="trade-step-label">{t('trade.step.mode')}</span>
        <button className={mode === 'buy' ? 'small' : 'secondary small'} onClick={() => setMode('buy')}>
          {t('trade.buy')}
        </button>
        <button className={mode === 'sell' ? 'small' : 'secondary small'} disabled={value < 0.5} onClick={() => setMode('sell')}>
          {t('trade.sell')}
        </button>
      </div>
      {mode && (
        <div className="trade-step">
          <span className="trade-step-label">{t(share ? 'trade.step.shares' : 'trade.step.amount')}</span>
          {choices.map((c) => (
            <button key={String(c)} className={qty === c ? 'small' : 'secondary small'} onClick={() => setQty(c)}>
              {c === 'all' ? t('trade.all') : share ? t('trade.sharesCount', { n: c }) : formatMoney(c)}
            </button>
          ))}
        </div>
      )}
      {mode && plan && (
        <div className={`trade-preview${ok ? '' : ' minus'}`}>
          {ok ? (
            <>
              <div>
                {share
                  ? t(mode === 'buy' ? 'trade.preview.buyShares' : 'trade.preview.sellShares', { name, n: plan.units, amount: Math.round(plan.amount) })
                  : t(mode === 'buy' ? 'trade.preview.buy' : 'trade.preview.sell', { name, amount: Math.round(plan.amount) })}
              </div>
              <div>{t('trade.preview.deposit', { from: formatMoney(s.player.cash), to: formatMoney(cashAfter) })}</div>
            </>
          ) : (
            <div>{t(mode === 'buy' ? 'trade.preview.noCash' : 'trade.preview.noHolding')}</div>
          )}
          <button disabled={!ok} onClick={confirm}>
            {t('trade.confirm')}
          </button>
        </div>
      )}
    </div>
  );
}

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
  /** 選んでいる銘柄 */
  const [selected, setSelected] = useState<AssetId | null>(null);
  const p = s.player;
  const rates = s.marketChange?.rates;

  return (
    <div className="overlay">
      <div className="modal wide trade-modal">
        <h2>{card ? t('trade.cardTitle', { year: s.year, month: s.month }) : t('trade.title', { year: s.year })}</h2>
        <p className="muted">{t(card ? 'trade.cardLead' : 'trade.lead')}</p>
        <p className="summary-line">{t('trade.deposit', { amount: p.cash })}</p>

        <div className="card">
          <p className="muted">{t('trade.pick')}</p>
          <table className="table trade-list">
            <thead>
              <tr>
                <th>{t('trade.asset')}</th>
                <th>{t('trade.price')}</th>
                <th>{t('trade.holding')}</th>
                <th>{t('trade.profit')}</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_IDS.map((id) => {
                const share = ASSETS[id].unit === 'share';
                const value = assetValue(s, id);
                const cost = costOf(s, id);
                const profit = Math.round(value) - Math.round(cost);
                const held = Math.round(p.holdings[id] ?? 0);
                const r = rates?.[id];
                return (
                  <tr key={id} className={`trade-row${selected === id ? ' selected' : ''}`} onClick={() => setSelected(selected === id ? null : id)}>
                    <td>
                      <div className="trade-name">{t(`asset.${id}`)}</div>
                      {r !== undefined && <div className={`trade-sub ${r >= 0 ? 'plus' : 'minus'}`}>{t('trade.yearRate', { rate: `${formatSigned(r * 100)}%` })}</div>}
                    </td>
                    <td className="ledger-money">{share ? t('trade.pricePerShare', { amount: s.market.prices[id] }) : '—'}</td>
                    <td className="ledger-money">
                      {value >= 0.5 ? formatMoney(value) : '—'}
                      {share && held > 0 && <div className="trade-sub">{t('trade.sharesCount', { n: held })}</div>}
                    </td>
                    <td className={`ledger-money ${profit >= 0 ? 'plus' : 'minus'}`}>
                      {cost >= 0.5 ? `${profit > 0 ? '+' : ''}${formatMoney(profit)}` : '—'}
                      {cost >= 0.5 && <div className="trade-sub">{formatSigned((profit / cost) * 100)}%</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selected && <TradePanel key={selected} s={s} id={selected} onChange={onChange} />}
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
