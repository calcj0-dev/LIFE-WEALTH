// ライフイベント、良い出来事、悪い出来事。design.md 5章
// 金額は万円。数値は仮で、区切りのよい値にする。

import type { GameState, JobId } from '../game/types';
import { JOBS, JOB_IDS, salaryAtAge } from './jobs';
import { BIRTH_COST, BIRTH_MAX_AGE, MAX_CHILDREN, HOBBY, PET } from './rules';

/** 選択肢を選んだときに起きること */
export type Effect =
  | { t: 'cash'; amount: number }
  | { t: 'happiness'; amount: number }
  | { t: 'salaryRate'; rate: number }
  | { t: 'bonus'; rate: number }
  /** 給料の rate 分を、投資方針の配分で買う */
  | { t: 'investBonus'; rate: number }
  | { t: 'noIncome' }
  | { t: 'birth'; spouse: 'stay' | 'leave' }
  | { t: 'spousePart' }
  | { t: 'sickness' }
  | { t: 'careHome' }
  | { t: 'hobbyStart' }
  | { t: 'petStart' }
  | { t: 'sideBusiness' }
  | { t: 'jobChange'; jobId: JobId }
  | { t: 'vacancy' }
  | { t: 'repair'; amount: number }
  | { t: 'disaster'; amount: number };

export interface OptionDef {
  id: string;
  effects: Effect[];
  /** 選べるか（なければいつでも選べる） */
  enabled?: (s: GameState) => boolean;
  /** 表示用の数値 */
  params?: (s: GameState) => Record<string, number | string>;
}

export interface EventDef {
  id: string;
  /** 起きやすさ。0なら起きない（条件に合わない） */
  weight: (s: GameState) => number;
  options: OptionDef[] | ((s: GameState) => OptionDef[]);
}

const age = (s: GameState) => s.player.age;
const employed = (s: GameState) => !s.player.noIncomeThisYear;
const hasRental = (s: GameState) => s.player.properties.some((p) => p.use === 'rental');
const hasProperty = (s: GameState) => s.player.properties.length > 0;
const ok = (...effects: Effect[]): OptionDef[] => [{ id: 'ok', effects }];
const skip: OptionDef = { id: 'skip', effects: [] };

export const SICKNESS = {
  lightCost: 30,
  heavyCost: 100,
  heavyChance: 0.3,
  happiness: -5,
};

export const CARE = { facilityCost: 200, homeCost: 50, homeSalaryRate: 0.7, happiness: -5 };

export const SIDE_BUSINESS = {
  cost: 100,
  successChance: 0.2,
  income: 30,
  happinessSuccess: 10,
  happinessFail: -5,
};

/** ライフイベントのマスで起きるイベント（5.1） */
export const LIFE_EVENTS: EventDef[] = [
  {
    id: 'birth',
    weight: (s) =>
      s.player.married && s.player.children.length < MAX_CHILDREN && age(s) <= BIRTH_MAX_AGE ? 3 : 0,
    options: (s) =>
      s.player.spouse?.work === 'full'
        ? [
            { id: 'birthStay', effects: [{ t: 'birth', spouse: 'stay' }, { t: 'cash', amount: -BIRTH_COST }, { t: 'happiness', amount: 10 }] },
            { id: 'birthLeave', effects: [{ t: 'birth', spouse: 'leave' }, { t: 'cash', amount: -BIRTH_COST }, { t: 'happiness', amount: 10 }] },
            skip,
          ]
        : [
            { id: 'birth', effects: [{ t: 'birth', spouse: 'stay' }, { t: 'cash', amount: -BIRTH_COST }, { t: 'happiness', amount: 10 }] },
            skip,
          ],
  },
  {
    id: 'jobChange',
    weight: (s) => (age(s) <= 55 ? 2 : 0),
    options: (s) => [
      ...JOB_IDS.filter((j) => JOBS[j].canTransferTo && j !== s.player.jobId).map((jobId) => ({
        id: `job:${jobId}`,
        effects: [{ t: 'jobChange', jobId } as Effect, { t: 'happiness', amount: 3 } as Effect],
        params: () => ({ salary: Math.round(salaryAtAge(jobId, age(s))) }),
      })),
      skip,
    ],
  },
  {
    id: 'promotion',
    weight: (s) => (JOBS[s.player.jobId].canBePromoted && employed(s) ? 2 : 0),
    options: [
      { id: 'promotionAccept', effects: [{ t: 'salaryRate', rate: 0.05 }] },
      { id: 'promotionDecline', effects: [{ t: 'happiness', amount: 5 }] },
    ],
  },
  {
    id: 'unemployment',
    weight: (s) => (employed(s) ? JOBS[s.player.jobId].unemploymentWeight : 0),
    options: ok({ t: 'noIncome' }, { t: 'salaryRate', rate: -0.1 }, { t: 'happiness', amount: -10 }),
  },
  {
    id: 'sickness',
    weight: (s) => (1 + (age(s) - 22) / 20) * JOBS[s.player.jobId].sicknessMultiplier,
    options: ok({ t: 'sickness' }, { t: 'happiness', amount: SICKNESS.happiness }),
  },
  {
    id: 'care',
    weight: (s) => (age(s) >= 50 ? 1 : 0),
    options: [
      { id: 'careFacility', effects: [{ t: 'cash', amount: -CARE.facilityCost }, { t: 'happiness', amount: CARE.happiness }] },
      { id: 'careHome', effects: [{ t: 'cash', amount: -CARE.homeCost }, { t: 'careHome' }, { t: 'happiness', amount: CARE.happiness }] },
    ],
  },
  {
    id: 'travel',
    weight: () => 2,
    options: [
      { id: 'travelAbroad', effects: [{ t: 'cash', amount: -50 }, { t: 'happiness', amount: 10 }] },
      { id: 'travelDomestic', effects: [{ t: 'cash', amount: -15 }, { t: 'happiness', amount: 5 }] },
      skip,
    ],
  },
  {
    id: 'hobby',
    weight: (s) => (s.player.hobby ? 0 : 1.5),
    options: [
      { id: 'hobbyStart', effects: [{ t: 'cash', amount: -HOBBY.startCost }, { t: 'hobbyStart' }, { t: 'happiness', amount: 8 }] },
      skip,
    ],
  },
  {
    id: 'study',
    weight: (s) => (age(s) <= 50 ? 1 : 0),
    options: [
      { id: 'studyDo', effects: [{ t: 'cash', amount: -30 }, { t: 'salaryRate', rate: 0.03 }, { t: 'happiness', amount: 3 }] },
      skip,
    ],
  },
  {
    id: 'sideBusiness',
    weight: (s) => (age(s) >= 25 && age(s) <= 55 && s.player.sideBusinessIncome === 0 ? 1 : 0),
    options: [{ id: 'sideBusinessTry', effects: [{ t: 'sideBusiness' }] }, skip],
  },
  {
    id: 'social',
    weight: () => 1.5,
    options: [{ id: 'socialJoin', effects: [{ t: 'cash', amount: -5 }, { t: 'happiness', amount: 3 }] }, skip],
  },
  {
    id: 'pet',
    weight: (s) => (s.player.petYears === null ? 1 : 0),
    options: [
      { id: 'petAdopt', effects: [{ t: 'cash', amount: -PET.startCost }, { t: 'petStart' }, { t: 'happiness', amount: 10 }] },
      skip,
    ],
  },
  {
    id: 'parents',
    weight: (s) => (age(s) >= 30 ? 1 : 0),
    options: [{ id: 'parentsDo', effects: [{ t: 'cash', amount: -20 }, { t: 'happiness', amount: 5 }] }, skip],
  },
  {
    id: 'childGrowth',
    weight: (s) => (s.player.children.some((c) => !c.independent) ? 2 : 0),
    options: ok({ t: 'cash', amount: -10 }, { t: 'happiness', amount: 3 }),
  },
  {
    id: 'spouseReturn',
    weight: (s) => (s.player.married && s.player.spouse?.work === 'none' && age(s) <= 60 ? 1 : 0),
    options: [{ id: 'spouseReturnGo', effects: [{ t: 'spousePart' }] }, skip],
  },
];

/** 良い出来事（すべて「OK」だけ） */
export const GOOD_EVENTS: EventDef[] = [
  {
    id: 'bonus',
    weight: (s) => (employed(s) ? 2 : 0),
    options: [
      { id: 'bonusSpend', effects: [{ t: 'happiness', amount: 5 }] },
      { id: 'bonusSave', effects: [{ t: 'bonus', rate: 0.1 }] },
      { id: 'bonusInvest', effects: [{ t: 'bonus', rate: 0.1 }, { t: 'investBonus', rate: 0.1 }] },
    ],
  },
  { id: 'raise', weight: (s) => (employed(s) && JOBS[s.player.jobId].volatility === 0 ? 2 : 0), options: ok({ t: 'salaryRate', rate: 0.03 }) },
  { id: 'prize', weight: () => 1, options: ok({ t: 'cash', amount: 10 }, { t: 'happiness', amount: 3 }) },
  { id: 'refund', weight: () => 1, options: ok({ t: 'cash', amount: 20 }) },
  { id: 'parentsGift', weight: (s) => (age(s) <= 40 ? 1 : 0), options: ok({ t: 'cash', amount: 50 }) },
  {
    id: 'gig',
    weight: () => 1,
    options: [
      { id: 'gigAccept', effects: [{ t: 'cash', amount: 30 }, { t: 'happiness', amount: -3 }] },
      { id: 'gigRest', effects: [{ t: 'happiness', amount: 3 }] },
    ],
  },
  { id: 'healthy', weight: () => 1, options: ok({ t: 'happiness', amount: 5 }) },
  { id: 'thanks', weight: () => 1, options: ok({ t: 'happiness', amount: 3 }) },
  { id: 'rentBonus', weight: (s) => (hasRental(s) ? 1 : 0), options: ok({ t: 'cash', amount: 20 }) },
];

/** 悪い出来事（すべて「OK」だけ） */
export const BAD_EVENTS: EventDef[] = [
  {
    id: 'appliance',
    weight: () => 2,
    options: [
      { id: 'applianceRepair', effects: [{ t: 'cash', amount: -10 }, { t: 'happiness', amount: -2 }] },
      { id: 'applianceReplace', effects: [{ t: 'cash', amount: -30 }, { t: 'happiness', amount: 3 }] },
    ],
  },
  {
    id: 'carRepair',
    weight: () => 1,
    options: [
      { id: 'carFix', effects: [{ t: 'cash', amount: -30 }] },
      { id: 'carSell', effects: [{ t: 'cash', amount: 20 }, { t: 'happiness', amount: -5 }] },
    ],
  },
  { id: 'lostPhone', weight: () => 1, options: ok({ t: 'cash', amount: -10 }) },
  { id: 'ceremony', weight: () => 1, options: ok({ t: 'cash', amount: -10 }) },
  { id: 'trafficFine', weight: () => 1, options: ok({ t: 'cash', amount: -5 }) },
  {
    id: 'unwell',
    weight: () => 1,
    options: [
      { id: 'unwellClinic', effects: [{ t: 'cash', amount: -10 }] },
      { id: 'unwellEndure', effects: [{ t: 'happiness', amount: -8 }] },
    ],
  },
  {
    id: 'overwork',
    weight: (s) => (employed(s) ? 1 : 0),
    options: [
      { id: 'overworkRest', effects: [{ t: 'bonus', rate: -0.05 }, { t: 'happiness', amount: 3 }] },
      { id: 'overworkPush', effects: [{ t: 'bonus', rate: 0.05 }, { t: 'happiness', amount: -5 }] },
    ],
  },
  { id: 'vacancy', weight: (s) => (hasRental(s) ? 1.5 : 0), options: ok({ t: 'vacancy' }) },
  { id: 'repair', weight: (s) => (hasProperty(s) ? 1.5 : 0), options: ok({ t: 'repair', amount: 50 }) },
  { id: 'disaster', weight: (s) => (hasProperty(s) ? 0.5 : 0), options: ok({ t: 'disaster', amount: 300 }) },
];

export const ALL_EVENTS: Record<string, EventDef> = Object.fromEntries(
  [...LIFE_EVENTS, ...GOOD_EVENTS, ...BAD_EVENTS].map((e) => [e.id, e]),
);
