import type { JobId } from '../game/types';

// ゲーム全体のルールの数値（仮）。金額は万円。
// 数値は区切りのよい値にする（CLAUDE.md「数値の決め方」）。

export const START_AGE = 22;
export const END_AGE = 65;
export const START_CASH = 50;

export const ROULETTE_MAX = 6;

/** 60歳で給料が60%になる */
export const SENIOR_AGE = 60;
export const SENIOR_SALARY_RATE = 0.6;

export const LIVING_COST = {
  single: 160,
  couple: 260,
  perChild: 50,
  /** 持ち家なら家賃分が減る */
  homeOwnerDiscount: 60,
};

/** 教育費（年）。子どもの年齢ごと */
export const EDUCATION_COST = {
  /** 0〜5歳の保育料（共働きのときだけ） */
  daycare: 30,
  elementary: { public: 30, private: 160 },
  juniorHigh: { public: 50, private: 140 },
  highSchool: { public: 50, private: 100 },
  university: { national: 100, private: 150 },
};

export const CHILD_INDEPENDENT_AGE = 22;
export const CHILD_INDEPENDENT_AGE_NO_UNIVERSITY = 18;
export const MAX_CHILDREN = 3;
export const BIRTH_MAX_AGE = 45;
export const BIRTH_COST = 50;

export const WEDDING_COST = { small: 50, large: 300 };

export const SPOUSE = {
  fullStartIncome: 280,
  fullGrowth: 0.015,
  partIncome: 100,
};

export const HOBBY = { startCost: 30, yearlyCost: 10 };
export const PET = { startCost: 20, yearlyCost: 15, years: 15 };


/** 物価は毎年少しずつ上がる（生活費に反映） */
export const BASE_INFLATION = 0.01;

export const INSURANCE = {
  medicalBasePremium: 3,
  /** 加入する年齢が1歳上がるごとに増える保険料 */
  medicalPremiumPerYear: 0.2,
  firePremiumPerProperty: 3,
};

export const REAL_ESTATE = {
  basePrice: 2000,
  offerMin: 0.8,
  offerMax: 1.2,
  buyCostRate: 0.05,
  sellFeeRate: 0.03,
  downPaymentRate: 0.1,
  rentYield: 0.05,
  rentCostRate: 0.2,
  agingRate: 0.01,
  /** 不況の年に空室になる確率 */
  recessionVacancy: 0.2,
  home: { rate: 0.01, years: 35 },
  rental: { rate: 0.02, years: 30 },
};

/** 借金（カードローン）がある年の幸福ポイント */
export const DEBT_HAPPINESS = -3;

/** 老後の安心ポイント = SCALE × log10(1 + 純資産 ÷ UNIT) */
export const SECURITY = { scale: 100, unit: 100 };

export type RankTable = { rank: string; min: number }[];

/** ランクの基準点を、S・A・B・C の下限から作る */
const ranks = (s: number, a: number, b: number, c: number): RankTable => [
  { rank: 'S', min: s },
  { rank: 'A', min: a },
  { rank: 'B', min: b },
  { rank: 'C', min: c },
  { rank: 'D', min: -Infinity },
];

/**
 * スタート時の職業ごとのランクの基準点（design.md 9章）。
 * 自動シミュレーションで、どの職業でも S が約5%、D が約20%になるように決める（npm run simulate の「職業ごとのランクの基準」）。
 */
export const RANKS_BY_JOB: Record<JobId, RankTable> = {
  employee: ranks(360, 310, 260, 200),
  civil: ranks(350, 310, 250, 190),
  engineer: ranks(360, 310, 260, 210),
  athlete: ranks(380, 320, 260, 180),
  youtuber: ranks(380, 320, 240, 70),
  freeter: ranks(330, 270, 150, -240),
};
