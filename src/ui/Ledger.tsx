// 家計簿の部品。金額は1万円単位に丸めて出し、合計は「画面に出した行の金額」を足して出す（行と合計が必ず合う。design.md 2.2）。
// 色は、収入・プラスを緑、支出・マイナスを赤に統一する。

import { useState } from 'react';
import { formatMoney, t } from '../i18n';
import { MoneyDelta } from './Delta';

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

/** 画面に出す金額（1万円単位） */
export const shown = (v: number) => Math.round(v);

/** 画面に出す行（0万円の行は出さない） */
export function rowsOf(items: Record<string, number>, order: string[] = Object.keys(items)) {
  const keys = [...order, ...Object.keys(items).filter((k) => !order.includes(k))];
  return keys.filter((k) => shown(items[k] ?? 0) !== 0).map((k) => ({ k, v: shown(items[k]) }));
}

/** 画面に出す行を足した合計（行と必ず合う） */
export const shownTotal = (items: Record<string, number>) => rowsOf(items).reduce((a, r) => a + r.v, 0);

/** 大きな数字3つ（収入・支出・残ったお金）。合計は、画面に出す行を足したもの */
export function MoneySummary({ income, expense, plan }: { income: Record<string, number>; expense: Record<string, number>; plan?: boolean }) {
  const inc = shownTotal(income);
  const exp = shownTotal(expense);
  const net = inc - exp;
  return (
    <div className="money-summary">
      <div className="money-card income">
        <span>{t('summary.income')}</span>
        <strong>{formatMoney(inc)}</strong>
      </div>
      <div className="money-card expense">
        <span>{t('summary.expense')}</span>
        <strong>{formatMoney(exp)}</strong>
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

/**
 * 縦に並べた家計簿。上に収入、下に支出、最後に残ったお金。
 * saved（積み立て）と repaid（借金の返済）を渡すと、「そのうち、積み立てに回した」「銀行預金に残った」も出す（design.md 2.1）
 */
export function VerticalLedger({
  income,
  expense,
  saved = 0,
  repaid = 0,
}: {
  income: Record<string, number>;
  expense: Record<string, number>;
  saved?: number;
  repaid?: number;
}) {
  const ins = rowsOf(income, INCOME_ORDER);
  const outs = rowsOf(expense, EXPENSE_ORDER);
  const inc = ins.reduce((a, r) => a + r.v, 0);
  const exp = outs.reduce((a, r) => a + r.v, 0);
  const net = inc - exp;
  const save = shown(saved);
  const repay = shown(repaid);
  const row = (r: { k: string; v: number }) => (
    <tr key={r.k}>
      <td className="ledger-name">
        <span className="ledger-icon">{ICONS[r.k] ?? '・'}</span>
        {t(`settle.${r.k}`)}
      </td>
      <td className="ledger-money">{formatMoney(r.v)}</td>
    </tr>
  );
  return (
    <table className="ledger vertical-ledger">
      <tbody>
        <tr className="ledger-head income">
          <td colSpan={2}>{t('summary.income')}</td>
        </tr>
        {ins.map(row)}
        <tr className="ledger-total">
          <td>{t('ledger.incomeTotal')}</td>
          <td className="ledger-money plus">{formatMoney(inc)}</td>
        </tr>
        <tr className="ledger-head expense">
          <td colSpan={2}>{t('summary.expense')}</td>
        </tr>
        {outs.map(row)}
        <tr className="ledger-total">
          <td>{t('ledger.expenseTotal')}</td>
          <td className="ledger-money minus">{formatMoney(exp)}</td>
        </tr>
        <tr className="ledger-total net">
          <td>{t('ledger.net')}</td>
          <td className="ledger-money">
            <MoneyDelta v={net} />
            {net === 0 && formatMoney(0)}
          </td>
        </tr>
        {save > 0 && (
          <tr className="ledger-sub">
            <td>{t('ledger.saved')}</td>
            <td className="ledger-money">−{formatMoney(save)}</td>
          </tr>
        )}
        {repay > 0 && (
          <tr className="ledger-sub">
            <td>{t('ledger.repaid')}</td>
            <td className="ledger-money">−{formatMoney(repay)}</td>
          </tr>
        )}
        {(save > 0 || repay > 0) && (
          <tr className="ledger-sub">
            <td>{t('ledger.toDeposit')}</td>
            <td className="ledger-money">
              <MoneyDelta v={net - save - repay} />
              {net - save - repay === 0 && formatMoney(0)}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** 「詳しく見る」で開く部分 */
export function Details({ children, label, open: startOpen = false }: { children: React.ReactNode; label?: string; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="details">
      <button className="secondary details-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? t('details.close') : (label ?? t('details.open'))} {open ? '▲' : '▼'}
      </button>
      {open && <div className="details-body">{children}</div>}
    </div>
  );
}
