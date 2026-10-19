// ゲームの進行。画面（React）には依存しない。
// どの関数も、受け取った状態を書き換えずに、新しい状態を返す。

import { ASSETS, ASSET_IDS, START_DEPOSIT_RATE } from '../data/assets';
import { BOARD } from '../data/board';
import { ALL_EVENTS, BAD_EVENTS, CARE, GOOD_EVENTS, LIFE_EVENTS, SICKNESS, SIDE_BUSINESS, type Effect, type EventDef } from '../data/events';
import { GAMBLES, GAMBLE_BETS, GAMBLE_IDS, GAMBLE_JACKPOT_HAPPINESS, type GambleId } from '../data/gamble';
import { ATHLETE_NEXT_JOBS, ATHLETE_RETIRE_AGE, JOBS, salaryAtAge } from '../data/jobs';
import {
  CHILD_INDEPENDENT_AGE,
  CHILD_INDEPENDENT_AGE_NO_UNIVERSITY,
  DEBT_HAPPINESS,
  EDUCATION_COST,
  END_AGE,
  HOBBY,
  INSURANCE,
  LIVING_COST,
  PET,
  REAL_ESTATE,
  ROULETTE_MAX,
  SENIOR_AGE,
  SENIOR_SALARY_RATE,
  SPOUSE,
  START_AGE,
  START_CASH,
  WEDDING_COST,
} from '../data/rules';
import {
  assetValue,
  buyAsset,
  createLoan,
  financialAssets,
  investByPolicy,
  netWorth,
  payLoanYear,
  prepayLoan,
  realEstateValue,
  sellAsset,
  totalDebt,
} from './finance';
import { updateMarket } from './market';
import { nextRandom, pickWeighted, randomInt } from './rng';
import { computeScore } from './score';
import type {
  AssetId,
  Child,
  Decision,
  DecisionOption,
  GameState,
  JobId,
  Policy,
  Settlement,
  SpouseWork,
} from './types';

const clone = (s: GameState): GameState => structuredClone(s);

function log(s: GameState, key: string, extra: { params?: Record<string, number | string>; cash?: number; happiness?: number } = {}) {
  s.log.push({ age: s.player.age, key, ...extra });
}

function addHappiness(s: GameState, amount: number, key: string) {
  if (amount === 0) return;
  s.player.happiness += amount;
  log(s, key, { happiness: amount });
}

function addCash(s: GameState, amount: number, key: string) {
  if (amount === 0) return;
  s.player.cash += amount;
  log(s, key, { cash: amount });
}

// ---------------------------------------------------------------- 開始

export function createGame(seed: number): GameState {
  const zero = { bond: 0, gold: 0, fund: 0, stock: 0 };
  return {
    saveVersion: 1,
    seed,
    rngState: seed >>> 0,
    year: 1,
    phase: 'setupJob',
    player: {
      age: START_AGE,
      jobId: 'employee',
      salary: 0,
      noIncomeThisYear: false,
      careAtHomeThisYear: false,
      athleteRetireAge: null,
      cash: START_CASH,
      holdings: { ...zero },
      married: false,
      marriageDeclined: false,
      spouse: null,
      children: [],
      properties: [],
      cardLoan: 0,
      medicalPremium: null,
      hobby: false,
      petYears: null,
      sideBusinessIncome: 0,
      policy: { investRatio: 0, allocation: { bond: 0, gold: 0, fund: 1, stock: 0 } },
      happiness: 0,
      position: 0,
      lap: 0,
    },
    market: {
      prices: Object.fromEntries(ASSET_IDS.map((id) => [id, ASSETS[id].startPrice])) as Record<AssetId, number>,
      depositRate: START_DEPOSIT_RATE,
      economy: 'normal',
      realEstateIndex: 1,
      livingIndex: 1,
    },
    newsId: null,
    lastRoll: null,
    lastPath: [],
    decision: null,
    queue: [],
    decisionFrom: null,
    lastSettlement: null,
    history: [],
    log: [],
    stats: { investmentIncome: 0, gambleSpent: 0, gambleReturned: 0, premiumsPaid: 0, insurancePaid: 0 },
    score: null,
  };
}

export function chooseJob(state: GameState, jobId: JobId): GameState {
  assertPhase(state, 'setupJob');
  const s = clone(state);
  s.player.jobId = jobId;
  s.player.salary = JOBS[jobId].startSalary;
  s.player.athleteRetireAge = jobId === 'athlete' ? randomInt(s, ATHLETE_RETIRE_AGE.min, ATHLETE_RETIRE_AGE.max) : null;
  s.phase = 'setupPolicy';
  return s;
}

export function validatePolicy(policy: Policy): boolean {
  const sum = ASSET_IDS.reduce((a, id) => a + policy.allocation[id], 0);
  return (
    policy.investRatio >= 0 &&
    policy.investRatio <= 1 &&
    ASSET_IDS.every((id) => policy.allocation[id] >= 0) &&
    Math.abs(sum - 1) < 1e-6
  );
}

export function setPolicy(state: GameState, policy: Policy): GameState {
  assertPhase(state, 'setupPolicy');
  if (!validatePolicy(policy)) throw new Error('invalid policy');
  const s = clone(state);
  s.player.policy = structuredClone(policy);
  startYear(s);
  return s;
}

// ---------------------------------------------------------------- 年初

function startYear(s: GameState) {
  const p = s.player;
  p.noIncomeThisYear = false;
  p.careAtHomeThisYear = false;
  if (p.spouse) p.spouse.halfThisYear = false;

  if (s.year > 1) {
    p.age += 1;
    growSalary(s);
    if (p.spouse?.work === 'full') p.spouse.income *= 1 + SPOUSE.fullGrowth;
    if (p.age === SENIOR_AGE) {
      p.salary *= SENIOR_SALARY_RATE;
      if (p.spouse) p.spouse.income *= SENIOR_SALARY_RATE;
      log(s, 'auto.senior');
    }
    p.children.forEach((c, i) => ageChild(s, c, i));
    if (p.petYears !== null) {
      p.petYears += 1;
      if (p.petYears >= PET.years) {
        p.petYears = null;
        log(s, 'auto.petEnd');
      }
    }
    if (p.jobId === 'athlete' && p.athleteRetireAge !== null && p.age >= p.athleteRetireAge) {
      s.queue.push({ kind: 'athleteRetire' });
    }
  }

  updateMarket(s);
  s.lastRoll = null;
  s.lastPath = [];
  s.phase = 'yearStart';
}

function growSalary(s: GameState) {
  const p = s.player;
  const job = JOBS[p.jobId];
  if (job.volatility > 0) {
    const r = job.growth + job.volatility * (nextRandom(s) * 2 - 1);
    p.salary *= 1 + r;
    if (job.hitChance > 0 && nextRandom(s) < job.hitChance) {
      p.salary *= job.hitMultiplier;
      log(s, 'auto.hit');
    }
    p.salary = Math.min(job.maxSalary, Math.max(job.minSalary, p.salary));
  } else {
    p.salary *= 1 + job.growth;
  }
}

function ageChild(s: GameState, c: Child, index: number) {
  if (c.independent) return;
  c.age += 1;
  if (c.age === 6 || c.age === 12 || c.age === 15) s.queue.push({ kind: 'school', childIndex: index });
  if (c.age === 18) s.queue.push({ kind: 'university', childIndex: index });
  const independentAge =
    c.university === 'none' ? CHILD_INDEPENDENT_AGE_NO_UNIVERSITY : CHILD_INDEPENDENT_AGE;
  if (c.age >= independentAge && c.university !== null) {
    c.independent = true;
    addHappiness(s, 5, 'auto.childIndependent');
  }
}

/** 年初のニュースを見たあとに進む */
export function continueYear(state: GameState): GameState {
  assertPhase(state, 'yearStart');
  const s = clone(state);
  nextFromQueue(s);
  return s;
}

function nextFromQueue(s: GameState) {
  const d = s.queue.shift();
  if (d) {
    s.decision = d;
    s.decisionFrom = 'yearStart';
    s.phase = 'decision';
  } else {
    s.decision = null;
    s.decisionFrom = null;
    s.phase = 'roll';
  }
}

// ---------------------------------------------------------------- 移動

export function roll(state: GameState): GameState {
  assertPhase(state, 'roll');
  const s = clone(state);
  const steps = randomInt(s, 1, ROULETTE_MAX);
  s.lastRoll = steps;
  s.lastPath = [];
  let pos = s.player.position;
  for (let i = 0; i < steps; i++) {
    pos = BOARD[pos].next[0];
    if (pos === 0) s.player.lap += 1;
    s.lastPath.push(pos);
    if (BOARD[pos].type === 'stopMarriage') break;
  }
  s.player.position = pos;
  s.decision = decisionForSquare(s);
  s.decisionFrom = 'square';
  s.phase = 'decision';
  return s;
}

function decisionForSquare(s: GameState): Decision {
  const sq = BOARD[s.player.position];
  switch (sq.type) {
    case 'start':
      return { kind: 'notice', messageKey: 'square.start' };
    case 'stopMarriage':
      return { kind: 'marriage' };
    case 'life':
      return eventDecision(s, 'life', LIFE_EVENTS);
    case 'good':
      return eventDecision(s, 'good', GOOD_EVENTS);
    case 'bad':
      return eventDecision(s, 'bad', BAD_EVENTS);
    case 'gamble':
      return { kind: 'gamble' };
    case 'insurance':
      return { kind: 'insurance' };
    case 'realEstate': {
      const ratio = REAL_ESTATE.offerMin + nextRandom(s) * (REAL_ESTATE.offerMax - REAL_ESTATE.offerMin);
      const price = Math.round((REAL_ESTATE.basePrice * s.market.realEstateIndex * ratio) / 10) * 10;
      return { kind: 'realEstate', offerPrice: price };
    }
  }
}

function eventDecision(s: GameState, kind: 'life' | 'good' | 'bad', events: EventDef[]): Decision {
  const e = pickWeighted(s, events, (ev) => ev.weight(s));
  if (!e) return { kind: 'notice', messageKey: 'square.nothing' };
  return { kind, eventId: e.id };
}

// ---------------------------------------------------------------- 選択肢

/** 銀行預金で払えるか */
function canAfford(s: GameState, amount: number) {
  return s.player.cash >= amount;
}

const MARRIAGE_HAPPINESS = 15;
const LARGE_WEDDING_HAPPINESS = 5;
const HOME_HAPPINESS = 10;

/** 選んだときにすぐ動くお金と幸福ポイント。結果が運で決まるもの（病気、副業の成否）は分かる分だけ */
function previewOf(s: GameState, effects: Effect[]): { cash?: number; happiness?: number } {
  let cash = 0;
  let happiness = 0;
  for (const e of effects) {
    if (e.t === 'cash') cash += e.amount;
    else if (e.t === 'bonus') cash += s.player.salary * e.rate;
    else if (e.t === 'sideBusiness') cash -= SIDE_BUSINESS.cost;
    else if (e.t === 'happiness') happiness += e.amount;
  }
  return { ...(cash ? { cash } : {}), ...(happiness ? { happiness } : {}) };
}

/** 選んだときにすぐ払うお金 */
function upfrontCost(effects: Effect[]): number {
  return effects.reduce((sum, e) => {
    if (e.t === 'cash' && e.amount < 0) return sum - e.amount;
    if (e.t === 'sideBusiness') return sum + SIDE_BUSINESS.cost;
    return sum;
  }, 0);
}

const hasHome = (s: GameState) => s.player.properties.some((p) => p.use === 'home');
const marriageAvailable = (s: GameState) => !s.player.married && s.player.lap <= 1;

export function getOptions(s: GameState): DecisionOption[] {
  const d = s.decision;
  if (!d) return [];
  const p = s.player;
  switch (d.kind) {
    case 'notice':
      return [{ id: 'ok', key: 'option.ok', enabled: true }];
    case 'marriage': {
      if (!marriageAvailable(s)) return [{ id: 'ok', key: 'option.ok', enabled: true }];
      const opts: DecisionOption[] = [];
      for (const work of ['full', 'none'] as SpouseWork[]) {
        for (const size of ['small', 'large'] as const) {
          opts.push({
            id: `marry:${work}:${size}`,
            key: `option.marry.${work}.${size}`,
            params: { cost: WEDDING_COST[size] },
            enabled: canAfford(s, WEDDING_COST[size]),
            cash: -WEDDING_COST[size],
            happiness: MARRIAGE_HAPPINESS + (size === 'large' ? LARGE_WEDDING_HAPPINESS : 0),
          });
        }
      }
      opts.push({ id: 'decline', key: 'option.marry.decline', enabled: true });
      return opts;
    }
    case 'life':
    case 'good':
    case 'bad': {
      const ev = ALL_EVENTS[d.eventId!];
      const defs = typeof ev.options === 'function' ? ev.options(s) : ev.options;
      // 現金で払えない選択肢は選べない。ただし、どれも払えないとき（介護など避けられない出来事）は選べる
      const allowed = defs.map((o) => (o.enabled ? o.enabled(s) : true));
      const affordable = defs.map((o, i) => allowed[i] && canAfford(s, upfrontCost(o.effects)));
      const useAffordable = affordable.some(Boolean);
      return defs.map((o, i) => ({
        id: o.id,
        key: o.id === 'ok' || o.id === 'skip' ? `option.${o.id}` : `option.${o.id.split(':')[0]}`,
        params: o.params?.(s) ?? (o.id.startsWith('job:') ? { job: o.id.slice(4) } : undefined),
        enabled: useAffordable ? affordable[i] : allowed[i],
        ...previewOf(s, o.effects),
      }));
    }
    case 'gamble': {
      const opts: DecisionOption[] = [];
      for (const g of GAMBLE_IDS) {
        for (const bet of GAMBLE_BETS) {
          opts.push({ id: `${g}:${bet}`, key: `option.gamble.${g}`, params: { bet }, enabled: canAfford(s, bet) });
        }
      }
      opts.push({ id: 'skip', key: 'option.skip', enabled: true });
      return opts;
    }
    case 'insurance': {
      const premium = medicalPremiumAt(p.age);
      const uninsured = p.properties.filter((x) => !x.fireInsured).length;
      const opts: DecisionOption[] = [];
      if (p.medicalPremium === null) opts.push({ id: 'medical', key: 'option.insurance.medical', params: { premium }, enabled: true });
      if (uninsured > 0) opts.push({ id: 'fire', key: 'option.insurance.fire', params: { premium: uninsured * INSURANCE.firePremiumPerProperty }, enabled: true });
      if (p.medicalPremium === null && uninsured > 0) opts.push({ id: 'both', key: 'option.insurance.both', enabled: true });
      opts.push({ id: 'skip', key: 'option.skip', enabled: true });
      return opts;
    }
    case 'realEstate': {
      const price = d.offerPrice!;
      const loanCash = price * (REAL_ESTATE.downPaymentRate + REAL_ESTATE.buyCostRate);
      const fullCash = price * (1 + REAL_ESTATE.buyCostRate);
      const params = { price };
      return [
        { id: 'homeLoan', key: 'option.realEstate.homeLoan', params, enabled: !hasHome(s) && canAfford(s, loanCash), cash: -loanCash, happiness: HOME_HAPPINESS },
        { id: 'homeCash', key: 'option.realEstate.homeCash', params, enabled: !hasHome(s) && canAfford(s, fullCash), cash: -fullCash, happiness: HOME_HAPPINESS },
        { id: 'rentalLoan', key: 'option.realEstate.rentalLoan', params, enabled: canAfford(s, loanCash), cash: -loanCash },
        { id: 'rentalCash', key: 'option.realEstate.rentalCash', params, enabled: canAfford(s, fullCash), cash: -fullCash },
        { id: 'skip', key: 'option.skip', enabled: true },
      ];
    }
    case 'school':
      return [
        { id: 'public', key: 'option.school.public', enabled: true },
        { id: 'private', key: 'option.school.private', enabled: true },
      ];
    case 'university':
      return [
        { id: 'national', key: 'option.university.national', enabled: true },
        { id: 'private', key: 'option.university.private', enabled: true },
        { id: 'none', key: 'option.university.none', enabled: true },
      ];
    case 'athleteRetire':
      return ATHLETE_NEXT_JOBS.map((j) => ({
        id: `job:${j}`,
        key: 'option.jobChange',
        params: { job: j, salary: Math.round(JOBS[j].startSalary) },
        enabled: true,
      }));
  }
}

export function medicalPremiumAt(age: number): number {
  return INSURANCE.medicalBasePremium + INSURANCE.medicalPremiumPerYear * (age - START_AGE);
}

// ---------------------------------------------------------------- 決定

export function choose(state: GameState, optionId: string): GameState {
  assertPhase(state, 'decision');
  const option = getOptions(state).find((o) => o.id === optionId);
  if (!option) throw new Error(`unknown option: ${optionId}`);
  if (!option.enabled) throw new Error(`option not available: ${optionId}`);
  const s = clone(state);
  applyDecision(s, s.decision!, optionId);
  if (s.decisionFrom === 'yearStart') {
    nextFromQueue(s);
  } else {
    s.decision = null;
    s.decisionFrom = null;
    settleYear(s);
  }
  return s;
}

function applyDecision(s: GameState, d: Decision, optionId: string) {
  const p = s.player;
  switch (d.kind) {
    case 'notice':
      return;
    case 'marriage': {
      if (optionId === 'ok') return;
      if (optionId === 'decline') {
        p.marriageDeclined = true;
        log(s, 'marriage.decline');
        return;
      }
      const [, work, size] = optionId.split(':') as [string, SpouseWork, 'small' | 'large'];
      p.married = true;
      p.spouse = { work, income: work === 'full' ? SPOUSE.fullStartIncome : 0, halfThisYear: false };
      addCash(s, -WEDDING_COST[size], `marriage.wedding.${size}`);
      addHappiness(s, MARRIAGE_HAPPINESS, 'marriage.marry');
      if (size === 'large') addHappiness(s, LARGE_WEDDING_HAPPINESS, 'marriage.largeWedding');
      return;
    }
    case 'life':
    case 'good':
    case 'bad': {
      const ev = ALL_EVENTS[d.eventId!];
      const defs = typeof ev.options === 'function' ? ev.options(s) : ev.options;
      const def = defs.find((o) => o.id === optionId)!;
      for (const e of def.effects) applyEffect(s, e, `event.${ev.id}`);
      if (def.effects.length === 0) log(s, `event.${ev.id}.skip`);
      return;
    }
    case 'gamble':
      if (optionId !== 'skip') gamble(s, optionId);
      return;
    case 'insurance':
      if (optionId === 'medical' || optionId === 'both') {
        p.medicalPremium = medicalPremiumAt(p.age);
        log(s, 'insurance.medical.join', { params: { premium: p.medicalPremium } });
      }
      if (optionId === 'fire' || optionId === 'both') {
        p.properties.forEach((x) => (x.fireInsured = true));
        log(s, 'insurance.fire.join');
      }
      return;
    case 'realEstate':
      if (optionId !== 'skip') buyProperty(s, d.offerPrice!, optionId);
      return;
    case 'school':
      p.children[d.childIndex!].school = optionId as Child['school'];
      log(s, `school.${optionId}`);
      return;
    case 'university':
      p.children[d.childIndex!].university = optionId as Child['university'];
      log(s, `university.${optionId}`);
      return;
    case 'athleteRetire':
      changeJob(s, optionId.slice(4) as JobId, true);
      p.athleteRetireAge = null;
      return;
  }
}

function changeJob(s: GameState, jobId: JobId, fromStart: boolean) {
  const p = s.player;
  p.jobId = jobId;
  p.salary = fromStart ? JOBS[jobId].startSalary : salaryAtAge(jobId, p.age);
  p.athleteRetireAge = null;
  log(s, 'job.change', { params: { job: jobId } });
}

function applyEffect(s: GameState, e: Effect, key: string) {
  const p = s.player;
  switch (e.t) {
    case 'cash':
      addCash(s, e.amount, key);
      return;
    case 'happiness':
      addHappiness(s, e.amount, key);
      return;
    case 'salaryRate':
      p.salary *= 1 + e.rate;
      log(s, `${key}.salary`, { params: { rate: e.rate } });
      return;
    case 'bonus':
      addCash(s, p.salary * e.rate, key);
      return;
    case 'noIncome':
      p.noIncomeThisYear = true;
      return;
    case 'birth':
      p.children.push({ age: 0, school: 'public', university: null, independent: false });
      if (p.spouse && p.spouse.work === 'full') {
        if (e.spouse === 'leave') {
          p.spouse.work = 'none';
          p.spouse.income = 0;
        } else {
          p.spouse.halfThisYear = true;
        }
      }
      return;
    case 'spousePart':
      if (p.spouse) {
        p.spouse.work = 'part';
        p.spouse.income = SPOUSE.partIncome;
      }
      log(s, key);
      return;
    case 'sickness': {
      const heavy = nextRandom(s) < SICKNESS.heavyChance;
      const cost = heavy ? SICKNESS.heavyCost : SICKNESS.lightCost;
      if (heavy) p.noIncomeThisYear = true;
      if (p.medicalPremium !== null) {
        s.stats.insurancePaid += cost;
        log(s, `${key}.covered`, { params: { cost, heavy: heavy ? 1 : 0 } });
      } else {
        addCash(s, -cost, heavy ? `${key}.heavy` : `${key}.light`);
      }
      return;
    }
    case 'careHome':
      p.careAtHomeThisYear = true;
      return;
    case 'hobbyStart':
      p.hobby = true;
      return;
    case 'petStart':
      p.petYears = 0;
      return;
    case 'sideBusiness':
      addCash(s, -SIDE_BUSINESS.cost, `${key}.cost`);
      if (nextRandom(s) < SIDE_BUSINESS.successChance) {
        p.sideBusinessIncome = SIDE_BUSINESS.income;
        addHappiness(s, SIDE_BUSINESS.happinessSuccess, `${key}.success`);
      } else {
        addHappiness(s, SIDE_BUSINESS.happinessFail, `${key}.fail`);
      }
      return;
    case 'jobChange':
      changeJob(s, e.jobId, false);
      return;
    case 'vacancy': {
      const rentals = p.properties.filter((x) => x.use === 'rental');
      if (rentals.length) rentals[randomInt(s, 0, rentals.length - 1)].vacant = true;
      log(s, key);
      return;
    }
    case 'repair':
      addCash(s, -e.amount, key);
      return;
    case 'disaster': {
      const target = p.properties[randomInt(s, 0, p.properties.length - 1)];
      if (target.fireInsured) {
        s.stats.insurancePaid += e.amount;
        log(s, `${key}.covered`, { params: { cost: e.amount } });
      } else {
        addCash(s, -e.amount, key);
      }
      return;
    }
  }
}

function gamble(s: GameState, optionId: string) {
  const [id, betText] = optionId.split(':') as [GambleId, string];
  const bet = Number(betText);
  const def = GAMBLES[id];
  let r = nextRandom(s);
  let multiplier = 0;
  for (const o of def.outcomes) {
    if (r < o.probability) {
      multiplier = o.multiplier;
      break;
    }
    r -= o.probability;
  }
  const back = bet * multiplier;
  s.stats.gambleSpent += bet;
  s.stats.gambleReturned += back;
  addCash(s, back - bet, `gamble.${id}`);
  if (multiplier >= 100) addHappiness(s, GAMBLE_JACKPOT_HAPPINESS, 'gamble.jackpot');
}

function buyProperty(s: GameState, price: number, optionId: string) {
  const p = s.player;
  const use = optionId.startsWith('home') ? 'home' : 'rental';
  const withLoan = optionId.endsWith('Loan');
  const fairValue = REAL_ESTATE.basePrice * s.market.realEstateIndex;
  const buyCost = price * REAL_ESTATE.buyCostRate;
  const terms = use === 'home' ? REAL_ESTATE.home : REAL_ESTATE.rental;
  const down = withLoan ? price * REAL_ESTATE.downPaymentRate : price;
  addCash(s, -(down + buyCost), `realEstate.buy.${use}`);
  const id = Math.max(0, ...p.properties.map((x) => x.id)) + 1;
  p.properties.push({
    id,
    use,
    value: fairValue,
    loan: withLoan ? createLoan(price - down, terms.rate, terms.years) : null,
    fireInsured: withLoan,
    vacant: false,
  });
  if (use === 'home') addHappiness(s, HOME_HAPPINESS, 'realEstate.home');
}

// ---------------------------------------------------------------- 年末決算

function livingCost(s: GameState): number {
  const p = s.player;
  const kids = p.children.filter((c) => !c.independent).length;
  let base = (p.married ? LIVING_COST.couple : LIVING_COST.single) + kids * LIVING_COST.perChild;
  if (hasHome(s)) base -= LIVING_COST.homeOwnerDiscount;
  return base * s.market.livingIndex;
}

function educationCost(s: GameState): number {
  const p = s.player;
  const daycare = p.spouse?.work === 'full';
  let total = 0;
  for (const c of p.children) {
    if (c.independent) continue;
    if (c.age <= 5) total += daycare ? EDUCATION_COST.daycare : 0;
    else if (c.age <= 11) total += EDUCATION_COST.elementary[c.school];
    else if (c.age <= 14) total += EDUCATION_COST.juniorHigh[c.school];
    else if (c.age <= 17) total += EDUCATION_COST.highSchool[c.school];
    else if (c.university === 'national' || c.university === 'private') total += EDUCATION_COST.university[c.university];
  }
  return total;
}

function settleYear(s: GameState) {
  const p = s.player;
  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};

  income.salary = p.noIncomeThisYear ? 0 : p.salary * (p.careAtHomeThisYear ? CARE.homeSalaryRate : 1);
  income.spouse = p.spouse ? p.spouse.income * (p.spouse.halfThisYear ? 0.5 : 1) : 0;
  income.sideBusiness = p.sideBusinessIncome;
  income.interest = Math.max(0, p.cash) * s.market.depositRate;
  income.bond = assetValue(s, 'bond') * ASSETS.bond.incomeYield;
  income.dividend = assetValue(s, 'stock') * ASSETS.stock.incomeYield;
  income.rent = p.properties
    .filter((x) => x.use === 'rental' && !x.vacant)
    .reduce((sum, x) => sum + x.value * REAL_ESTATE.rentYield * (1 - REAL_ESTATE.rentCostRate), 0);

  expense.living = livingCost(s);
  expense.hobby = p.hobby ? HOBBY.yearlyCost : 0;
  expense.pet = p.petYears !== null ? PET.yearlyCost : 0;
  expense.education = educationCost(s);
  let loanInterest = 0;
  expense.loan = p.properties.reduce((sum, x) => {
    if (!x.loan) return sum;
    const r = payLoanYear(x.loan);
    loanInterest += r.interest;
    return sum + r.paid;
  }, 0);
  expense.insurance =
    (p.medicalPremium ?? 0) + p.properties.filter((x) => x.fireInsured).length * INSURANCE.firePremiumPerProperty;
  for (const x of p.properties) if (x.loan && x.loan.balance === 0) x.loan = null;

  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expense).reduce((a, b) => a + b, 0);
  const net = totalIncome - totalExpense;
  p.cash += net;
  s.stats.investmentIncome += income.interest + income.bond + income.dividend + income.rent;
  s.stats.premiumsPaid += expense.insurance;

  if (p.cash > 0 && p.cardLoan > 0) {
    const repay = Math.min(p.cash, p.cardLoan);
    p.cardLoan -= repay;
    p.cash -= repay;
  }

  let invested = 0;
  if (net > 0 && p.cash > 0) invested = investByPolicy(s, Math.min(net, p.cash) * p.policy.investRatio);

  const shortfall = coverShortfall(s);

  const loanPrincipal = expense.loan - loanInterest;
  s.lastSettlement = { age: p.age, income, expense, net, invested, loanPrincipal, ...shortfall } satisfies Settlement;
  finalizeYear(s);
}

/** お金が足りないときは、先に資産を売り、それでも足りない分だけカードローンで借りる（利息なし） */
function coverShortfall(s: GameState): { sold: number; borrowed: number } {
  const p = s.player;
  let sold = 0;
  for (const id of ASSET_IDS) {
    if (p.cash >= 0) break;
    sold += sellAsset(s, id, -p.cash);
  }
  if (sold > 0) log(s, 'shortfall.sell', { params: { amount: Math.round(sold) } });
  let borrowed = 0;
  if (p.cash < 0) {
    borrowed = -p.cash;
    p.cardLoan += borrowed;
    p.cash = 0;
    log(s, 'shortfall.loan', { params: { amount: Math.round(borrowed) } });
  }
  return { sold, borrowed };
}

function finalizeYear(s: GameState) {
  if (s.player.cardLoan > 0) addHappiness(s, DEBT_HAPPINESS, 'debt');
  const worth = netWorth(s);
  s.history.push({
    age: s.player.age,
    netWorth: worth,
    cash: s.player.cash,
    assets: {
      ...(Object.fromEntries(ASSET_IDS.map((id) => [id, assetValue(s, id)])) as Record<AssetId, number>),
      realEstate: realEstateValue(s),
    },
    debt: totalDebt(s),
    happiness: s.player.happiness,
    economy: s.market.economy,
    newsId: s.newsId ?? '',
    breakdown: breakdownOf(s, worth),
  });
  s.phase = 'yearEnd';
}

/** 純資産が増えた・減った理由。合計がその年の純資産の増減と一致するよう、残りは「出来事など」に入れる */
function breakdownOf(s: GameState, worth: number) {
  const st = s.lastSettlement!;
  const prev = s.history.length ? s.history[s.history.length - 1].netWorth : START_CASH;
  const investment = st.income.interest + st.income.bond + st.income.dividend + st.income.rent;
  const otherIncome = Object.values(st.income).reduce((a, b) => a + b, 0) - investment;
  const spending = Object.values(st.expense).reduce((a, b) => a + b, 0) - st.loanPrincipal;
  const work = otherIncome - spending;
  const revaluation = s.marketChange
    ? Object.values(s.marketChange.amounts).reduce((a, b) => a + b, 0)
    : 0;
  return { work, investment, revaluation, other: worth - prev - work - investment - revaluation };
}

/** 年末決算を見たあと、次の年へ。65歳なら終了 */
export function nextYear(state: GameState): GameState {
  assertPhase(state, 'yearEnd');
  const s = clone(state);
  if (s.player.age >= END_AGE) {
    s.score = computeScore(s);
    s.phase = 'finished';
    return s;
  }
  s.year += 1;
  startYear(s);
  return s;
}

// ---------------------------------------------------------------- いつでもできる操作

const ACTION_PHASES = new Set(['yearStart', 'decision', 'roll', 'yearEnd']);

function assertCanAct(s: GameState) {
  if (!ACTION_PHASES.has(s.phase)) throw new Error(`cannot act in phase ${s.phase}`);
}

/** 金額分を買う（amount > 0）か売る（amount < 0） */
export function trade(state: GameState, id: AssetId, amount: number): GameState {
  assertCanAct(state);
  const s = clone(state);
  if (amount > 0) buyAsset(s, id, amount);
  else if (amount < 0) sellAsset(s, id, -amount);
  return s;
}

export function changePolicy(state: GameState, policy: Policy): GameState {
  assertCanAct(state);
  if (!validatePolicy(policy)) throw new Error('invalid policy');
  const s = clone(state);
  s.player.policy = structuredClone(policy);
  return s;
}

/** 売れるか（ローンを返して現金がマイナスにならないか） */
export function canSellProperty(s: GameState, propertyId: number): boolean {
  const x = s.player.properties.find((q) => q.id === propertyId);
  if (!x) return false;
  const proceeds = x.value * (1 - REAL_ESTATE.sellFeeRate);
  return s.player.cash + proceeds - (x.loan?.balance ?? 0) >= 0;
}

export function sellProperty(state: GameState, propertyId: number): GameState {
  assertCanAct(state);
  if (!canSellProperty(state, propertyId)) throw new Error('cannot sell property');
  const s = clone(state);
  const p = s.player;
  const x = p.properties.find((q) => q.id === propertyId)!;
  const proceeds = x.value * (1 - REAL_ESTATE.sellFeeRate);
  addCash(s, proceeds - (x.loan?.balance ?? 0), `realEstate.sell.${x.use}`);
  p.properties = p.properties.filter((q) => q.id !== propertyId);
  return s;
}

export function prepay(state: GameState, propertyId: number, amount: number): GameState {
  assertCanAct(state);
  const s = clone(state);
  const x = s.player.properties.find((q) => q.id === propertyId);
  if (!x || !x.loan) throw new Error('no loan');
  const paid = prepayLoan(x.loan, Math.min(amount, s.player.cash));
  s.player.cash -= paid;
  if (x.loan.balance === 0) x.loan = null;
  log(s, 'loan.prepay', { cash: -paid });
  return s;
}

export function cancelInsurance(state: GameState, which: 'medical' | 'fire'): GameState {
  assertCanAct(state);
  const s = clone(state);
  if (which === 'medical') s.player.medicalPremium = null;
  else s.player.properties.forEach((x) => (x.fireInsured = false));
  log(s, `insurance.${which}.cancel`);
  return s;
}

// ---------------------------------------------------------------- そのほか

function assertPhase(s: GameState, phase: GameState['phase']) {
  if (s.phase !== phase) throw new Error(`expected phase ${phase}, got ${s.phase}`);
}

export { financialAssets, netWorth };
