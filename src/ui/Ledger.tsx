// 家計の予定と年末決算で使う部品。最初はシンプルに見せ、詳しい内容は「詳しく見る」で開く（design.md 2.2）。
// 色は、収入・プラスを緑、支出・マイナスを赤に統一する。

import { useState } from 'react';
import { ASSET_IDS } from '../data/assets';
import type { GameState, LogEntry } from '../game/types';
import { formatMoney, t } from '../i18n';
import { MoneyDelta } from './Delta';
import { logLabel } from './logLabel';

const INCOME_ORDER = ['salary', 'spouse', 'sideBusiness', 'interest', 'bond', 'dividend'];
const EXPENSE_ORDER = ['living', 'jobCost', 'education', 'loan', 'insurance'];
const ICONS: Record<string, string> = {
  salary: '💼',
  spouse: '👫',
  sideBusiness: '🧩',
  interest: '🏦',
  bond: '📜',
  dividend: '📈',
  living: '🍚',
  jobCost: '🧰',
  education: '🎓',
  loan: '🏠',
  insurance: '🛡️',
};

const sum = (items: Record<string, number>) => Object.values(items).reduce((a, b) => a + b, 0);

/** 大きな数字3つ（収入・支出・残ったお金） */
export function MoneySummary({ income, expense, plan }: { income: number; expense: number; plan?: boolean }) {
  const net = income - expense;
  return (
    <div className="money-summary">
      <div className="money-card income">
        <span>{t('summary.income')}</span>
        <strong>{formatMoney(income)}</strong>
      </div>
      <div className="money-card expense">
        <span>{t('summary.expense')}</span>
        <strong>{formatMoney(expense)}</strong>
      </div>
      <div className={`money-card net ${net >= 0 ? 'plus' : 'minus'}`}>
        <span>{t(plan ? 'summary.netPlan' : 'summary.netActual')}</span>
        <strong>
          {net > 0 ? '+' : ''}
          {formatMoney(net)}
        </strong>
      </div>
    </div>
  );
}

function rowsOf(items: Record<string, number>, order: string[]) {
  return order.filter((k) => Math.round(items[k] ?? 0) !== 0).map((k) => ({ k, v: items[k] }));
}

/** 家計簿のような左右の表。左が収入（緑）、右が支出（赤） */
export function LedgerTable({ income, expense }: { income: Record<string, number>; expense: Record<string, number> }) {
  const ins = rowsOf(income, INCOME_ORDER);
  const outs = rowsOf(expense, EXPENSE_ORDER);
  const n = Math.max(ins.length, outs.length, 1);
  const cell = (r: { k: string; v: number } | undefined) =>
    r ? (
      <>
        <td className="ledger-name">
          <span className="ledger-icon">{ICONS[r.k] ?? '・'}</span>
          {t(`settle.${r.k}`)}
        </td>
        <td className="ledger-money">{formatMoney(r.v)}</td>
      </>
    ) : (
      <>
        <td />
        <td />
      </>
    );
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th colSpan={2} className="income">
            {t('summary.income')}
          </th>
          <th colSpan={2} className="expense">
            {t('summary.expense')}
          </th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: n }, (_, i) => (
          <tr key={i}>
            {cell(ins[i])}
            {cell(outs[i])}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="ledger-name">{t('ledger.total')}</td>
          <td className="ledger-money plus">{formatMoney(sum(income))}</td>
          <td className="ledger-name">{t('ledger.total')}</td>
          <td className="ledger-money minus">{formatMoney(sum(expense))}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** 「詳しく見る」で開く部分 */
export function Details({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="details">
      <button className="secondary details-toggle" onClick={() => setOpen((v) => !v)}>
        {t(open ? 'details.close' : 'details.open')} {open ? '▲' : '▼'}
      </button>
      {open && <div className="details-body">{children}</div>}
    </div>
  );
}

/** マスの出来事として並べないお金の動き（純資産は変わらない、または別の行で数えるもの） */
const NOT_EVENTS = ['realEstate.buy', 'realEstate.sell', 'loan.prepay', 'shortfall'];
const isEvent = (e: LogEntry) => e.cash !== undefined && !NOT_EVENTS.some((k) => e.key.startsWith(k));

/** 純資産が増えた・減った理由の表。それぞれ内訳を小さく添える */
export function NetWorthTable({ s }: { s: GameState }) {
  const st = s.lastSettlement!;
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  const events = s.log.filter((l) => l.year === st.year && isEvent(l) && Math.round(l.cash! * 10) !== 0);
  const eventsTotal = events.reduce((a, e) => a + e.cash!, 0);
  const rest = b.other - eventsTotal;
  const amounts = s.marketChange?.amounts;
  const valueParts = amounts
    ? [...ASSET_IDS, 'realEstate' as const]
        .filter((k) => Math.round(amounts[k]) !== 0)
        .map((k) => ({ name: t(`asset.${k}`), v: amounts[k] }))
    : [];

  const rows: { label: string; v: number; parts?: { name: string; v: number }[] }[] = [
    { label: t('worth.net'), v: st.net },
    { label: t('worth.principal'), v: st.loanPrincipal },
    { label: t('worth.revaluation'), v: b.revaluation, parts: valueParts },
    { label: t('worth.events'), v: eventsTotal, parts: events.map((e) => ({ name: logLabel(e), v: e.cash! })) },
    { label: t('worth.otherRest'), v: rest },
  ].filter((r) => Math.round(r.v) !== 0);

  return (
    <table className="worth-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>
              <div>{r.label}</div>
              {r.parts && r.parts.length > 0 && (
                <div className="worth-parts">
                  {r.parts.map((p, i) => (
                    <span key={i} className={p.v >= 0 ? 'plus' : 'minus'}>
                      {p.name} {p.v > 0 ? '+' : ''}
                      {formatMoney(p.v)}
                    </span>
                  ))}
                </div>
              )}
            </td>
            <td className="ledger-money">
              <MoneyDelta v={r.v} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>{t('worth.total')}</td>
          <td className="ledger-money">
            <MoneyDelta v={change} />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
