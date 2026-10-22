// 大きなイベントの画面。画面いっぱいに出し、「OK」を押すまで止める（design.md 2.2、5.3）。

import { CARDS_BY_ID } from '../data/cards';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned, has, t } from '../i18n';
import { MoneyDelta } from './Delta';
import { EveryoneMoved } from './Rivals';

const ICONS: Record<string, string> = {
  crash: '📉',
  surge: '📈',
  inflationShock: '🔥',
  bankFailure: '🏦',
  earthquake: '🌋',
  inheritance: '🎁',
};

export function BigEventModal({ s, onClose }: { s: GameState; onClose: () => void }) {
  const ev = s.bigEvent!;
  const rates = Object.entries(ev.rates);
  const hasTradeCard = s.player.hand.some((c) => CARDS_BY_ID[c]?.kind === 'trade');
  return (
    <div className="overlay big-event-overlay">
      <div className={`modal big-event big-event-${ev.id}`}>
        <div className="big-event-icon">{ICONS[ev.id] ?? '⚡'}</div>
        <h2>{t(`bigEvent.${ev.id}.title`)}</h2>
        <p>{t(`bigEvent.${ev.id}.text`)}</p>
        {rates.length > 0 && (
          <table className="table">
            <tbody>
              {rates.map(([id, r]) => (
                <tr key={id}>
                  <td>{t(`asset.${id}`)}</td>
                  <td className={r >= 0 ? 'plus' : 'minus'}>{formatSigned(r * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {Math.round(ev.moved) !== 0 && (
          <p className="summary-line">
            {t('bigEvent.moved')}: <MoneyDelta v={ev.moved} big />
          </p>
        )}
        {Math.round(ev.cash * 10) !== 0 && (
          <p className="summary-line">
            {t('bigEvent.cash')}: <MoneyDelta v={ev.cash} big />
          </p>
        )}
        {ev.covered > 0 && <p className="plus">{t('bigEvent.covered', { amount: formatMoney(ev.covered) })}</p>}
        {rates.length === 0 && Math.round(ev.cash * 10) === 0 && ev.covered === 0 && has(`bigEvent.${ev.id}.none`) && (
          <p className="muted">{t(`bigEvent.${ev.id}.none`)}</p>
        )}
        <EveryoneMoved s={s} amountOf={(v) => (v.bigEvent ? Math.round(v.bigEvent.moved) + Math.round(v.bigEvent.cash) : 0)} />
        {rates.length > 0 && <p className="muted">{t(hasTradeCard ? 'bigEvent.tradeHint' : 'bigEvent.noTradeHint')}</p>}
        <div className="options">
          <button onClick={onClose}>{t('option.ok')}</button>
        </div>
      </div>
    </div>
  );
}
