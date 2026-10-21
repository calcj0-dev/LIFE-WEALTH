// 投資の話のマス（投資の落とし穴）。design.md 6.4。データは investTalks.json。

import data from './investTalks.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, type Problems } from './validate';

export interface TalkOutcome {
  probability: number;
  /** 元手の何倍が戻るか。マイナスなら、その分が借金になる */
  multiplier: number;
}

export interface InvestTalkDef {
  id: string;
  outcomes: TalkOutcome[];
}

/** 結果の平均（元手の何倍が戻るか）。1より小さければ、平均すると損をする */
export const expectedMultiplier = (t: InvestTalkDef) => t.outcomes.reduce((a, o) => a + o.probability * o.multiplier, 0);

export function checkInvestTalks(raw: unknown): Problems {
  const d = raw as { amounts?: unknown; talks?: unknown };
  const problems: Problems = [];
  if (!Array.isArray(d.amounts) || d.amounts.length === 0 || d.amounts.some((a) => !isNumber(a) || a <= 0)) problems.push('amounts は0より大きい数の一覧にします');
  if (!Array.isArray(d.talks) || d.talks.length === 0) return [...problems, 'talks がありません'];
  d.talks.forEach((t, i) => {
    const where = `talks[${i}]（${t?.id}）`;
    problems.push(...checkFields(where, t, { id: 'string', outcomes: 'array?' }));
    const outcomes: TalkOutcome[] = Array.isArray(t.outcomes) ? t.outcomes : [];
    if (outcomes.length === 0) problems.push(`${where}: outcomes がありません`);
    outcomes.forEach((o, j) => problems.push(...checkFields(`${where}.outcomes[${j}]`, o, { probability: 'number', multiplier: 'number' })));
    const total = outcomes.reduce((a, o) => a + (o.probability ?? 0), 0);
    if (Math.abs(total - 1) > 1e-9) problems.push(`${where}: probability の合計を1にします`);
    if (outcomes.length && expectedMultiplier({ id: t.id, outcomes }) >= 1) problems.push(`${where}: 平均すると得をする形になっています（落とし穴なので、平均は1より小さくします）`);
  });
  problems.push(...checkUniqueIds('talks', d.talks));
  return problems;
}

assertValid('src/data/investTalks.json', checkInvestTalks(data));

export const INVEST_TALKS: InvestTalkDef[] = data.talks;
export const INVEST_TALKS_BY_ID: Record<string, InvestTalkDef> = Object.fromEntries(INVEST_TALKS.map((t) => [t.id, t]));
/** 乗るときに選べる元手 */
export const TALK_AMOUNTS: number[] = data.amounts;
