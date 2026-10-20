import {
  ASSETS,
  ASSET_IDS,
  DEPOSIT_RATE_MAX,
  DEPOSIT_RATE_MIN,
  ECONOMY_DRIFT,
  ECONOMY_TRANSITION,
  REAL_ESTATE_VOLATILITY,
} from '../data/assets';
import { NEWS, type NewsDef } from '../data/news';
import { BASE_INFLATION, REAL_ESTATE } from '../data/rules';
import { nextRandom, pickWeighted, randomNormal } from './rng';
import type { AssetId, Economy, GameState } from './types';

const ECONOMIES: Economy[] = ['boom', 'normal', 'recession'];

/** 1年の値動きの下限と上限（極端な値を防ぐ） */
const MIN_RETURN = -0.6;
const MAX_RETURN = 1;

const clampReturn = (r: number) => Math.min(MAX_RETURN, Math.max(MIN_RETURN, r));

type Key = AssetId | 'realEstate';
const KEYS: Key[] = [...ASSET_IDS, 'realEstate'];

/**
 * 景気とニュースによる値動きの、長い目で見た平均と散らばりを計算する。
 * 設計書の「平均リターン」が、44年間の実際の年平均（複利）になるように補正するために使う。
 */
function computeCorrection(): Record<Key, number> {
  const total = NEWS.reduce((a, n) => a + n.weight, 0);
  // ニュースが景気を決めない年の、景気の分布（長い目で見て落ち着く分布）
  let dist: Record<Economy, number> = { boom: 0, normal: 1, recession: 0 };
  const step = (d: Record<Economy, number>) => {
    const next: Record<Economy, number> = { boom: 0, normal: 0, recession: 0 };
    for (const n of NEWS) {
      const p = n.weight / total;
      if (n.economy) next[n.economy] += p;
      else for (const from of ECONOMIES) for (const to of ECONOMIES) next[to] += p * d[from] * ECONOMY_TRANSITION[from][to];
    }
    return next;
  };
  for (let i = 0; i < 500; i++) dist = step(dist);
  const free: Record<Economy, number> = { boom: 0, normal: 0, recession: 0 };
  for (const from of ECONOMIES) for (const to of ECONOMIES) free[to] += dist[from] * ECONOMY_TRANSITION[from][to];

  const result = {} as Record<Key, number>;
  for (const k of KEYS) {
    let mean = 0;
    let second = 0;
    for (const n of NEWS) {
      const p = n.weight / total;
      const econs: [Economy, number][] = n.economy ? [[n.economy, 1]] : ECONOMIES.map((e) => [e, free[e]]);
      for (const [e, q] of econs) {
        const x = ECONOMY_DRIFT[e][k] + (n.shocks[k] ?? 0);
        mean += p * q * x;
        second += p * q * x * x;
      }
    }
    const vol = k === 'realEstate' ? REAL_ESTATE_VOLATILITY : ASSETS[k].volatility;
    // 平均の上乗せを打ち消し、値動きの散らばりで複利が目減りする分を足す
    result[k] = -mean + (second - mean * mean + vol * vol) / 2;
  }
  return result;
}

const CORRECTION = computeCorrection();

export function newsById(id: string): NewsDef {
  const n = NEWS.find((x) => x.id === id);
  if (!n) throw new Error(`unknown news: ${id}`);
  return n;
}

/** 年初にニュースを1つ選び、景気と価格を1年分動かす */
export function updateMarket(s: GameState): NewsDef {
  const news = pickWeighted(s, NEWS, (n) => n.weight)!;
  const m = s.market;
  const prevEconomy = m.economy;
  const oldPrices = { ...m.prices };
  const oldIndex = m.realEstateIndex;
  const oldPropertyValue = s.player.properties.reduce((sum, p) => sum + p.value, 0);

  if (news.economy) {
    m.economy = news.economy;
  } else {
    const row = ECONOMY_TRANSITION[m.economy];
    m.economy = pickWeighted(s, ECONOMIES, (e) => row[e])!;
  }

  for (const id of ASSET_IDS) {
    const a = ASSETS[id];
    if (a.volatility === 0 && a.meanReturn === 0) continue;
    const r = clampReturn(
      a.meanReturn +
        CORRECTION[id] +
        ECONOMY_DRIFT[m.economy][id] +
        (news.shocks[id] ?? 0) +
        a.volatility * randomNormal(s),
    );
    m.prices[id] *= 1 + r;
  }

  const reReturn = clampReturn(
    CORRECTION.realEstate +
      ECONOMY_DRIFT[m.economy].realEstate +
      (news.shocks.realEstate ?? 0) +
      REAL_ESTATE_VOLATILITY * randomNormal(s),
  );
  m.realEstateIndex *= 1 + reReturn;
  for (const p of s.player.properties) {
    p.value *= (1 + reReturn) * (1 - REAL_ESTATE.agingRate);
    p.vacant = p.use === 'rental' && m.economy === 'recession' && nextRandom(s) < REAL_ESTATE.recessionVacancy;
  }

  if (news.depositRateChange) {
    m.depositRate = Math.min(DEPOSIT_RATE_MAX, Math.max(DEPOSIT_RATE_MIN, m.depositRate + news.depositRateChange));
  }
  m.livingIndex *= 1 + BASE_INFLATION + (news.inflation ?? 0);
  // 給料は毎年の物価の上昇（BASE_INFLATION）にだけ合わせて上がる。物価上昇のニュースの上乗せには合わせない
  m.wageIndex = (m.wageIndex ?? 1) * (1 + BASE_INFLATION);

  const rates = {} as Record<Key, number>;
  const amounts = {} as Record<Key, number>;
  for (const id of ASSET_IDS) {
    rates[id] = m.prices[id] / oldPrices[id] - 1;
    amounts[id] = s.player.holdings[id] * (m.prices[id] - oldPrices[id]);
  }
  rates.realEstate = m.realEstateIndex / oldIndex - 1;
  amounts.realEstate = s.player.properties.reduce((sum, p) => sum + p.value, 0) - oldPropertyValue;
  s.marketChange = { prevEconomy, rates, amounts };

  s.newsId = news.id;
  return news;
}
