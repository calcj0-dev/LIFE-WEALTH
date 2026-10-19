import type { AssetId, Economy } from '../game/types';

export interface NewsDef {
  id: string;
  /** 起きやすさ */
  weight: number;
  /** その年の景気を決める（なければ確率で移り変わる） */
  economy?: Economy;
  /** その年の値動きへの上乗せ */
  shocks: Partial<Record<AssetId | 'realEstate', number>>;
  /** 預金金利の変化（例: 0.005 = 0.5%上がる） */
  depositRateChange?: number;
  /** 物価の変化（例: 0.05 = 5%上がる） */
  inflation?: number;
  /** 投資の見直しを知らせる大事な年 */
  important?: boolean;
}

/** 毎年の年初に1つ起きる政治・経済のニュース。design.md 7章 */
export const NEWS: NewsDef[] = [
  { id: 'calm', weight: 3, shocks: {} },
  { id: 'boom', weight: 1.5, economy: 'boom', shocks: { stock: 0.05, fund: 0.05 } },
  { id: 'slowdown', weight: 1.5, economy: 'recession', shocks: { stock: -0.1, fund: -0.05, gold: 0.05, bond: 0.02 } },
  {
    id: 'crisis',
    weight: 0.5,
    economy: 'recession',
    shocks: { stock: -0.3, fund: -0.3, gold: 0.1, bond: 0.02, realEstate: -0.1 },
    important: true,
  },
  { id: 'rateUp', weight: 1, shocks: { bond: -0.05, realEstate: -0.05 }, depositRateChange: 0.005 },
  { id: 'rateDown', weight: 1, shocks: { bond: 0.05, stock: 0.05, realEstate: 0.05 }, depositRateChange: -0.005 },
  { id: 'inflation', weight: 1, shocks: { gold: 0.1 }, inflation: 0.05 },
  { id: 'techBoom', weight: 0.5, shocks: { stock: 0.1, fund: 0.1 }, important: true },
  { id: 'geopolitics', weight: 0.5, shocks: { gold: 0.1, stock: -0.1 } },
  { id: 'housingBoom', weight: 0.5, shocks: { realEstate: 0.1 } },
];
