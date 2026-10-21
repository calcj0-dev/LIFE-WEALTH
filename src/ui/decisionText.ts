import { BOARD } from '../data/board';
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
    case 'event':
      return { title: t(`event.${d.eventId}.title`), text: t(`event.${d.eventId}.text`), squareType };
    case 'realEstate':
      return { title: t('realEstate.title'), text: t('realEstate.text', { price: d.offerPrice! }), squareType };
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
