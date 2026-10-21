import type { AssetId, Economy } from '../game/types';
import data from './assets.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, type Problems } from './validate';

export type AssetKind = 'bond' | 'gold' | 'fund' | 'stock';

export interface AssetDef {
  id: AssetId;
  kind: AssetKind;
  /** 価格の平均の値上がり率（年） */
  meanReturn: number;
  /** 値動きの大きさ（年） */
  volatility: number;
  /** 毎年の収入の割合（利息・配当） */
  incomeYield: number;
  /** 毎月の積み立てができるか（段階3.5の2で使う） */
  accumulate: boolean;
  /** 景気による値動きの上乗せ（年） */
  drift: Record<Economy, number>;
}

const KINDS: AssetKind[] = ['bond', 'gold', 'fund', 'stock'];
const ECONOMIES: Economy[] = ['boom', 'normal', 'recession'];

export function checkAssets(raw: unknown): Problems {
  const list = (raw as { assets?: unknown }).assets;
  if (!Array.isArray(list) || list.length === 0) return ['assets がありません'];
  const problems: Problems = [];
  list.forEach((a, i) => {
    const where = `assets[${i}]`;
    problems.push(
      ...checkFields(where, a, { id: 'string', kind: 'string', meanReturn: 'number', volatility: 'number', incomeYield: 'number', accumulate: 'boolean', drift: 'object' }),
    );
    if (!KINDS.includes(a.kind)) problems.push(`${where}: kind は ${KINDS.join('・')} のどれかにします`);
    if (isNumber(a.volatility) && a.volatility < 0) problems.push(`${where}: volatility がマイナスです`);
    for (const e of ECONOMIES) if (!isNumber(a.drift?.[e])) problems.push(`${where}: drift.${e} がありません`);
  });
  problems.push(...checkUniqueIds('assets', list));
  return problems;
}

assertValid('src/data/assets.json', checkAssets(data));

export const ASSET_LIST: AssetDef[] = data.assets as AssetDef[];
export const ASSETS: Record<AssetId, AssetDef> = Object.fromEntries(ASSET_LIST.map((a) => [a.id, a]));
/** お金が足りないときに売る順番でもある（株は、持っている額が多い順に売る） */
export const ASSET_IDS: AssetId[] = ASSET_LIST.map((a) => a.id);

/** 資産ごとに0を入れたもの */
export const zeroHoldings = (): Record<AssetId, number> => Object.fromEntries(ASSET_IDS.map((id) => [id, 0]));

/** 価格は、どの銘柄も1口1万円から始める */
export const START_PRICE = 1;

export const START_DEPOSIT_RATE = 0.003;
export const DEPOSIT_RATE_MIN = 0.001;
export const DEPOSIT_RATE_MAX = 0.03;

/** 景気による不動産の相場の値動きの上乗せ（年） */
export const REAL_ESTATE_DRIFT: Record<Economy, number> = { boom: 0.02, normal: 0, recession: -0.03 };
/** 不動産の相場の値動きの大きさ（年） */
export const REAL_ESTATE_VOLATILITY = 0.05;

/** 1年の値動きの大きさのうち、毎月の小さな動きで出す割合（残りは年末のニュースのとき）。design.md 7章 */
export const MONTHLY_VOLATILITY_SHARE = 0.5;

/** ニュースが景気を決めない年の、景気の移り変わりの確率 */
export const ECONOMY_TRANSITION: Record<Economy, Record<Economy, number>> = {
  normal: { boom: 0.2, normal: 0.7, recession: 0.1 },
  boom: { boom: 0.6, normal: 0.3, recession: 0.1 },
  recession: { boom: 0.1, normal: 0.4, recession: 0.5 },
};
