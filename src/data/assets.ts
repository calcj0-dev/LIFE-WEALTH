import type { AssetId, Economy, Policy } from '../game/types';

export interface AssetDef {
  id: AssetId;
  /** 価格の平均の値上がり率（年） */
  meanReturn: number;
  /** 値動きの大きさ（年） */
  volatility: number;
  /** 毎年の収入の割合（利息・配当） */
  incomeYield: number;
  /** 1口の最初の価格（万円） */
  startPrice: number;
}

export const ASSETS: Record<AssetId, AssetDef> = {
  bond: { id: 'bond', meanReturn: 0, volatility: 0.03, incomeYield: 0.015, startPrice: 1 },
  gold: { id: 'gold', meanReturn: 0.04, volatility: 0.15, incomeYield: 0, startPrice: 1 },
  fund: { id: 'fund', meanReturn: 0.06, volatility: 0.18, incomeYield: 0, startPrice: 1 },
  stock: { id: 'stock', meanReturn: 0.05, volatility: 0.3, incomeYield: 0.025, startPrice: 1 },
};

/** お金が足りないときに売る順番でもある */
export const ASSET_IDS: AssetId[] = ['bond', 'gold', 'fund', 'stock'];

export const START_DEPOSIT_RATE = 0.003;
export const DEPOSIT_RATE_MIN = 0.001;
export const DEPOSIT_RATE_MAX = 0.03;

/** 景気による値動きの上乗せ（年） */
export const ECONOMY_DRIFT: Record<Economy, Record<AssetId | 'realEstate', number>> = {
  boom: { bond: -0.01, gold: -0.02, fund: 0.03, stock: 0.05, realEstate: 0.02 },
  normal: { bond: 0, gold: 0, fund: 0, stock: 0, realEstate: 0 },
  recession: { bond: 0.01, gold: 0.05, fund: -0.05, stock: -0.1, realEstate: -0.03 },
};

/** 不動産の相場の値動きの大きさ（年） */
export const REAL_ESTATE_VOLATILITY = 0.05;

/** ニュースが景気を決めない年の、景気の移り変わりの確率 */
export const ECONOMY_TRANSITION: Record<Economy, Record<Economy, number>> = {
  normal: { boom: 0.2, normal: 0.7, recession: 0.1 },
  boom: { boom: 0.6, normal: 0.3, recession: 0.1 },
  recession: { boom: 0.1, normal: 0.4, recession: 0.5 },
};

export type PolicyPresetId = 'safe' | 'balanced' | 'aggressive';

export const POLICY_PRESETS: Record<PolicyPresetId, Policy> = {
  safe: { investRatio: 0.3, allocation: { bond: 0.7, gold: 0.3, fund: 0, stock: 0 } },
  balanced: { investRatio: 0.5, allocation: { bond: 0.2, gold: 0.1, fund: 0.7, stock: 0 } },
  aggressive: { investRatio: 0.7, allocation: { bond: 0, gold: 0, fund: 0.6, stock: 0.4 } },
};
