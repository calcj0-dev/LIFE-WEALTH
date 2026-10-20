import { RANKS_BY_JOB, SECURITY } from '../data/rules';
import { netWorth } from './finance';
import type { GameState, JobId, Score } from './types';

// 評価（幸福度）の計算。design.md 9章
// ほかの評価に差し替えられるよう、この部品だけで完結させる。

/** 老後の安心ポイント。増えるほど伸びが鈍る。マイナスなら同じ形でマイナス */
export function securityPoints(worth: number): number {
  const sign = worth < 0 ? -1 : 1;
  return sign * SECURITY.scale * Math.log10(1 + Math.abs(worth) / SECURITY.unit);
}

/** ランクは、スタート時の職業ごとの基準で決める */
export function rankOf(total: number, jobId: JobId): string {
  return RANKS_BY_JOB[jobId].find((r) => total >= r.min)!.rank;
}

export function computeScore(s: GameState): Score {
  const worth = netWorth(s);
  const happinessPoints = s.player.happiness;
  const security = securityPoints(worth);
  const total = happinessPoints + security;
  const jobId = s.player.startJobId ?? s.player.jobId;
  return { happinessPoints, securityPoints: security, total, rank: rankOf(total, jobId), netWorth: worth, jobId };
}
