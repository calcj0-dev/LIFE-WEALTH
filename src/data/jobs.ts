import type { JobId } from '../game/types';

export interface JobDef {
  id: JobId;
  /** 22歳の給料（手取り・年、万円） */
  startSalary: number;
  /** 毎年の昇給率 */
  growth: number;
  /** 毎年の給料の振れ幅（0なら振れない） */
  volatility: number;
  /** 大ヒットの確率と倍率（YouTuber） */
  hitChance: number;
  hitMultiplier: number;
  minSalary: number;
  maxSalary: number;
  /** ライフイベント「失業」の起きやすさ（0なら起きない） */
  unemploymentWeight: number;
  /** ライフイベント「病気・けが」の起きやすさの倍率 */
  sicknessMultiplier: number;
  canBePromoted: boolean;
  /** 転職先に選べるか */
  canTransferTo: boolean;
}

export const JOBS: Record<JobId, JobDef> = {
  employee: {
    id: 'employee',
    startSalary: 300,
    growth: 0.015,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 1,
    sicknessMultiplier: 1,
    canBePromoted: true,
    canTransferTo: true,
  },
  civil: {
    id: 'civil',
    startSalary: 280,
    growth: 0.01,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 0,
    sicknessMultiplier: 1,
    canBePromoted: true,
    canTransferTo: true,
  },
  engineer: {
    id: 'engineer',
    startSalary: 340,
    growth: 0.02,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 2,
    sicknessMultiplier: 1,
    canBePromoted: true,
    canTransferTo: true,
  },
  athlete: {
    id: 'athlete',
    startSalary: 500,
    growth: 0,
    volatility: 0.3,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 200,
    maxSalary: 3000,
    unemploymentWeight: 0,
    sicknessMultiplier: 2,
    canBePromoted: false,
    canTransferTo: false,
  },
  youtuber: {
    id: 'youtuber',
    startSalary: 150,
    growth: 0.05,
    volatility: 0.5,
    hitChance: 0.05,
    hitMultiplier: 3,
    minSalary: 50,
    maxSalary: 3000,
    unemploymentWeight: 0,
    sicknessMultiplier: 1,
    canBePromoted: false,
    canTransferTo: true,
  },
  freeter: {
    id: 'freeter',
    startSalary: 200,
    growth: 0.005,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 1,
    sicknessMultiplier: 1,
    canBePromoted: false,
    canTransferTo: true,
  },
};

export const JOB_IDS: JobId[] = ['employee', 'civil', 'engineer', 'athlete', 'youtuber', 'freeter'];

/** スポーツ選手の引退年齢の範囲 */
export const ATHLETE_RETIRE_AGE = { min: 33, max: 37 };
/** 引退後に選べる職業 */
export const ATHLETE_NEXT_JOBS: JobId[] = ['employee', 'freeter', 'youtuber'];

/** その職業の、ある年齢での給料の水準（転職先の給料に使う） */
export function salaryAtAge(jobId: JobId, age: number): number {
  const job = JOBS[jobId];
  return job.startSalary * Math.pow(1 + job.growth, Math.max(0, age - 22));
}
