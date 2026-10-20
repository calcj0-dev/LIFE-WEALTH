// コンピューターが自動で遊ぶ仕組み。釣り合いの確認とテストに使う。

import { POLICY_PRESETS, type PolicyPresetId } from '../data/assets';
import { choose, chooseJob, continueYear, createGame, getOptions, nextYear, roll, setPolicy } from './engine';
import type { DecisionOption, GameState, JobId } from './types';

export interface Strategy {
  /** 結婚するか: always = 必ずする、never = しない、random = 半々 */
  marriage: 'always' | 'never' | 'random';
  /** ギャンブルをする確率 */
  gambleChance: number;
  /** お金を使う選択肢（旅行、趣味など）を選ぶ確率 */
  spendChance: number;
}

export const DEFAULT_STRATEGY: Strategy = { marriage: 'random', gambleChance: 0.3, spendChance: 0.5 };

/**
 * 決定の選び方。人間らしく、お金に余裕がないときは使わず、余裕があるときは楽しむ。
 * 乱数は Math.random ではなく、シード値から作った専用の乱数を使う。
 */
function pickOption(s: GameState, options: DecisionOption[], strategy: Strategy, rand: () => number): string {
  const enabled = options.filter((o) => o.enabled);
  const d = s.decision!;
  const cash = s.player.cash;
  const skip = enabled.find((o) => o.id === 'skip' || o.id === 'decline');
  const others = enabled.filter((o) => o !== skip);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  /** 支払いが預金の3分の1以下なら、余裕があるとみなす */
  const affordable = (o: DecisionOption) => (o.cash ?? 0) >= 0 || -(o.cash ?? 0) * 3 <= cash;

  switch (d.kind) {
    case 'marriage': {
      if (enabled.length <= 1) return enabled[0].id;
      const marry = strategy.marriage === 'always' || (strategy.marriage === 'random' && rand() < 0.5);
      if (!marry) return 'decline';
      const work = rand() < 0.6 ? 'full' : 'none';
      const size = cash > 1000 && rand() < 0.3 ? 'large' : 'small';
      return (enabled.find((o) => o.id === `marry:${work}:${size}`) ?? others[0] ?? enabled[0]).id;
    }
    case 'school':
    case 'university': {
      // 私立は、手元に余裕があるときだけ選ぶ
      const rich = cash > 1000;
      return pick(enabled.filter((o) => rich || o.id !== 'private')).id;
    }
    case 'gamble': {
      if (rand() >= strategy.gambleChance) return 'skip';
      const bets = others.filter((o) => Number(o.params?.bet) <= (cash > 200 ? 10 : 1));
      return bets.length ? pick(bets).id : 'skip';
    }
    case 'insurance': {
      const medical = enabled.find((o) => o.id === 'medical');
      if (medical && s.player.age <= 40 && rand() < 0.6) return medical.id;
      const fire = enabled.find((o) => o.id === 'fire' || o.id === 'both');
      if (fire && rand() < 0.7) return fire.id;
      return 'skip';
    }
    case 'realEstate': {
      const home = enabled.find((o) => o.id === 'homeLoan');
      if (home && s.player.age >= 28 && s.player.age <= 45 && rand() < 0.4 && affordable(home)) return home.id;
      const rental = enabled.find((o) => o.id === 'rentalLoan');
      if (rental && rand() < 0.15 && affordable(rental)) return rental.id;
      return 'skip';
    }
    case 'athleteRetire':
      return pick(enabled).id;
    default:
      break;
  }

  if (d.eventId === 'jobChange') {
    const better = others.filter((o) => Number(o.params?.salary ?? 0) > s.player.salary * 1.1);
    return better.length && rand() < 0.5 ? pick(better).id : (skip ?? enabled[0]).id;
  }
  if (d.eventId === 'birth') {
    return others.length && rand() < 0.6 ? (others.find((o) => o.id !== 'birthLeave' || rand() < 0.3) ?? others[0]).id : (skip ?? enabled[0]).id;
  }
  // 「見送る」がある出来事: 余裕があり、楽しめるものだけを、ときどき選ぶ
  if (skip) {
    const fun = others.filter((o) => (o.happiness ?? 0) > 0 && affordable(o));
    return fun.length && rand() < strategy.spendChance ? pick(fun).id : skip.id;
  }
  // どちらにも良い面と悪い面がある選択: 幸福を選ぶか、お金を選ぶか
  if (enabled.length > 1) {
    const byHappiness = [...enabled].sort((a, b) => (b.happiness ?? 0) - (a.happiness ?? 0))[0];
    const byCash = [...enabled].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0];
    return (rand() < 0.5 && affordable(byHappiness) ? byHappiness : byCash).id;
  }
  return enabled[0].id;
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

export function playGame(
  seed: number,
  jobId: JobId,
  policyId: PolicyPresetId,
  strategy: Strategy = DEFAULT_STRATEGY,
): GameState {
  const rand = makeRand(seed);
  let s = createGame(seed);
  s = chooseJob(s, jobId);
  s = setPolicy(s, POLICY_PRESETS[policyId]);
  for (let guard = 0; guard < 10000; guard++) {
    switch (s.phase) {
      case 'yearStart':
        s = continueYear(s);
        break;
      case 'roll':
        s = roll(s);
        break;
      case 'decision':
        s = choose(s, pickOption(s, getOptions(s), strategy, rand));
        break;
      case 'yearEnd':
        s = nextYear(s);
        break;
      case 'finished':
        return s;
      default:
        throw new Error(`unexpected phase ${s.phase}`);
    }
  }
  throw new Error('game did not finish');
}
