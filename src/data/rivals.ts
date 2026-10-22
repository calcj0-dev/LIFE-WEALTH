// ライバル（CPU）2人のお金の使い方（design.md 12.1）。数値は仮で、自動シミュレーションで調整する。
// 金額は万円。割合は 0〜1。

import type { AssetId, RivalId } from '../game/types';

export interface Personality {
  /** 年末に投資するとき、銀行預金に残しておく生活費の月数 */
  reserveMonths: number;
  /** 年末に、残しておく分を引いた預金のうち、投資に回す割合 */
  investRate: number;
  /**
   * 年末に買うもの。資産の番号と割合の組（例: 投資信託 7割、国債 3割）。
   * 'hotStock' は、1年で一番値上がりした株（流行りの株に飛びつく）
   */
  buy: { asset: AssetId | 'hotStock'; share: number }[];
  /** 年末に、1年でこの割合より下がった株を全部売る（慌てて売る）。売らないなら null */
  panicSell: number | null;
  /** 医療保険に入るか */
  medical: boolean;
  /** 株のマスで買うか（買うなら、残しておく分を引いた預金で買える一番多い株数） */
  stockSquare: boolean;
  /** 家を買えるときに、住宅ローンで買う確率 */
  homeChance: number;
  /** 投資の話に乗る確率（乗るときは、一番小さい金額） */
  talkChance: number;
  /** ギャンブルをする確率（するときは、一番小さい金額） */
  gambleChance: number;
  /** 転職のチャンスで、給料が上がるなら転職する確率 */
  jobChangeChance: number;
  /** 副業のチャンスで、挑戦する確率 */
  sideBusinessChance: number;
}

export const RIVAL_IDS: RivalId[] = ['steady', 'bold'];

export const PERSONALITIES: Record<RivalId, Personality> = {
  // コツコツさん（堅実タイプ）: 銀行預金が中心で、投資は少しだけ。うまい話には乗らない
  steady: {
    reserveMonths: 12,
    investRate: 0.2,
    buy: [
      { asset: 'fund', share: 0.7 },
      { asset: 'bond', share: 0.3 },
    ],
    panicSell: null,
    medical: true,
    stockSquare: false,
    homeChance: 0.6,
    talkChance: 0,
    gambleChance: 0,
    jobChangeChance: 0,
    sideBusinessChance: 0,
  },
  // イケイケさん（攻めタイプ）: 流行りの株に飛びつき、下がると慌てて売る。うまい話やギャンブルにも乗る
  bold: {
    reserveMonths: 3,
    investRate: 0.6,
    buy: [{ asset: 'hotStock', share: 1 }],
    panicSell: -0.2,
    medical: false,
    stockSquare: true,
    homeChance: 0.3,
    talkChance: 0.4,
    gambleChance: 0.4,
    jobChangeChance: 0.5,
    sideBusinessChance: 0.5,
  },
};
