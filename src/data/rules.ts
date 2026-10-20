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

/** 生活費（年）。総務省「家計調査」2025年平均（単身 月17.3万円、二人以上の勤労者世帯 月34.6万円）をもとに丸めた */
export const LIVING_COST = {
  single: 200,
  couple: 320,
  perChild: 40,
  /** 持ち家なら家賃分が減る */
  homeOwnerDiscount: 80,
};

/**
 * 教育費（年）。子どもの年齢ごと。
 * 小中高: 文部科学省「子供の学習費調査」令和5年度（令和8年1月の訂正後）の学習費総額を丸めた。
 * 大学: 日本政策金融公庫「教育費負担の実態調査」令和3年度の在学費用に、入学費用を4年でならして足した（私立は文系）。
 */
export const EDUCATION_COST = {
  /** 0〜5歳の保育料（共働きのときだけ） */
  daycare: 30,
  elementary: { public: 35, private: 175 },
  juniorHigh: { public: 55, private: 155 },
  highSchool: { public: 60, private: 120 },
  university: { national: 120, private: 170 },
};

export const CHILD_INDEPENDENT_AGE = 22;
export const CHILD_INDEPENDENT_AGE_NO_UNIVERSITY = 18;
export const MAX_CHILDREN = 3;
export const BIRTH_MAX_AGE = 45;
export const BIRTH_COST = 50;

export const WEDDING_COST = { small: 50, large: 300 };

/** 配偶者の収入。共働きの手取りは、国税庁「民間給与実態統計調査」令和6年分の女性の平均給与（333万円、税込み）を手取りに直した水準に丸めた */
export const SPOUSE = {
  fullStartIncome: 240,
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
  /** 住宅金融支援機構「フラット35利用者調査」2023年度の中古マンションの所要資金（3,037万円）をもとに丸めた */
  basePrice: 3000,
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

/**
 * 幸福ポイントの倍率。出来事のデータには目安の点数（小3・中5・大10・特大15）を書き、ここで全体の重みを決める。
 * 「人生で得た幸福ポイント」と「老後の安心ポイント」が、平均でだいたい同じになるように調整する（段階3）
 */
export const HAPPINESS_SCALE = 2;

/** 借金（カードローン）がある年の幸福ポイント（倍率をかける前） */
export const DEBT_HAPPINESS = -1;

/** 老後の安心ポイント = SCALE × log10(1 + 純資産 ÷ UNIT) */
export const SECURITY = { scale: 50, unit: 100 };

/** 趣味を続けている間、ペットがいる間に、毎年もらえる幸福ポイント（倍率をかける前） */
export const HOBBY_YEARLY_HAPPINESS = 2;
export const PET_YEARLY_HAPPINESS = 1;

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
  employee: ranks(370, 280, 190, 70),
  civil: ranks(380, 290, 210, 120),
  engineer: ranks(350, 270, 170, 90),
  athlete: ranks(400, 320, 220, 110),
  youtuber: ranks(390, 290, 200, 60),
  freeter: ranks(320, 240, 110, -120),
};
