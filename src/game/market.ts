// 相場の動き。design.md 7章。
// 毎月少しずつ動き（月末）、年末のニュースで大きく動く。1年の値動きの大きさのうち、
// MONTHLY_VOLATILITY_SHARE の分を毎月の動きで、残りを年末に出す。

import {
  ASSETS,
  ASSET_IDS,
  DEPOSIT_RATE_MAX,
  DEPOSIT_RATE_MIN,
  ECONOMY_TRANSITION,
  MONTHLY_VOLATILITY_SHARE,
  REAL_ESTATE_DRIFT,
  REAL_ESTATE_VOLATILITY,
} from '../data/assets';
import { NEWS, type NewsDef } from '../data/news';
import { BASE_INFLATION, REAL_ESTATE } from '../data/rules';
import { pickWeighted, randomNormal } from './rng';
import type { AssetId, Economy, GameState, YearMarket } from './types';

const ECONOMIES: Economy[] = ['boom', 'normal', 'recession'];

/** 1回の値動きの下限と上限（極端な値を防ぐ） */
const MONTH_LIMIT = { min: -0.3, max: 0.3 };
const YEAR_LIMIT = { min: -0.6, max: 1 };
const clamp = (r: number, l: { min: number; max: number }) => Math.min(l.max, Math.max(l.min, r));

type Key = AssetId | 'realEstate';
const KEYS: Key[] = [...ASSET_IDS, 'realEstate'];

const driftOf = (k: Key, e: Economy) => (k === 'realEstate' ? REAL_ESTATE_DRIFT[e] : ASSETS[k].drift[e]);
const volOf = (k: Key) => (k === 'realEstate' ? REAL_ESTATE_VOLATILITY : ASSETS[k].volatility);

/**
 * 景気とニュースによる値動きの、長い目で見た平均と散らばりを計算する。
 * 設計書の「平均の値上がり」が、ゲーム全体の実際の年平均（複利）になるように補正するために使う。
 */
function computeCorrection(): Record<Key, number> {
  const total = NEWS.reduce((a, n) => a + n.weight, 0);
  // 景気の分布（長い目で見て落ち着く分布）
  let dist: Record<Economy, number> = { boom: 0, normal: 1, recession: 0 };
  for (let i = 0; i < 500; i++) {
    const next: Record<Economy, number> = { boom: 0, normal: 0, recession: 0 };
    for (const n of NEWS) {
      const p = n.weight / total;
      if (n.economy) next[n.economy] += p;
      else for (const from of ECONOMIES) for (const to of ECONOMIES) next[to] += p * dist[from] * ECONOMY_TRANSITION[from][to];
    }
    dist = next;
  }
  const result = {} as Record<Key, number>;
  for (const k of KEYS) {
    let mean = 0;
    let second = 0;
    for (const e of ECONOMIES) {
      for (const n of NEWS) {
        const x = driftOf(k, e) + (n.shocks[k] ?? 0);
        const p = dist[e] * (n.weight / total);
        mean += p * x;
        second += p * x * x;
      }
    }
    // 平均の上乗せを打ち消し、値動きの散らばりで複利が目減りする分を足す
    result[k] = -mean + (second - mean * mean + volOf(k) ** 2) / 2;
  }
  return result;
}

const CORRECTION = computeCorrection();

export function newsById(id: string): NewsDef {
  const n = NEWS.find((x) => x.id === id);
  if (!n) throw new Error(`unknown news: ${id}`);
  return n;
}

/** 年の始めの値動きの記録 */
export function newYearMarket(s: GameState): YearMarket {
  return {
    startPrices: { ...s.market.prices },
    startRealEstateIndex: s.market.realEstateIndex,
    amounts: Object.fromEntries(KEYS.map((k) => [k, 0])),
  };
}

/** 価格を動かし、自分の資産が動いた金額を記録する。動いた金額の合計を返す */
function movePrice(s: GameState, id: AssetId, rate: number): number {
  const before = s.market.prices[id];
  s.market.prices[id] = before * (1 + rate);
  const moved = (s.player.holdings[id] ?? 0) * (s.market.prices[id] - before);
  s.yearMarket.amounts[id] += moved;
  return moved;
}

/** 月末の小さな値動き。平均の伸びと景気の上乗せは、12ヶ月で1年分になるように毎月少しずつ出す。動いた金額の合計を返す */
export function updateMarketMonth(s: GameState): number {
  const e = s.market.economy;
  let moved = 0;
  for (const id of ASSET_IDS) {
    const a = ASSETS[id];
    const drift = Math.pow(1 + a.meanReturn + CORRECTION[id] + a.drift[e], 1 / 12) - 1;
    const noise = a.volatility * Math.sqrt(MONTHLY_VOLATILITY_SHARE / 12) * randomNormal(s);
    moved += movePrice(s, id, clamp(drift + noise, MONTH_LIMIT));
  }
  return moved;
}

/**
 * 年末にニュースを1つ選び、相場を大きく動かす。景気は次の年の景気に変わる。
 * 物価、給料の水準、預金金利、家の値段もここで動く。動いた金額の合計を返す
 */
export function updateMarketYear(s: GameState): { news: NewsDef; moved: number } {
  const news = pickWeighted(s, NEWS, (n) => n.weight)!;
  const m = s.market;
  const prevEconomy = m.economy;
  let moved = 0;

  for (const id of ASSET_IDS) {
    const a = ASSETS[id];
    const noise = a.volatility * Math.sqrt(1 - MONTHLY_VOLATILITY_SHARE) * randomNormal(s);
    moved += movePrice(s, id, clamp((news.shocks[id] ?? 0) + noise, YEAR_LIMIT));
  }

  const reReturn = clamp(
    CORRECTION.realEstate + REAL_ESTATE_DRIFT[prevEconomy] + (news.shocks.realEstate ?? 0) + REAL_ESTATE_VOLATILITY * randomNormal(s),
    YEAR_LIMIT,
  );
  m.realEstateIndex *= 1 + reReturn;
  const home = s.player.home;
  if (home) {
    const before = home.value;
    home.value *= (1 + reReturn) * (1 - REAL_ESTATE.agingRate);
    s.yearMarket.amounts.realEstate += home.value - before;
    moved += home.value - before;
  }

  if (news.economy) {
    m.economy = news.economy;
  } else {
    const row = ECONOMY_TRANSITION[m.economy];
    m.economy = pickWeighted(s, ECONOMIES, (e) => row[e])!;
  }
  if (news.depositRateChange) {
    m.depositRate = Math.min(DEPOSIT_RATE_MAX, Math.max(DEPOSIT_RATE_MIN, m.depositRate + news.depositRateChange));
  }
  m.livingIndex *= 1 + BASE_INFLATION + (news.inflation ?? 0);
  // 給料は毎年の物価の上昇（BASE_INFLATION）にだけ合わせて上がる。物価上昇のニュースの上乗せには合わせない
  m.wageIndex *= 1 + BASE_INFLATION;

  const ym = s.yearMarket;
  const rates = {} as Record<Key, number>;
  for (const id of ASSET_IDS) rates[id] = m.prices[id] / ym.startPrices[id] - 1;
  rates.realEstate = m.realEstateIndex / ym.startRealEstateIndex - 1;
  s.marketChange = { prevEconomy, rates, amounts: { ...ym.amounts } };
  s.newsId = news.id;
  return { news, moved };
}
