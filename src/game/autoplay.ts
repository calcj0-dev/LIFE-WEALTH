// コンピューターが自動で遊ぶ仕組み。釣り合いの確認とテストに使う。

import { JOBS } from '../data/jobs';
import {
  bonusDistance,
  choose,
  chooseJob,
  chooseYears,
  closeTrade,
  createGame,
  getOptions,
  nextYear,
  openTradeCard,
  recommendedSaving,
  roll,
  setSaving,
  trade,
} from './engine';
import { HAND_MAX } from '../data/cards';
import type { DecisionOption, GameState, JobId } from './types';

export interface Strategy {
  /** 年末に、預金のうち生活費の半年分を残して、投資信託を買う割合（0なら投資しない） */
  investRate: number;
  /** 投資信託の積み立てを、おすすめの金額（手取りの1割）でするか */
  saving?: boolean;
  /** ギャンブルをする確率 */
  gambleChance: number;
  /** 家を買えるときに買う確率 */
  homeChance: number;
}

export const DEFAULT_STRATEGY: Strategy = { investRate: 0.5, gambleChance: 0.3, homeChance: 0.4 };

/** 決定の選び方。人間らしく、お金に余裕がないときは使わない */
function pickOption(s: GameState, options: DecisionOption[], strategy: Strategy, rand: () => number): string {
  const enabled = options.filter((o) => o.enabled);
  const d = s.decision!;
  const cash = s.player.cash;
  const skip = enabled.find((o) => o.id === 'skip');
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  switch (d.kind) {
    case 'gamble': {
      if (rand() >= strategy.gambleChance) return 'skip';
      const bets = enabled.filter((o) => o.id !== 'skip' && Number(o.params?.bet) <= (cash > 200 ? 10 : 1));
      return bets.length ? pick(bets).id : 'skip';
    }
    case 'realEstate': {
      const home = enabled.find((o) => o.id === 'homeLoan');
      // 頭金と諸費用を払っても、預金が半分以上残るときだけ買う
      if (home && rand() < strategy.homeChance && -(home.cash ?? 0) * 2 <= cash) return home.id;
      return 'skip';
    }
    case 'stock': {
      // 預金に余裕があれば、ときどき買う
      const buy = enabled.find((o) => o.id !== 'skip' && -(o.cash ?? 0) * 5 <= cash);
      return buy && strategy.investRate > 0 && rand() < 0.5 ? buy.id : 'skip';
    }
    case 'event': {
      if (d.eventId === 'jobChange') {
        const better = enabled.filter((o) => Number(o.params?.salary ?? 0) > s.player.salary * 1.1);
        return better.length && rand() < 0.5 ? pick(better).id : skip!.id;
      }
      if (d.eventId === 'sideBusiness') {
        const t = enabled.find((o) => o.id === 'try');
        return t && cash > 500 && rand() < 0.3 ? t.id : 'skip';
      }
      return enabled[0].id;
    }
    default:
      return pick(enabled).id;
  }
}

function makeRand(seed: number) {
  let t = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** カードを使って、ボーナスマスにぴったり止まるようにねらう。使わないときは、ふつうにルーレットを回す */
function rollWithCards(s: GameState): GameState {
  const hand = s.player.hand;
  const dist = bonusDistance(s);
  const exact = hand.indexOf('exact');
  if (exact >= 0 && dist >= 1 && dist <= 6) return roll(s, { index: exact, exact: dist });
  // ダッシュは出目の2倍、スーパーダッシュは3倍なので、ぴったり止まれる見込みがある距離のときに使う
  const dash = hand.indexOf('dash');
  if (dash >= 0 && dist >= 7 && dist <= 12 && dist % 2 === 0) return roll(s, { index: dash });
  const superDash = hand.indexOf('superDash');
  if (superDash >= 0 && dist >= 9 && dist <= 18 && dist % 3 === 0) return roll(s, { index: superDash });
  // 手札がいっぱいなら、取引カードを使って枠を空ける
  const tradeCard = hand.indexOf('trade');
  if (tradeCard >= 0 && hand.length >= HAND_MAX) return roll(closeTrade(openTradeCard(s, tradeCard)));
  return roll(s);
}

/** 年末に、余ったお金で投資信託を買う */
function investAtYearEnd(s: GameState, strategy: Strategy): GameState {
  if (strategy.investRate <= 0) return s;
  const buffer = (s.history.at(-1)?.expenseTotal ?? 0) / 2;
  const amount = Math.floor((s.player.cash - buffer) * strategy.investRate);
  return amount >= 1 ? trade(s, 'fund', amount) : s;
}

/** 遊んだ回数の記録（テンポの確認に使う）。popups は、ポップアップで止まった回数 */
export interface PlayCounts {
  turns: number;
  popups: number;
}

export function playGame(
  seed: number,
  jobId: JobId,
  years = 20,
  strategy: Strategy = DEFAULT_STRATEGY,
  counts: PlayCounts = { turns: 0, popups: 0 },
): GameState {
  if (!JOBS[jobId]) throw new Error(`unknown job: ${jobId}`);
  const rand = makeRand(seed);
  let s = chooseJob(chooseYears(createGame(seed), years), jobId);
  s = setSaving(s, strategy.saving ? { fund: recommendedSaving(s) } : {});
  for (let guard = 0; guard < 100000; guard++) {
    switch (s.phase) {
      case 'roll':
        s = rollWithCards(s);
        counts.turns += 1;
        break;
      case 'decision':
        counts.popups += 1;
        s = choose(s, pickOption(s, getOptions(s), strategy, rand));
        break;
      case 'yearEnd':
        s = nextYear(investAtYearEnd(s, strategy));
        break;
      case 'finished':
        return s;
      default:
        throw new Error(`unexpected phase ${s.phase}`);
    }
  }
  throw new Error('game did not finish');
}
