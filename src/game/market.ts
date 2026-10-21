// 相場の動き。design.md 7章。
// 毎月少しずつ動き（月末）、ニュースが起きた月に大きく動く（段階3.7）。
// ニュースは、1年のどの月でもランダムに起きる（1.5年に2回くらい）。

import {
  ASSETS,
  ASSET_IDS,
  DEPOSIT_RATE_MAX,
  DEPOSIT_RATE_MIN,
  ECONOMY_TRANSITION,
  REAL_ESTATE_DRIFT,
  REAL_ESTATE_VOLATILITY,
} from '../data/assets';
import { BIG_EVENTS, monthlyChance } from '../data/bigEvents';
import calibration from '../data/marketCalibration.json';
import { NEWS, NEWS_PER_YEAR, type NewsDef } from '../data/news';
import { BASE_INFLATION, REAL_ESTATE } from '../data/rules';
import { nextRandom, pickWeighted, randomNormal } from './rng';
import type { AssetId, Economy, GameState, NewsEvent, YearMarket } from './types';

const ECONOMIES: Economy[] = ['boom', 'normal', 'recession'];

/** 1回の値動きの下限と上限（極端な値を防ぐ） */
const MONTH_LIMIT = { min: -0.3, max: 0.3 };
const SHOCK_LIMIT = { min: -0.6, max: 1 };
const clamp = (r: number, l: { min: number; max: number }) => Math.min(l.max, Math.max(l.min, r));

type Key = AssetId | 'realEstate';
const KEYS: Key[] = [...ASSET_IDS, 'realEstate'];

const driftOf = (k: Key, e: Economy) => (k === 'realEstate' ? REAL_ESTATE_DRIFT[e] : ASSETS[k].drift[e]);
const volOf = (k: Key) => (k === 'realEstate' ? REAL_ESTATE_VOLATILITY : ASSETS[k].volatility);

/** 1ヶ月にニュースが起きる確率 */
export const NEWS_MONTHLY_CHANCE = NEWS_PER_YEAR / 12;
/** 1ターン（months ヶ月）にニュースが起きる確率 */
const newsTurnChance = (months: number) => 1 - Math.pow(1 - NEWS_MONTHLY_CHANCE, months);

/** 決まった乱数（補正の計算用。ゲームの乱数は使わないので、どのゲームでも同じ補正になる） */
function fixedRandom(start: number) {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(rand: () => number, items: T[], weight: (x: T) => number): T {
  const total = items.reduce((a, x) => a + weight(x), 0);
  let r = rand() * total;
  for (const x of items) {
    r -= weight(x);
    if (r < 0) return x;
  }
  return items[items.length - 1];
}

/**
 * 景気とニュースによる値動きの、長い目で見た平均と散らばりを計算する。
 * 設計書の「平均の値上がり」が、ゲーム全体の実際の年平均（複利）になるように補正するために使う。
 *
 * 金融危機のあとは不況が続くように、月ごとの動きはつながっている。そのつながりも含めた散らばりを、
 * ゲームと同じ流れ（毎月の景気の上乗せ → ときどきニュース → 年末に景気が移り変わる）で、決まった乱数を使って何度も試して求める。
 */
function computeCorrection(): Record<Key, number> {
  const PATHS = 2000;
  const YEARS = 50;
  const rand = fixedRandom(12345);
  const sums: Record<Key, number[]> = Object.fromEntries(KEYS.map((k) => [k, []]));
  for (let path = 0; path < PATHS; path++) {
    let economy: Economy = 'normal';
    const acc: Record<Key, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
    for (let y = 0; y < YEARS; y++) {
      let economySet = false;
      for (let m = 0; m < 12; m++) {
        for (const k of ASSET_IDS) acc[k] += driftOf(k, economy) / 12;
        if (rand() < NEWS_MONTHLY_CHANCE) {
          const news = pickFrom(rand, NEWS, (n) => n.weight);
          for (const k of KEYS) acc[k] += news.shocks[k] ?? 0;
          if (news.economy) {
            economy = news.economy;
            economySet = true;
          }
        }
      }
      acc.realEstate += driftOf('realEstate', economy);
      if (!economySet) economy = pickFrom(rand, ECONOMIES, (e) => ECONOMY_TRANSITION[economy][e]);
    }
    for (const k of KEYS) sums[k].push(acc[k]);
  }

  const result = {} as Record<Key, number>;
  for (const k of KEYS) {
    const xs = sums[k];
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    // 1年あたりの平均と散らばり。平均の上乗せを打ち消し、値動きの散らばりで複利が目減りする分を足す
    result[k] = -mean / YEARS + (variance / YEARS + volOf(k) ** 2) / 2;
  }
  // 大きなイベント（大暴落、大急騰など。design.md 5.3）で動く分も打ち消す。
  // 一気に動くので、複利で目減りする分まで含めて、対数（何倍になったか）で平均を出す
  for (const ev of BIG_EVENTS) {
    const perYear = monthlyChance(ev) * 12;
    for (const ef of ev.effects) {
      if (ef.t !== 'market') continue;
      const STEPS = 100;
      let logMean = 0;
      for (let i = 0; i < STEPS; i++) logMean += Math.log(1 + ef.min + ((i + 0.5) / STEPS) * (ef.max - ef.min)) / STEPS;
      for (const k of ef.assets) result[k] -= perYear * logMean;
    }
  }
  return result;
}

/**
 * ゲームと同じ値動き（毎月の動き、ランダムな月のニュース、大きなイベント）を、決まった乱数で何度も試し、
 * 銘柄ごとの「長い目で見た年平均の伸び（中央の値）」を求める。補正の微調整に使う（npm run calibrate）
 */
export function simulateGrowth(correction: Record<Key, number>, paths: number, years: number): Record<AssetId, number> {
  const rand = fixedRandom(67890);
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const growth: Record<AssetId, number[]> = Object.fromEntries(ASSET_IDS.map((id) => [id, []]));
  for (let path = 0; path < paths; path++) {
    let economy: Economy = 'normal';
    const logPrice: Record<AssetId, number> = Object.fromEntries(ASSET_IDS.map((id) => [id, 0]));
    for (let y = 0; y < years; y++) {
      let economySet = false;
      for (let m = 0; m < 12; m++) {
        for (const id of ASSET_IDS) {
          const a = ASSETS[id];
          const drift = Math.pow(1 + a.meanReturn + correction[id] + a.drift[economy], 1 / 12) - 1;
          logPrice[id] += Math.log(1 + clamp(drift + a.volatility * Math.sqrt(1 / 12) * normal(), MONTH_LIMIT));
        }
        if (rand() < NEWS_MONTHLY_CHANCE) {
          const news = pickFrom(rand, NEWS, (n) => n.weight);
          for (const id of ASSET_IDS) logPrice[id] += Math.log(1 + clamp(news.shocks[id] ?? 0, SHOCK_LIMIT));
          if (news.economy) {
            economy = news.economy;
            economySet = true;
          }
        }
        for (const ev of BIG_EVENTS) {
          if (rand() >= monthlyChance(ev)) continue;
          for (const ef of ev.effects) {
            if (ef.t !== 'market') continue;
            for (const id of ef.assets) logPrice[id] += Math.log(1 + ef.min + rand() * (ef.max - ef.min));
          }
          break;
        }
      }
      if (!economySet) economy = pickFrom(rand, ECONOMIES, (e) => ECONOMY_TRANSITION[economy][e]);
    }
    for (const id of ASSET_IDS) growth[id].push(Math.exp(logPrice[id] / years) - 1);
  }
  return Object.fromEntries(
    ASSET_IDS.map((id) => {
      const sorted = growth[id].sort((a, b) => a - b);
      return [id, sorted[Math.floor(sorted.length / 2)]];
    }),
  );
}

/**
 * 補正。計算で出した値に、前もって試して求めた微調整（src/data/marketCalibration.json）を足す。
 * 微調整は、銘柄・ニュース・大きなイベントのデータを変えたら、npm run calibrate で作り直す
 */
export function baseCorrection(): Record<Key, number> {
  return computeCorrection();
}

const CORRECTION: Record<Key, number> = (() => {
  const c = computeCorrection();
  const offsets = (calibration as { offsets: Record<string, number> }).offsets;
  for (const id of ASSET_IDS) c[id] += offsets[id] ?? 0;
  return c;
})();

/** 大きなイベントで、銘柄の値段を一気に動かす。動いた金額（自分の資産）を返す */
export function shockPrice(s: GameState, id: AssetId, rate: number): number {
  return movePrice(s, id, rate);
}

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
    startEconomy: s.market.economy,
    amounts: Object.fromEntries(KEYS.map((k) => [k, 0])),
    newsIds: [],
    economySet: false,
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

/** 家の相場と、持ち家の値段を動かす。動いた金額（持ち家）を返す */
function moveRealEstate(s: GameState, rate: number, aging = 0): number {
  s.market.realEstateIndex *= 1 + rate;
  const home = s.player.home;
  if (!home) return 0;
  const before = home.value;
  home.value *= (1 + rate) * (1 - aging);
  s.yearMarket.amounts.realEstate += home.value - before;
  return home.value - before;
}

/**
 * ターンの終わりの小さな値動き。平均の伸びと景気の上乗せは、1年で1年分になるように、ターンごとに少しずつ出す。
 * 1年の値動きの大きさは、すべてこの動きで出す。1ターンの月数（s.monthsPerTurn）に合わせて大きさを変える。動いた金額の合計を返す
 */
export function updateMarketMonth(s: GameState): number {
  const e = s.market.economy;
  const share = s.monthsPerTurn / 12;
  let moved = 0;
  for (const id of ASSET_IDS) {
    const a = ASSETS[id];
    const drift = Math.pow(1 + a.meanReturn + CORRECTION[id] + a.drift[e], share) - 1;
    const noise = a.volatility * Math.sqrt(share) * randomNormal(s);
    moved += movePrice(s, id, clamp(drift + noise, MONTH_LIMIT));
  }
  return moved;
}

/**
 * ターンの終わりに、ニュースが起きるか決める（1.5年に2回くらい。design.md 7章）。
 * 起きたら相場を動かし、画面に見せるための結果を s.newsEvent に入れる。動いた金額の合計を返す
 */
export function maybeNews(s: GameState): number {
  if (nextRandom(s) >= newsTurnChance(s.monthsPerTurn)) return 0;
  return applyNews(s, pickWeighted(s, NEWS, (n) => n.weight)!);
}

/** ニュースを起こす。動いた金額の合計を返す */
export function applyNews(s: GameState, news: NewsDef): number {
  const m = s.market;
  const prevEconomy = m.economy;
  const before = { ...m.prices };
  const amounts: Record<Key, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  let moved = 0;
  for (const id of ASSET_IDS) {
    const shock = news.shocks[id];
    if (!shock) continue;
    amounts[id] = movePrice(s, id, clamp(shock, SHOCK_LIMIT));
    moved += amounts[id];
  }
  if (news.shocks.realEstate) {
    amounts.realEstate = moveRealEstate(s, clamp(news.shocks.realEstate, SHOCK_LIMIT));
    moved += amounts.realEstate;
  }
  if (news.economy) {
    m.economy = news.economy;
    s.yearMarket.economySet = true;
  }
  if (news.depositRateChange) {
    m.depositRate = Math.min(DEPOSIT_RATE_MAX, Math.max(DEPOSIT_RATE_MIN, m.depositRate + news.depositRateChange));
  }
  if (news.inflation) m.livingIndex *= 1 + news.inflation;
  const rates: Record<Key, number> = Object.fromEntries(ASSET_IDS.map((id) => [id, m.prices[id] / before[id] - 1]));
  rates.realEstate = news.shocks.realEstate ?? 0;
  s.yearMarket.newsIds.push(news.id);
  const event: NewsEvent = { id: news.id, year: s.year, month: s.month, prevEconomy, rates, amounts, moved };
  s.newsEvent = event;
  return moved;
}

/**
 * 年末の相場。家の相場が1年分動き、物価と給料の水準が上がる。
 * その年にニュースで景気が変わらなかったときは、景気が確率で移り変わる。1年の値動きをまとめる。動いた金額の合計を返す
 */
export function updateMarketYear(s: GameState): number {
  const m = s.market;
  const prevEconomy = s.yearMarket.startEconomy;
  const reReturn = clamp(CORRECTION.realEstate + REAL_ESTATE_DRIFT[m.economy] + REAL_ESTATE_VOLATILITY * randomNormal(s), SHOCK_LIMIT);
  const moved = moveRealEstate(s, reReturn, REAL_ESTATE.agingRate);

  if (!s.yearMarket.economySet) {
    const row = ECONOMY_TRANSITION[m.economy];
    m.economy = pickWeighted(s, ECONOMIES, (e) => row[e])!;
  }
  m.livingIndex *= 1 + BASE_INFLATION;
  // 給料は毎年の物価の上昇（BASE_INFLATION）にだけ合わせて上がる。物価上昇のニュースの上乗せには合わせない
  m.wageIndex *= 1 + BASE_INFLATION;

  const ym = s.yearMarket;
  const rates = {} as Record<Key, number>;
  for (const id of ASSET_IDS) rates[id] = m.prices[id] / ym.startPrices[id] - 1;
  rates.realEstate = m.realEstateIndex / ym.startRealEstateIndex - 1;
  s.marketChange = { prevEconomy, rates, amounts: { ...ym.amounts } };
  return moved;
}
