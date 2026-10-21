// カード。design.md 3.9。データは cards.json。

import data from './cards.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, type Problems } from './validate';

export type CardKind = 'multiply' | 'exact' | 'trade';

export interface CardDef {
  id: string;
  kind: CardKind;
  /** ルーレットの出目を何倍にするか（kind が multiply のとき） */
  times?: number;
  /** カードマスと年末での出やすさ */
  weight: number;
  /** ラッキーカードマスでの出やすさ */
  luckyWeight: number;
}

const KINDS: CardKind[] = ['multiply', 'exact', 'trade'];

export function checkCards(raw: unknown): Problems {
  const d = raw as { handMax?: unknown; cards?: unknown };
  const problems: Problems = [];
  if (!isNumber(d.handMax) || d.handMax < 1) problems.push('handMax は1以上の数にします');
  if (!Array.isArray(d.cards) || d.cards.length === 0) return [...problems, 'cards がありません'];
  d.cards.forEach((c, i) => {
    const where = `cards[${i}]（${c?.id}）`;
    problems.push(...checkFields(where, c, { id: 'string', kind: 'string', weight: 'number', luckyWeight: 'number', times: 'number?' }));
    if (!KINDS.includes(c.kind)) problems.push(`${where}: kind は multiply・exact・trade のどれかにします`);
    if (c.kind === 'multiply' && !(isNumber(c.times) && c.times >= 1)) problems.push(`${where}: times は1以上の数にします`);
    if (isNumber(c.weight) && c.weight < 0) problems.push(`${where}: weight がマイナスです`);
  });
  problems.push(...checkUniqueIds('cards', d.cards));
  return problems;
}

assertValid('src/data/cards.json', checkCards(data));

export const CARDS: CardDef[] = data.cards as CardDef[];
export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
/** 手札の上限 */
export const HAND_MAX: number = data.handMax;
