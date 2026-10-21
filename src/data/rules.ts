// ゲーム全体のルールの数値（仮）。金額は万円。金額のデータは1年分で持ち、1ヶ月分は12で割って使う（design.md 2章）。
// 数値は区切りのよい値にする（CLAUDE.md「数値の決め方」）。

/** 選べる遊ぶ年数と、最初に選ばれている年数（design.md 1.1） */
export const YEAR_OPTIONS = [10, 20, 30, 40, 50];
export const DEFAULT_YEARS = 20;
export const MONTHS_PER_YEAR = 12;

export const START_CASH = 50;

/** ルーレットの出目は1〜6（design.md 3.8） */
export const ROULETTE_MAX = 6;

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
 * 小学校と中学校は公立に進む（design.md 5.2）。
 */
export const EDUCATION_COST = {
  /** 0〜5歳の保育料（共働きのときだけ） */
  daycare: 30,
  elementary: 35,
  juniorHigh: 55,
  highSchool: { public: 60, private: 120 },
  university: { national: 120, private: 170 },
};

export const CHILD_INDEPENDENT_AGE = 22;
export const CHILD_INDEPENDENT_AGE_NO_UNIVERSITY = 18;
export const MAX_CHILDREN = 3;

/** 結婚マス（design.md 3.5）。出目が faces のどれかなら結婚する */
export const MARRIAGE = {
  faces: [1, 3, 5],
  /** 結婚式などの費用から、ご祝儀の分を引いた額 */
  cost: 50,
};

/** 配偶者の働き方を決める出目（design.md 4.5） */
export const SPOUSE_WORK_FACES: Record<'full' | 'none', number[]> = {
  full: [1, 2, 3, 4],
  none: [5, 6],
};

/** 出産マス（design.md 3.6） */
export const BIRTH = {
  faces: [1, 3, 5],
  /** 出産の費用から、国の出産育児一時金の分を引いた額 */
  cost: 10,
  /** 独身のときに友だちに贈る出産祝い */
  gift: 5,
};

/** 高校と大学の進学を決める出目（design.md 5.2） */
export const HIGH_SCHOOL_FACES: Record<'public' | 'private', number[]> = {
  public: [1, 2, 3, 4],
  private: [5, 6],
};
export const UNIVERSITY_FACES: Record<'none' | 'national' | 'private', number[]> = {
  none: [1, 2],
  national: [3],
  private: [4, 5, 6],
};

/** 配偶者の収入。共働きの手取りは、国税庁「民間給与実態統計調査」令和6年分の女性の平均給与（333万円、税込み）を手取りに直した水準に丸めた */
export const SPOUSE = {
  fullStartIncome: 240,
  fullGrowth: 0.015,
};

/** 物価は毎年少しずつ上がる（生活費に反映） */
export const BASE_INFLATION = 0.01;

export const INSURANCE = {
  /** 1年目に入ったときの医療保険の保険料（年） */
  medicalBasePremium: 3,
  /** 入る年が1年遅くなるごとに増える保険料 */
  medicalPremiumPerYear: 0.2,
  firePremium: 3,
};

export const REAL_ESTATE = {
  /** 住宅金融支援機構「フラット35利用者調査」2023年度の中古マンションの所要資金（3,037万円）をもとに丸めた */
  basePrice: 3000,
  offerMin: 0.8,
  offerMax: 1.2,
  buyCostRate: 0.05,
  sellFeeRate: 0.03,
  downPaymentRate: 0.1,
  /** 古くなるにつれ、毎年下がる割合 */
  agingRate: 0.01,
  loan: { rate: 0.01, years: 35 },
};

/** 株のマス（design.md 3.4）。割安に買える割合と、選べる金額 */
export const STOCK_SQUARE = {
  discount: 0.1,
  amounts: [10, 30, 100],
};

/** 積み立て（design.md 6.3）。おすすめの金額は、毎月の手取りの1割 */
export const SAVING = {
  recommendRate: 0.1,
};

/** 取引タイム（design.md 2.1）。売り買いの金額の単位と、繰り上げ返済の単位 */
export const TRADE = {
  amounts: [1, 10, 50, 100],
  prepayUnit: 100,
};
