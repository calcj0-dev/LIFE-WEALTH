// 積み立ての金額を決める画面と、取引タイムの画面（design.md 2.1、6.3）。
// 取引タイムは「売り買い」「積み立て」「保険・家」に分け、1回に1つだけ見せる。

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
  sellHome,
  setFireInsurance,
  setSaving,
  trade,
  tradeShares,
} from '../game/engine';
import { assetValue, costOf, financialAssets } from '../game/finance';
import type { AssetId, GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { AssetPriceChart } from './PriceCharts';
import { BudgetCard } from './Setup';

const SAVING_IDS = ASSET_IDS.filter((id) => ASSETS[id].accumulate);

/** 積み立ての金額を、1万円ずつ増やしたり減らしたりする部品（おすすめの金額は出さない。design.md 6.3） */
function SavingEditor({ saving, onChange }: { saving: Record<AssetId, number>; onChange: (next: Record<AssetId, number>) => void }) {
  const set = (id: AssetId, v: number) => onChange({ ...saving, [id]: Math.max(0, v) });
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
        <SavingEditor saving={saving} onChange={setSavingDraft} />
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
type Tab = 'trade' | 'saving' | 'other';
const TABS: Tab[] = ['trade', 'saving', 'other'];

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

/** 1年の値動き。分からないときは null */
function yearRate(s: GameState, id: AssetId): number | null {
  const r = s.marketChange?.rates[id];
  return r === undefined ? null : r;
}

function RateText({ r, className = '' }: { r: number | null; className?: string }) {
  if (r === null) return null;
  return <span className={`${className} ${r >= 0 ? 'plus' : 'minus'}`}>{t('trade.yearRate', { rate: `${formatSigned(r * 100)}%` })}</span>;
}

/** 持っている額と利益 */
function holdingOf(s: GameState, id: AssetId) {
  const value = assetValue(s, id);
  const cost = costOf(s, id);
  const profit = Math.round(value) - Math.round(cost);
  return { value, cost, profit, held: Math.round(s.player.holdings[id] ?? 0), owned: value >= 0.5 };
}

function ProfitText({ profit, cost }: { profit: number; cost: number }) {
  if (cost < 0.5) return null;
  return (
    <span className={profit >= 0 ? 'plus' : 'minus'}>
      {t('trade.profitLine', { amount: `${profit > 0 ? '+' : ''}${formatMoney(profit)}`, rate: `${formatSigned((profit / cost) * 100)}%` })}
    </span>
  );
}

/** 銘柄の一覧。「持っている」と「持っていない」に分ける（design.md 2.1） */
function TradeList({ s, selected, onSelect }: { s: GameState; selected: AssetId | null; onSelect: (id: AssetId) => void }) {
  const owned = ASSET_IDS.filter((id) => holdingOf(s, id).owned);
  const others = ASSET_IDS.filter((id) => !holdingOf(s, id).owned);
  const row = (id: AssetId) => {
    const h = holdingOf(s, id);
    const share = ASSETS[id].unit === 'share';
    const sub = h.owned ? (share ? t('trade.sharesCount', { n: h.held }) : '') : share ? t('trade.perShare', { amount: s.market.prices[id] }) : '';
    return (
      <button key={id} className={`trade-item${selected === id ? ' selected' : ''}`} onClick={() => onSelect(id)}>
        <span className="trade-item-main">
          <span className="trade-name">{t(`asset.${id}`)}</span>
          {sub && <span className="trade-sub">{sub}</span>}
        </span>
        {h.owned ? (
          <span className="trade-item-side">
            <strong>{formatMoney(h.value)}</strong>
            <span className="trade-sub">
              <ProfitText profit={h.profit} cost={h.cost} />
            </span>
          </span>
        ) : (
          <span className="trade-item-side">
            <RateText r={yearRate(s, id)} />
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="trade-items">
      <div className="trade-group">{t('trade.owned')}</div>
      {owned.length > 0 ? owned.map(row) : <p className="muted trade-empty">{t('trade.ownedNone')}</p>}
      <div className="trade-group">{t('trade.notOwned')}</div>
      {others.map(row)}
    </div>
  );
}

/** 選んだ銘柄の売り買い。「買う」「売る」を選んでから、金額（株数）を選び、「確定」で決める（design.md 2.1） */
function TradePanel({ s, id, onTrade, onBack }: { s: GameState; id: AssetId; onTrade: (next: GameState, message: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [qty, setQty] = useState<Qty | null>(null);
  const share = ASSETS[id].unit === 'share';
  const h = holdingOf(s, id);
  const units = s.player.holdings[id] ?? 0;
  const choices: Qty[] = [...(share ? TRADE.shares : TRADE.amounts), 'all'];
  const plan = mode && qty !== null ? planOf(s, id, mode, qty) : null;
  const ok = !!plan && plan.amount >= 0.5;
  const cashAfter = plan && mode ? s.player.cash + (mode === 'buy' ? -plan.amount : plan.amount) : s.player.cash;
  const name = t(`asset.${id}`);
  const what = (done: boolean) =>
    plan && mode
      ? share
        ? t(`trade.${done ? 'did' : 'preview'}.${mode}Shares`, { name, n: plan.units, amount: Math.round(plan.amount) })
        : t(`trade.${done ? 'did' : 'preview'}.${mode}`, { name, amount: Math.round(plan.amount) })
      : '';
  const confirm = () => {
    if (!mode || !plan || !ok) return;
    const next = share ? tradeShares(s, id, mode === 'buy' ? plan.units : -plan.units) : trade(s, id, mode === 'buy' ? plan.amount : -(qty === 'all' ? h.value + 1 : plan.amount));
    onTrade(next, what(true));
    setQty(null);
  };
  return (
    <div className="trade-panel">
      <button className="secondary small trade-back" onClick={onBack}>
        {t('trade.back')}
      </button>
      <div className="trade-panel-head">
        <h4>{name}</h4>
        <RateText r={yearRate(s, id)} className="trade-big-rate" />
      </div>
      <div className="trade-sub">
        {share && `${t('trade.perShare', { amount: s.market.prices[id] })} / `}
        {h.owned ? (
          <>
            {t('trade.youHave', { amount: Math.round(h.value) })}
            {share && `（${t('trade.sharesCount', { n: h.held })}）`} <ProfitText profit={h.profit} cost={h.cost} />
          </>
        ) : (
          t('trade.youHaveNone')
        )}
      </div>
      <AssetPriceChart points={s.prices} id={id} avgCost={units > 0 ? h.cost / units : undefined} compact />
      <div className="trade-step">
        <span className="trade-step-label">{t('trade.step.mode')}</span>
        <button className={mode === 'buy' ? 'small' : 'secondary small'} onClick={() => setMode('buy')}>
          {t('trade.buy')}
        </button>
        <button className={mode === 'sell' ? 'small' : 'secondary small'} disabled={!h.owned} onClick={() => setMode('sell')}>
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
            <div>
              <div>{what(false)}</div>
              <div className="trade-sub">{t('trade.preview.deposit', { from: formatMoney(s.player.cash), to: formatMoney(cashAfter) })}</div>
            </div>
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
  const [tab, setTab] = useState<Tab>('trade');
  /** 選んでいる銘柄 */
  const [selected, setSelected] = useState<AssetId | null>(null);
  /** この取引タイムで行ったこと（「投資信託を 10万円 買いました」） */
  const [done, setDone] = useState<string[]>([]);
  const p = s.player;

  return (
    <div className="overlay">
      <div className="modal wide trade-modal">
        <h2>{card ? t('trade.cardTitle', { year: s.year, month: s.month }) : t('trade.title', { year: s.year })}</h2>
        <p className="muted trade-lead">{t(card ? 'trade.cardLead' : 'trade.lead')}</p>
        <div className="trade-totals">
          <span>
            {t('trade.depositLabel')} <strong>{formatMoney(p.cash)}</strong>
          </span>
          <span>
            {t('trade.investTotal')} <strong>{formatMoney(financialAssets(s))}</strong>
          </span>
        </div>
        {/* この取引タイムで行ったこと。いつも見える、上のほうに出す */}
        {done.length > 0 && (
          <ul className="trade-done">
            {done.map((m, i) => (
              <li key={i}>✔ {m}</li>
            ))}
          </ul>
        )}
        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? undefined : 'secondary'} onClick={() => setTab(id)}>
              {t(`trade.tab.${id}`)}
            </button>
          ))}
        </div>

        {tab === 'trade' && (
          <>
            <div className={`trade-split${selected ? ' has-selected' : ''}`}>
              <div className="trade-list-pane">
                <TradeList s={s} selected={selected} onSelect={setSelected} />
              </div>
              <div className="trade-panel-pane">
                {selected ? (
                  <TradePanel
                    key={selected}
                    s={s}
                    id={selected}
                    onBack={() => setSelected(null)}
                    onTrade={(next, message) => {
                      onChange(next);
                      setDone((d) => [...d, message]);
                    }}
                  />
                ) : (
                  <p className="muted trade-pick">{t('trade.pick')}</p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'saving' && (
          <div className="card">
            <h4>{t('trade.saving')}</h4>
            <SavingEditor saving={p.saving} onChange={(next) => onChange(setSaving(s, next))} />
          </div>
        )}

        {tab === 'other' && (
          <>
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
            <div className="card">
              <h4>{t('trade.home')}</h4>
              {p.home ? (
                <>
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
                </>
              ) : (
                <p className="muted">{t('trade.home.none')}</p>
              )}
            </div>
          </>
        )}

        <div className="options">
          <button onClick={onDone}>{t(card ? 'trade.cardDone' : 'trade.done')}</button>
        </div>
      </div>
    </div>
  );
}
