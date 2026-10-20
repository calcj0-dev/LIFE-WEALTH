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
  /** 生活費の水準（1なら標準。フリーターは質素な暮らしで0.8） */
  livingRate: number;
  /** 職業の固定費（年、万円）。通勤、機材、トレーニングなど */
  fixedCost: number;
}

/**
 * 職業のデータ。給料は手取り（年、万円）。
 * 国税庁「民間給与実態統計調査」令和6年分（正社員の平均給与 545万円、正社員以外 206万円、情報通信業 660万円。いずれも税込み）
 * を、手取りに直した水準に合わせて丸めた。スポーツ選手と YouTuber は統計がないので、仮の値。
 */
export const JOBS: Record<JobId, JobDef> = {
  employee: {
    id: 'employee',
    startSalary: 250,
    growth: 0.01,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 1,
    sicknessMultiplier: 1,
    canBePromoted: true,
    canTransferTo: true,
    livingRate: 1,
    fixedCost: 10,
  },
  civil: {
    id: 'civil',
    startSalary: 240,
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
    livingRate: 1,
    fixedCost: 10,
  },
  engineer: {
    id: 'engineer',
    startSalary: 280,
    growth: 0.015,
    volatility: 0,
    hitChance: 0,
    hitMultiplier: 1,
    minSalary: 0,
    maxSalary: Infinity,
    unemploymentWeight: 2,
    sicknessMultiplier: 1,
    canBePromoted: true,
    canTransferTo: true,
    livingRate: 1,
    fixedCost: 20,
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
    livingRate: 1,
    fixedCost: 100,
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
    livingRate: 1,
    fixedCost: 30,
  },
  freeter: {
    id: 'freeter',
    startSalary: 170,
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
    livingRate: 0.8,
    fixedCost: 0,
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
