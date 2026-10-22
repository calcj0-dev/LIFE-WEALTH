import { BOARD } from '../data/board';
import { SICKNESS } from '../data/events';
import type { GameState, SquareType } from '../game/types';
import { t } from '../i18n';

/** 今の決定の見出しと説明文、どのマスの出来事か */
export function describeDecision(s: GameState): { title: string; text: string; squareType: SquareType | null } {
  const d = s.decision!;
  const fromSquare = s.decisionFrom === 'square';
  const squareType = fromSquare ? BOARD[s.player.position].type : null;
  switch (d.kind) {
    case 'notice':
      return { title: t(`${d.messageKey}.title`, d.params), text: t(`${d.messageKey}.text`, d.params), squareType };
    case 'event': {
      let text = t(`event.${d.eventId}.text`);
      // 病気は、治療費（保険で払われるか）と、重いかどうかを先に見せる（design.md 5.1）
      if (d.eventId === 'sickness') {
        text += s.player.medicalPremium !== null ? t('event.sickness.covered') : t('event.sickness.pay', { cost: SICKNESS.cost });
        if (d.params?.heavy !== undefined) text += d.params.heavy === 1 ? t('event.sickness.heavy') : t('event.sickness.light');
      }
      return { title: t(`event.${d.eventId}.title`), text, squareType };
    }
    case 'gamble':
      if (d.gambleId) return { title: t(`option.gamble.${d.gambleId}`), text: t('gamble.bet.text', { name: t(`option.gamble.${d.gambleId}`) }), squareType };
      return { title: t('gamble.title'), text: t('gamble.text'), squareType };
    case 'realEstate':
      return { title: t('realEstate.title'), text: t('realEstate.text', { price: d.offerPrice! }), squareType };
    case 'talk':
      return { title: t(`talk.${d.talkId}.title`), text: t(`talk.${d.talkId}.text`), squareType };
    case 'stock': {
      const rate = s.marketChange?.rates[d.assetId!];
      const text = t('stock.text', { name: t(`asset.${d.assetId}`) });
      const recent = rate === undefined ? '' : t('stock.recent', { rate: `${rate >= 0 ? '+' : ''}${Math.round(rate * 100)}%` });
      return { title: t('stock.title'), text: `${text}${recent}`, squareType };
    }
    default:
      return { title: t(`${d.kind}.title`), text: t(`${d.kind}.text`), squareType };
  }
}
