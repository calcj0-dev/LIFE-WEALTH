// マスで起きる出来事。design.md 5.1。データは events.json。
// 起きる条件（when）は、決まった形の組み合わせだけを書ける。

import data from './events.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, isObject, type Problems } from './validate';

export type EventSize = 'small' | 'medium' | 'large';
/** plus はお金が増える（緑のマス）、minus は減る（赤のマス）、chance は選ぶ出来事（黄色のマス）。design.md 3.3 */
export type EventSign = 'plus' | 'minus' | 'chance';

export type Effect =
  | { t: 'cash'; amount: number }
  | { t: 'salaryRate'; rate: number }
  /** months ヶ月、給料が入らない */
  | { t: 'noIncome'; months: number }
  | { t: 'spousePart' }
  | { t: 'sickness' }
  | { t: 'disaster'; amount: number };

/** 起きる条件。書いた条件をすべて満たすときだけ起きる */
export interface EventCondition {
  married?: boolean;
  hasChildren?: boolean;
  homeOwner?: boolean;
  /** 給料が入っている（失業中・休業中でない） */
  employed?: boolean;
  /** 昇進がある職業 */
  promotable?: boolean;
  /** 収入が安定している職業（給料が毎年振れない） */
  stableIncome?: boolean;
  spouseWork?: 'full' | 'part' | 'none';
  /** 副業に挑戦したことがあるか */
  sideBusiness?: boolean;
  /** 何年目以降か */
  minYear?: number;
  /** 何年目までか */
  maxYear?: number;
}

export interface EventDef {
  id: string;
  sign: EventSign;
  size: EventSize;
  /** 起きやすさ */
  weight: number;
  when?: EventCondition;
  /** 職業ごとの起きやすさをかける */
  weightBy?: 'unemployment' | 'sickness';
  /** 選ぶものがない出来事で、起きること */
  effects?: Effect[];
  /** 選ぶ出来事 */
  choice?: 'jobChange' | 'sideBusiness';
}

const SIZES: EventSize[] = ['small', 'medium', 'large'];
const SIGNS: EventSign[] = ['plus', 'minus', 'chance'];
const EFFECT_FIELDS: Record<Effect['t'], Record<string, 'number'>> = {
  cash: { amount: 'number' },
  salaryRate: { rate: 'number' },
  noIncome: { months: 'number' },
  spousePart: {},
  sickness: {},
  disaster: { amount: 'number' },
};
const CONDITION_TYPES: Record<keyof EventCondition, 'boolean' | 'number' | 'spouseWork'> = {
  married: 'boolean',
  hasChildren: 'boolean',
  homeOwner: 'boolean',
  employed: 'boolean',
  promotable: 'boolean',
  stableIncome: 'boolean',
  spouseWork: 'spouseWork',
  sideBusiness: 'boolean',
  minYear: 'number',
  maxYear: 'number',
};

export function checkEvents(raw: unknown): Problems {
  const list = (raw as { events?: unknown }).events;
  if (!Array.isArray(list) || list.length === 0) return ['events がありません'];
  const problems: Problems = [];
  list.forEach((e, i) => {
    const where = `events[${i}]（${e?.id}）`;
    problems.push(...checkFields(where, e, { id: 'string', sign: 'string', size: 'string', weight: 'number', when: 'object?', weightBy: 'string?', effects: 'array?', choice: 'string?' }));
    if (!SIZES.includes(e.size)) problems.push(`${where}: size は small・medium・large のどれかにします`);
    if (!SIGNS.includes(e.sign)) problems.push(`${where}: sign は plus・minus・chance のどれかにします`);
    if ((e.sign === 'chance') !== !!e.choice) problems.push(`${where}: 選ぶ出来事（choice）は sign を chance に、それ以外は plus か minus にします`);
    if (isNumber(e.weight) && e.weight <= 0) problems.push(`${where}: weight は0より大きくします`);
    if (e.weightBy !== undefined && !['unemployment', 'sickness'].includes(e.weightBy)) problems.push(`${where}: weightBy が正しくありません`);
    if (e.choice !== undefined && !['jobChange', 'sideBusiness'].includes(e.choice)) problems.push(`${where}: choice が正しくありません`);
    if (!e.effects && !e.choice) problems.push(`${where}: effects か choice のどちらかが必要です`);
    for (const [k, v] of Object.entries(isObject(e.when) ? e.when : {})) {
      const type = CONDITION_TYPES[k as keyof EventCondition];
      if (!type) problems.push(`${where}: when の「${k}」という条件はありません`);
      else if (type === 'spouseWork' ? !['full', 'part', 'none'].includes(v as string) : typeof v !== type) problems.push(`${where}: when.${k} の値が正しくありません`);
    }
    (Array.isArray(e.effects) ? e.effects : []).forEach((ef: { t?: string }, j: number) => {
      const fields = EFFECT_FIELDS[ef?.t as Effect['t']];
      if (!fields) problems.push(`${where}: effects[${j}] の t「${ef?.t}」はありません`);
      else problems.push(...checkFields(`${where}.effects[${j}]`, ef, fields));
    });
  });
  problems.push(...checkUniqueIds('events', list));
  return problems;
}

assertValid('src/data/events.json', checkEvents(data));

export const EVENTS: EventDef[] = data.events as EventDef[];
export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export const SICKNESS = {
  cost: 50,
  /** 重い病気で、給料が入らない月数 */
  heavyMonths: 3,
  heavyChance: 0.3,
};

export const SIDE_BUSINESS = {
  cost: 100,
  successChance: 0.2,
  /** 成功したときの収入（年） */
  income: 30,
};

/** 配偶者がパートを始めたときの収入（年） */
export const SPOUSE_PART_INCOME = 100;
