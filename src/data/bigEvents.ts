// 大きなイベント。design.md 5.3。データは bigEvents.json。

import { ASSET_IDS } from './assets';
import data from './bigEvents.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, type Problems } from './validate';

export type BigEffect =
  /** 銘柄の値段を min〜max の割合で動かす（銘柄ごとに、その間のどこか） */
  | { t: 'market'; assets: string[]; min: number; max: number }
  /** 生活費の水準を rate だけ上げる（給料は上がらない） */
  | { t: 'living'; rate: number }
  /** 預金のうち threshold を超える分の rate を失う */
  | { t: 'depositLoss'; threshold: number; rate: number }
  | { t: 'cash'; amount: number }
  /** 持ち家の損害。火災・地震保険に入っていれば保険で払われる */
  | { t: 'homeDamage'; amount: number };

export interface BigEventDef {
  id: string;
  /** 何年に1回くらい起きるか */
  everyYears: number;
  effects: BigEffect[];
}

const EFFECT_FIELDS: Record<BigEffect['t'], Record<string, 'number' | 'array?'>> = {
  market: { min: 'number', max: 'number' },
  living: { rate: 'number' },
  depositLoss: { threshold: 'number', rate: 'number' },
  cash: { amount: 'number' },
  homeDamage: { amount: 'number' },
};

export function checkBigEvents(raw: unknown, assetIds: string[] = ASSET_IDS): Problems {
  const list = (raw as { events?: unknown }).events;
  if (!Array.isArray(list) || list.length === 0) return ['events がありません'];
  const problems: Problems = [];
  list.forEach((e, i) => {
    const where = `events[${i}]（${e?.id}）`;
    problems.push(...checkFields(where, e, { id: 'string', everyYears: 'number', effects: 'array?' }));
    if (isNumber(e.everyYears) && e.everyYears <= 0) problems.push(`${where}: everyYears は0より大きくします`);
    if (!Array.isArray(e.effects) || e.effects.length === 0) problems.push(`${where}: effects がありません`);
    (Array.isArray(e.effects) ? e.effects : []).forEach((ef: { t?: string; assets?: unknown; min?: number; max?: number }, j: number) => {
      const fields = EFFECT_FIELDS[ef?.t as BigEffect['t']];
      if (!fields) {
        problems.push(`${where}: effects[${j}] の t「${ef?.t}」はありません`);
        return;
      }
      problems.push(...checkFields(`${where}.effects[${j}]`, ef, fields));
      if (ef.t === 'market') {
        if (!Array.isArray(ef.assets) || ef.assets.some((a) => !assetIds.includes(a))) problems.push(`${where}.effects[${j}]: assets に、ない銘柄があります`);
        if (isNumber(ef.min) && isNumber(ef.max) && ef.min > ef.max) problems.push(`${where}.effects[${j}]: min が max より大きいです`);
      }
    });
  });
  problems.push(...checkUniqueIds('events', list));
  return problems;
}

assertValid('src/data/bigEvents.json', checkBigEvents(data));

export const BIG_EVENTS: BigEventDef[] = data.events as BigEventDef[];
export const BIG_EVENTS_BY_ID: Record<string, BigEventDef> = Object.fromEntries(BIG_EVENTS.map((e) => [e.id, e]));

/** 1ヶ月あたりに起きる確率 */
export const monthlyChance = (e: BigEventDef) => 1 / (e.everyYears * 12);
