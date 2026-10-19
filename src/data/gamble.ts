// ギャンブルマス。design.md 3.5
// 戻ってくる金額の平均（還元率）は概算。出典の確認は後回しのタスク。

export type GambleId = 'lottery' | 'horse' | 'pachinko';

export interface GambleOutcome {
  /** 賭けた金額の何倍が戻るか */
  multiplier: number;
  probability: number;
}

export interface GambleDef {
  id: GambleId;
  /** 還元率（outcomes から計算した値と一致させる） */
  returnRate: number;
  outcomes: GambleOutcome[];
}

export const GAMBLES: Record<GambleId, GambleDef> = {
  lottery: {
    id: 'lottery',
    returnRate: 0.45,
    outcomes: [
      { multiplier: 10000, probability: 0.00002 },
      { multiplier: 100, probability: 0.0005 },
      { multiplier: 10, probability: 0.005 },
      { multiplier: 0.3, probability: 0.5 },
    ],
  },
  horse: {
    id: 'horse',
    returnRate: 0.75,
    outcomes: [
      { multiplier: 12.5, probability: 0.01 },
      { multiplier: 2.5, probability: 0.25 },
    ],
  },
  pachinko: {
    id: 'pachinko',
    returnRate: 0.85,
    outcomes: [
      { multiplier: 3.75, probability: 0.1 },
      { multiplier: 1.5, probability: 0.25 },
      { multiplier: 0.5, probability: 0.2 },
    ],
  },
};

export const GAMBLE_IDS: GambleId[] = ['lottery', 'horse', 'pachinko'];
export const GAMBLE_BETS = [1, 10, 100];

/** 大当たり（賭け金の100倍以上）の幸福ポイント */
export const GAMBLE_JACKPOT_HAPPINESS = 5;
