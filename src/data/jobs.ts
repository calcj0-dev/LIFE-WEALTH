import type { JobId } from '../game/types';
import data from './jobs.json';
import { assertValid, checkFields, checkUniqueIds, type Problems } from './validate';

export interface JobDef {
  id: JobId;
  /** 1年目の給料（手取り・年、万円） */
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
  /** 出来事「失業」の起きやすさ（0なら起きない） */
  unemploymentWeight: number;
  /** 出来事「病気・けが」の起きやすさの倍率 */
  sicknessMultiplier: number;
  canBePromoted: boolean;
  /** 転職先に選べるか */
  canTransferTo: boolean;
  /** 生活費の水準（1なら標準。フリーターは質素な暮らしで0.8） */
  livingRate: number;
  /** 職業の固定費（年、万円）。通勤、機材、トレーニングなど */
  fixedCost: number;
}

const FIELDS = {
  id: 'string',
  startSalary: 'number',
  growth: 'number',
  volatility: 'number',
  hitChance: 'number',
  hitMultiplier: 'number',
  minSalary: 'number',
  unemploymentWeight: 'number',
  sicknessMultiplier: 'number',
  canBePromoted: 'boolean',
  canTransferTo: 'boolean',
  livingRate: 'number',
  fixedCost: 'number',
} as const;

export function checkJobs(raw: unknown): Problems {
  const d = raw as { jobs?: unknown; athleteRetireYear?: { min?: unknown; max?: unknown }; athleteNextJobs?: unknown };
  if (!Array.isArray(d.jobs) || d.jobs.length === 0) return ['jobs がありません'];
  const problems: Problems = [];
  d.jobs.forEach((j, i) => {
    problems.push(...checkFields(`jobs[${i}]`, j, FIELDS));
    if (j.maxSalary !== null && typeof j.maxSalary !== 'number') problems.push(`jobs[${i}]: maxSalary は数か null にします`);
  });
  problems.push(...checkUniqueIds('jobs', d.jobs));
  const ids = new Set(d.jobs.map((j: { id: string }) => j.id));
  const r = d.athleteRetireYear;
  if (!r || typeof r.min !== 'number' || typeof r.max !== 'number' || r.min > r.max) problems.push('athleteRetireYear が正しくありません');
  if (!Array.isArray(d.athleteNextJobs) || d.athleteNextJobs.some((j) => !ids.has(j))) problems.push('athleteNextJobs に、ない職業があります');
  return problems;
}

assertValid('src/data/jobs.json', checkJobs(data));

export const JOB_LIST: JobDef[] = data.jobs.map((j) => ({ ...j, maxSalary: j.maxSalary ?? Infinity }));
export const JOBS: Record<JobId, JobDef> = Object.fromEntries(JOB_LIST.map((j) => [j.id, j]));
export const JOB_IDS: JobId[] = JOB_LIST.map((j) => j.id);

/** スポーツ選手が引退する年（何年目か）の範囲 */
export const ATHLETE_RETIRE_YEAR: { min: number; max: number } = data.athleteRetireYear;
/** 引退後に選べる職業 */
export const ATHLETE_NEXT_JOBS: JobId[] = data.athleteNextJobs;

/** その職業の、ある年（何年目か）での給料の水準（転職先の給料に使う）。物価の分は含めない */
export function salaryAtYear(jobId: JobId, year: number): number {
  const job = JOBS[jobId];
  return job.startSalary * Math.pow(1 + job.growth, Math.max(0, year - 1));
}
