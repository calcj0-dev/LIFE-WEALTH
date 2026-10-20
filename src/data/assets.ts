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

/** 銀行預金も含めた割合（合計100%）。投資方針の画面に見せる形 */
export type Shares = Record<'deposit' | AssetId, number>;

/** 割合（%）から投資方針を作る */
export function policyFromShares(kind: Policy['kind'], shares: Shares): Policy {
  const invested = 100 - shares.deposit;
  const allocation = { bond: 0, gold: 0, fund: 0, stock: 0 };
  if (invested > 0) for (const id of ASSET_IDS) allocation[id] = shares[id] / invested;
  else allocation.fund = 1;
  return { kind, investRatio: invested / 100, allocation };
}

/** 投資方針を、銀行預金も含めた割合（%）にする */
export function sharesOf(policy: Policy): Shares {
  const shares: Shares = { deposit: Math.round((1 - policy.investRatio) * 100), bond: 0, gold: 0, fund: 0, stock: 0 };
  for (const id of ASSET_IDS) shares[id] = Math.round(policy.investRatio * policy.allocation[id] * 100);
  return shares;
}

/** 自動投資の型（design.md 6.3） */
export const POLICY_PRESETS: Record<PolicyPresetId, Policy> = {
  safe: policyFromShares('safe', { deposit: 70, bond: 20, gold: 10, fund: 0, stock: 0 }),
  balanced: policyFromShares('balanced', { deposit: 50, bond: 10, gold: 5, fund: 35, stock: 0 }),
  aggressive: policyFromShares('aggressive', { deposit: 30, bond: 0, gold: 0, fund: 40, stock: 30 }),
};

/** 預金だけ（初期投資なし）。銀行預金100% */
export const NO_INVEST_POLICY: Policy = policyFromShares('none', { deposit: 100, bond: 0, gold: 0, fund: 0, stock: 0 });
