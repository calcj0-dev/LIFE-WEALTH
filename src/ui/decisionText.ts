import { getOptions } from '../game/engine';
import type { GameState } from '../game/types';
import { t } from '../i18n';
import { BOARD } from '../data/board';
import type { SquareType } from '../game/types';

/** 今の決定の見出しと説明文、どのマスの出来事か */
export function describeDecision(s: GameState): { title: string; text: string; squareType: SquareType | null } {
  const d = s.decision!;
  const squareType = s.decisionFrom === 'square' ? BOARD[s.player.position].type : null;
  switch (d.kind) {
    case 'notice':
      return { title: t(`${d.messageKey}.title`), text: t(`${d.messageKey}.text`), squareType };
    case 'marriage': {
      const already = getOptions(s).length === 1;
      return { title: t('marriage.title'), text: t(already ? 'marriage.already.text' : 'marriage.text'), squareType };
    }
    case 'life':
    case 'good':
    case 'bad':
      return { title: t(`event.${d.eventId}.title`), text: t(`event.${d.eventId}.text`), squareType };
    case 'realEstate':
      return { title: t('realEstate.title'), text: t('realEstate.text', { price: d.offerPrice! }), squareType };
    case 'school':
      return {
        title: t('school.title'),
        text: t('school.text', { age: s.player.children[d.childIndex!].age }),
        squareType,
      };
    default:
      return { title: t(`${d.kind}.title`), text: t(`${d.kind}.text`), squareType };
  }
}
