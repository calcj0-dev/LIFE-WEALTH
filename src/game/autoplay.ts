// コンピューターが自動で遊ぶ仕組み。釣り合いの確認とテストに使う。

import { POLICY_PRESETS, type PolicyPresetId } from '../data/assets';
import { choose, chooseJob, continueYear, createGame, getOptions, nextYear, resolveShortfall, roll, setPolicy } from './engine';
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

/** 決定の選び方。乱数は Math.random ではなく、シード値から作った専用の乱数を使う */
function pickOption(s: GameState, options: DecisionOption[], strategy: Strategy, rand: () => number): string {
  const enabled = options.filter((o) => o.enabled);
  const d = s.decision!;
  const skip = enabled.find((o) => o.id === 'skip' || o.id === 'decline');
  if (d.kind === 'marriage' && enabled.length > 1) {
    const marry = strategy.marriage === 'always' || (strategy.marriage === 'random' && rand() < 0.5);
    if (!marry) return 'decline';
  }
  // 私立は、手元に余裕があるときだけ選ぶ
  if (d.kind === 'school' || d.kind === 'university') {
    const rich = s.player.cash > 1000;
    const pool = enabled.filter((o) => rich || o.id !== 'private');
    return pool[Math.floor(rand() * pool.length)].id;
  }
  if (d.kind === 'gamble') {
    if (rand() >= strategy.gambleChance) return 'skip';
    const bets = enabled.filter((o) => o.id !== 'skip' && Number(o.params?.bet) <= 10);
    return bets.length ? bets[Math.floor(rand() * bets.length)].id : 'skip';
  }
  if (skip && (d.kind === 'life' || d.kind === 'realEstate' || d.kind === 'insurance')) {
    if (rand() >= strategy.spendChance) return skip.id;
    const others = enabled.filter((o) => o !== skip);
    return others.length ? others[Math.floor(rand() * others.length)].id : skip.id;
  }
  const others = enabled.filter((o) => o !== skip);
  const pool = others.length ? others : enabled;
  return pool[Math.floor(rand() * pool.length)].id;
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
      case 'shortfall':
        s = resolveShortfall(s, 'sell');
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
