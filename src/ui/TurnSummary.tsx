// 今月のまとめ。何かが起きたターンの最後に、そのターンに起きたことを1枚にまとめて出す（design.md 2.3）。
// 自動では消えない。各行は、押すと詳しい内容が開く。ニュースは全員に関係するので、ここには入れず、別の画面で出す（2.4）。

import { useState } from 'react';
import type { LogEntry, MonthFlow } from '../game/types';
import { formatMoney, has, t } from '../i18n';
import { dateLabel } from './dateLabel';
import { MoneyDelta } from './Delta';
import { VerticalLedger, shownTotal } from './Ledger';
import { logLabel, visibleEntries } from './logLabel';

export interface TurnSummaryData {
  year: number;
  month: number;
  monthsPerTurn: number;
  /** このターンに増えた記録 */
  entries: LogEntry[];
  /** このターンの月末のお金の動き */
  flow: MonthFlow | null;
  cashBefore: number;
  cashAfter: number;
  worthBefore: number;
  /** ニュースで相場が動く前の純資産 */
  worthAfter: number;
}

/** まとめに、お給料など以外の行として出さない記録（ニュースは別の画面で出す。積み立ての金額の変更などは出さない） */
const HIDDEN = ['news.happened', 'saving.change', 'stock.skip', 'card.use'];

function iconOf(key: string): string {
  if (key.startsWith('bigEvent.')) return '⚡';
  if (key.startsWith('card.')) return '🃏';
  if (key.startsWith('bonus.')) return '⭐';
  if (key.startsWith('talk.')) return '🗣️';
  if (key.startsWith('stock.') || key.startsWith('trade.')) return '📈';
  if (key.startsWith('realEstate.')) return '🏠';
  if (key.startsWith('shortfall.')) return '⚠️';
  if (key.startsWith('marriage.')) return '💍';
  if (key.startsWith('birth.')) return '👶';
  if (key.startsWith('gamble.')) return '🎰';
  if (key.startsWith('saving.')) return '🐷';
  if (key.startsWith('school.') || key.startsWith('auto.')) return '🏫';
  return '🎲';
}

/** 行を開いたときに出す説明（なければ null） */
function detailOf(e: LogEntry): string | null {
  const [head, id] = e.key.split('.');
  if (head === 'event' && has(`event.${id}.text`)) return t(`event.${id}.text`);
  if (head === 'card' && typeof e.params?.card === 'string') return t(`card.${e.params.card}.text`);
  if (head === 'bigEvent' && has(`bigEvent.${id}.text`)) return t(`bigEvent.${id}.text`);
  return null;
}

/** まとめを出すか（何かが起きたターンだけ） */
export function hasSomething(entries: LogEntry[]): boolean {
  return visibleEntries(entries).some((e) => !HIDDEN.includes(e.key));
}

function Row({ icon, label, amount, children }: { icon: string; label: string; amount?: React.ReactNode; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const canOpen = !!children;
  return (
    <div className="summary-item">
      <button className={`summary-item-head${canOpen ? '' : ' static'}`} onClick={() => canOpen && setOpen((v) => !v)}>
        <span className="summary-item-icon">{icon}</span>
        <span className="summary-item-label">{label}</span>
        <span className="summary-item-amount">{amount}</span>
        {canOpen && <span className="summary-item-arrow">{open ? '▲' : '▼'}</span>}
      </button>
      {open && children && <div className="summary-item-body">{children}</div>}
    </div>
  );
}

export function TurnSummary({ data, onClose }: { data: TurnSummaryData; onClose: () => void }) {
  const rows = visibleEntries(data.entries).filter((e) => !HIDDEN.includes(e.key));
  const m = data.flow;
  // お給料などの行は、積み立てと借金の返済を引いたあとの「銀行預金に残った」金額（一番下の銀行預金とつじつまを合わせる）
  const salaryNet = m ? shownTotal(m.income) - shownTotal(m.expense) - Math.round(m.saved) - Math.round(m.repaid) : 0;
  return (
    <div className="overlay">
      <div className="modal turn-summary">
        <h2>{t('turnSummary.title', { date: dateLabel(data, data.year, data.month) })}</h2>
        <div className="summary-list">
          {rows.map((e, i) => {
            const detail = detailOf(e);
            return (
              <Row key={i} icon={iconOf(e.key)} label={logLabel(e)} amount={e.cash !== undefined ? <MoneyDelta v={e.cash} /> : undefined}>
                {detail ? <p>{detail}</p> : undefined}
              </Row>
            );
          })}
          {m && (
            <Row icon="💼" label={t('turnSummary.salary')} amount={salaryNet !== 0 ? <MoneyDelta v={salaryNet} /> : formatMoney(0)}>
              <VerticalLedger income={m.income} expense={m.expense} saved={m.saved} repaid={m.repaid} />
            </Row>
          )}
        </div>
        <table className="summary-footer">
          <tbody>
            <tr>
              <td>{t('hud.deposit')}</td>
              <td className="ledger-money">
                {formatMoney(data.cashBefore)} → <strong>{formatMoney(data.cashAfter)}</strong>
              </td>
            </tr>
            <tr>
              <td>{t('hud.netWorth')}</td>
              <td className="ledger-money">
                {formatMoney(data.worthBefore)} → <strong>{formatMoney(data.worthAfter)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="options">
          <button onClick={onClose}>{t('option.ok')}</button>
        </div>
      </div>
    </div>
  );
}
