// ゲームの進行。画面（React）には依存しない。1ターン＝1ヶ月（design.md 2章）。
// どの関数も、受け取った状態を書き換えずに、新しい状態を返す。

import { ASSETS, ASSET_IDS, START_DEPOSIT_RATE, zeroHoldings } from '../data/assets';
import { BOARD } from '../data/board';
import { CARDS, CARDS_BY_ID, HAND_MAX } from '../data/cards';
import { INVEST_TALKS, INVEST_TALKS_BY_ID, TALK_AMOUNTS } from '../data/investTalks';
import { EVENTS, EVENTS_BY_ID, SICKNESS, SIDE_BUSINESS, SPOUSE_PART_INCOME, type Effect, type EventDef, type EventSize } from '../data/events';
import { GAMBLES, GAMBLE_BETS, GAMBLE_IDS, type GambleId } from '../data/gamble';
import { ATHLETE_NEXT_JOBS, ATHLETE_RETIRE_YEAR, JOBS, JOB_IDS, salaryAtYear } from '../data/jobs';
import {
  BIRTH,
  BONUS,
  CHILD_INDEPENDENT_AGE,
  CHILD_INDEPENDENT_AGE_NO_UNIVERSITY,
  EDUCATION_COST,
  HIGH_SCHOOL_FACES,
  INSURANCE,
  LIVING_COST,
  MARRIAGE,
  MAX_CHILDREN,
  MONTHS_PER_TURN,
  MONTHS_PER_YEAR,
  REAL_ESTATE,
  ROULETTE_MAX,
  SAVING,
  SPOUSE,
  SPOUSE_WORK_FACES,
  START_CASH,
  STOCK_SQUARE,
  UNIVERSITY_FACES,
  YEAR_OPTIONS,
  DEFAULT_YEARS,
  BASE_INFLATION,
} from '../data/rules';
import {
  assetValue,
  buyAsset,
  buyShares,
  createLoan,
  loanPayment,
  financialAssets,
  netWorth,
  payLoanMonth,
  prepayLoan,
  realEstateValue,
  sellAsset,
  sellOrder,
  sellShares,
  totalDebt,
} from './finance';
import { maybeNews, newYearMarket, shockPrice, updateMarketMonth, updateMarketYear } from './market';
import { BIG_EVENTS, BIG_EVENTS_BY_ID, turnChance } from '../data/bigEvents';
import { nextRandom, pickWeighted, randomInt } from './rng';
import { computeResult } from './score';
import type { AssetId, Child, Decision, DecisionOption, GameState, JobId, Settlement, SpouseWork } from './types';

const clone = (s: GameState): GameState => structuredClone(s);

type LogExtra = { params?: Record<string, number | string>; cash?: number; notice?: boolean };

function log(s: GameState, key: string, extra: LogExtra = {}) {
  s.log.push({ year: s.year, month: s.month, key, ...extra });
}

function addCash(s: GameState, amount: number, key: string, params?: Record<string, number | string>) {
  if (amount === 0) return;
  s.player.cash += amount;
  log(s, key, { cash: amount, ...(params ? { params } : {}) });
}

/** ルーレット（1〜6）を回す */
const rollDie = (s: GameState) => randomInt(s, 1, ROULETTE_MAX);
/** 出目がどの結果に当たるか */
function faceResult<K extends string>(faces: Record<K, number[]>, face: number): K {
  return (Object.keys(faces) as K[]).find((k) => faces[k].includes(face))!;
}

const emptyFlows = (year: number): Settlement => ({
  year,
  income: {},
  expense: {},
  net: 0,
  loanPrincipal: 0,
  sold: 0,
  borrowed: 0,
  revaluation: 0,
  talks: [],
  saved: 0,
  repaid: 0,
});

// ---------------------------------------------------------------- 開始

/** 1ターンの月数として使える数（12を割り切れる数） */
const VALID_MONTHS_PER_TURN = [1, 2, 3, 4, 6, 12];

/** ゲームを作る。monthsPerTurn を渡すと、1ターンの月数を変えられる（試すとき用。design.md 0.1） */
export function createGame(seed: number, options: { monthsPerTurn?: number } = {}): GameState {
  const monthsPerTurn = options.monthsPerTurn ?? MONTHS_PER_TURN;
  if (!VALID_MONTHS_PER_TURN.includes(monthsPerTurn)) throw new Error(`invalid monthsPerTurn: ${monthsPerTurn}`);
  const s: GameState = {
    saveVersion: 3,
    seed,
    rngState: seed >>> 0,
    years: DEFAULT_YEARS,
    monthsPerTurn,
    year: 1,
    month: 1,
    phase: 'setupYears',
    player: {
      jobId: JOB_IDS[0],
      salary: 0,
      noIncomeMonths: 0,
      athleteRetireYear: null,
      cash: START_CASH,
      holdings: zeroHoldings(),
      cost: zeroHoldings(),
      saving: zeroHoldings(),
      savingPaused: false,
      married: false,
      spouse: null,
      children: [],
      home: null,
      cardLoan: 0,
      medicalPremium: null,
      sideBusinessIncome: 0,
      sideBusinessTried: false,
      position: 0,
      lap: 0,
      hand: [],
      talks: [],
    },
    market: {
      prices: Object.fromEntries(ASSET_IDS.map((id) => [id, ASSETS[id].startPrice])),
      depositRate: START_DEPOSIT_RATE,
      economy: 'normal',
      realEstateIndex: 1,
      livingIndex: 1,
      wageIndex: 1,
    },
    lastRoll: null,
    lastFace: null,
    lastCard: null,
    cardUsed: false,
    tradeOpen: false,
    bonusSquare: 0,
    lastPath: [],
    decision: null,
    queue: [],
    decisionFrom: null,
    yearFlows: emptyFlows(1),
    lastSettlement: null,
    history: [],
    prices: [],
    log: [],
    stats: { investmentIncome: 0, gambleSpent: 0, gambleReturned: 0, premiumsPaid: 0, insurancePaid: 0, savingTotal: 0, talkSpent: 0, talkReturned: 0 },
    result: null,
    yearMarket: { startPrices: {}, startRealEstateIndex: 1, startEconomy: 'normal', amounts: {}, newsIds: [], economySet: false },
    marketChange: null,
    bigEvent: null,
    newsEvent: null,
    lastMonth: null,
  };
  s.yearMarket = newYearMarket(s);
  recordPrices(s, 0);
  placeBonus(s);
  return s;
}

/** 遊ぶ年数を決める（10・20・30・40・50年） */
export function chooseYears(state: GameState, years: number): GameState {
  assertPhase(state, 'setupYears');
  if (!YEAR_OPTIONS.includes(years)) throw new Error(`invalid years: ${years}`);
  const s = clone(state);
  s.years = years;
  s.phase = 'setupJob';
  return s;
}

export function chooseJob(state: GameState, jobId: JobId): GameState {
  assertPhase(state, 'setupJob');
  if (!JOBS[jobId]) throw new Error(`unknown job: ${jobId}`);
  const s = clone(state);
  s.player.jobId = jobId;
  s.player.salary = JOBS[jobId].startSalary;
  s.player.athleteRetireYear = jobId === 'athlete' ? randomInt(s, ATHLETE_RETIRE_YEAR.min, ATHLETE_RETIRE_YEAR.max) : null;
  s.phase = 'setupSaving';
  return s;
}

/** 積み立てのおすすめの金額（毎月の手取りの1割、1万円単位） */
export function recommendedSaving(s: GameState): number {
  return Math.max(1, Math.round((s.player.salary / MONTHS_PER_YEAR) * SAVING.recommendRate));
}

/** 積み立ての金額が正しいか（投資信託とゴールドだけ、1万円単位、0以上） */
export function validSaving(saving: Record<AssetId, number>): boolean {
  return Object.entries(saving).every(
    ([id, v]) => !!ASSETS[id] && Number.isInteger(v) && v >= 0 && (v === 0 || ASSETS[id].accumulate),
  );
}

/** 毎月の積み立ての金額を決める。ゲームの始めと、取引タイムで使う（design.md 6.3） */
export function setSaving(state: GameState, saving: Record<AssetId, number>): GameState {
  if (state.phase !== 'setupSaving') assertCanTrade(state);
  if (!validSaving(saving)) throw new Error('invalid saving');
  const s = clone(state);
  s.player.saving = { ...zeroHoldings(), ...saving };
  if (s.phase === 'setupSaving') s.phase = 'roll';
  else log(s, 'saving.change', { params: { amount: sum(s.player.saving) } });
  return s;
}

/** ルーレットで職業を決める（6つの職業を同じ確率で） */
export function rollJob(state: GameState): GameState {
  assertPhase(state, 'setupJob');
  const probe = clone(state);
  const jobId = JOB_IDS[randomInt(probe, 0, JOB_IDS.length - 1)];
  return chooseJob({ ...state, rngState: probe.rngState }, jobId);
}

// ---------------------------------------------------------------- 移動とマス

/**
 * ルーレットを回して進む。移動のカード（ダッシュ、スーパーダッシュ、ぴったり）を使うときは card を渡す（design.md 3.9）。
 * ダッシュとスーパーダッシュは、ルーレットを1回回して、出目の2倍・3倍進む
 */
export function roll(state: GameState, card?: { index: number; exact?: number }): GameState {
  assertPhase(state, 'roll');
  if (state.tradeOpen) throw new Error('trade time is open');
  if (state.bigEvent) throw new Error('big event is showing');
  if (state.newsEvent) throw new Error('news is showing');
  const s = clone(state);
  let face: number;
  let times = 1;
  s.lastCard = null;
  if (card) {
    const id = takeCard(s, card.index);
    const def = CARDS_BY_ID[id];
    if (def.kind === 'trade') throw new Error('use openTradeCard for the trade card');
    if (def.kind === 'exact') {
      if (!card.exact || !Number.isInteger(card.exact) || card.exact < 1 || card.exact > ROULETTE_MAX) throw new Error('invalid exact');
      face = card.exact;
    } else {
      face = rollDie(s);
      times = def.times ?? 1;
    }
    s.lastCard = id;
    log(s, 'card.use', { params: { card: id } });
  } else face = rollDie(s);
  const steps = face * times;
  s.lastFace = face;
  s.lastRoll = steps;
  s.lastPath = [];
  let pos = s.player.position;
  for (let i = 0; i < steps; i++) {
    pos = BOARD[pos].next[0];
    if (pos === 0) s.player.lap += 1;
    s.lastPath.push(pos);
    // 結婚マスは、独身なら出目が残っていても必ず止まる（design.md 3.5）
    if (BOARD[pos].type === 'stopMarriage' && !s.player.married) break;
  }
  s.player.position = pos;
  handleSquare(s);
  return s;
}

// ---------------------------------------------------------------- カードとボーナスマス（design.md 3.9、3.10）

/** カードを1枚もらう。lucky ならラッキーカードマスの出やすさで選ぶ */
function gainCard(s: GameState, lucky: boolean) {
  const card = pickWeighted(s, CARDS, (c) => (lucky ? c.luckyWeight : c.weight))!;
  s.player.hand.push(card.id);
  log(s, lucky ? 'card.getLucky' : 'card.get', { params: { card: card.id }, notice: true });
}

/** 手札からカードを取り出す */
function takeCard(s: GameState, index: number): string {
  if (s.cardUsed) throw new Error('a card was already used this turn');
  const id = s.player.hand[index];
  if (!id) throw new Error(`no card at ${index}`);
  s.player.hand.splice(index, 1);
  s.cardUsed = true;
  return id;
}

/** 取引カードを使い、その場で取引タイムを開く。閉じたあとはルーレットを回す */
export function openTradeCard(state: GameState, index: number): GameState {
  assertPhase(state, 'roll');
  if (CARDS_BY_ID[state.player.hand[index]]?.kind !== 'trade') throw new Error('not a trade card');
  const s = clone(state);
  const id = takeCard(s, index);
  s.tradeOpen = true;
  log(s, 'card.use', { params: { card: id } });
  return s;
}

/** 取引カードで開いた取引タイムを閉じる */
export function closeTrade(state: GameState): GameState {
  if (!state.tradeOpen) throw new Error('trade time is not open');
  const s = clone(state);
  s.tradeOpen = false;
  return s;
}

/** 次のボーナスマスを決める。今いる場所から10〜40マス先。スタートと結婚マスには付けない */
function placeBonus(s: GameState) {
  for (let guard = 0; guard < 100; guard++) {
    const ahead = randomInt(s, BONUS.minAhead, BONUS.maxAhead);
    const index = (s.player.position + ahead) % BOARD.length;
    const type = BOARD[index].type;
    if (type !== 'start' && type !== 'stopMarriage') {
      s.bonusSquare = index;
      return;
    }
  }
}

/** ボーナスマスまで、あと何マスか */
export function bonusDistance(s: GameState): number {
  return (s.bonusSquare - s.player.position + BOARD.length) % BOARD.length;
}

function startDecision(s: GameState, d: Decision, from: 'queue' | 'square') {
  s.decision = d;
  s.decisionFrom = from;
  s.phase = 'decision';
}

/** 止まったマスの出来事。小さな出来事は止めずにすぐ起こし、月末に進む（design.md 2.2） */
function handleSquare(s: GameState) {
  const p = s.player;
  const square = BOARD[p.position];
  const notice = (key: string) => {
    log(s, key, { notice: true });
    endMonth(s);
  };
  // ボーナスマスに、ぴったり止まった（design.md 3.10）。そのマスの本来の出来事は起きない
  if (p.position === s.bonusSquare) {
    addCash(s, BONUS.amount, 'bonus.get');
    placeBonus(s);
    return endMonth(s);
  }
  switch (square.type) {
    case 'card':
    case 'luckyCard':
      gainCard(s, square.type === 'luckyCard');
      if (p.hand.length > HAND_MAX) return startDecision(s, { kind: 'discard' }, 'square');
      return endMonth(s);
    case 'start':
      return notice('square.start');
    case 'stopMarriage':
      if (p.married) return notice('square.marriage.married');
      return startDecision(s, { kind: 'marriage' }, 'square');
    case 'birth':
      if (!p.married) {
        addCash(s, -BIRTH.gift, 'birth.gift');
        return endMonth(s);
      }
      if (p.children.length >= MAX_CHILDREN) return notice('square.birth.full');
      return startDecision(s, { kind: 'birth' }, 'square');
    case 'small': {
      const ev = pickEvent(s, 'small');
      if (!ev) return notice('square.nothing');
      for (const e of ev.effects ?? []) applyEffect(s, e, `event.${ev.id}`);
      return endMonth(s);
    }
    case 'medium':
    case 'large': {
      const ev = pickEvent(s, square.type);
      if (!ev) return notice('square.nothing');
      const params = ev.effects?.some((e) => e.t === 'sickness') ? { heavy: nextRandom(s) < SICKNESS.heavyChance ? 1 : 0 } : undefined;
      return startDecision(s, { kind: 'event', eventId: ev.id, ...(params ? { params } : {}) }, 'square');
    }
    case 'stock': {
      // 4業種のうち1つの株が、割安に買える（design.md 3.4）
      const stocks = ASSET_IDS.filter((id) => ASSETS[id].kind === 'stock');
      return startDecision(s, { kind: 'stock', assetId: stocks[randomInt(s, 0, stocks.length - 1)] }, 'square');
    }
    case 'investTalk':
      // 投資の落とし穴。3つのどれかの話を持ちかけられる（design.md 6.4）
      return startDecision(s, { kind: 'talk', talkId: INVEST_TALKS[randomInt(s, 0, INVEST_TALKS.length - 1)].id }, 'square');
    case 'gamble':
      return startDecision(s, { kind: 'gamble' }, 'square');
    case 'realEstate': {
      if (p.home) return notice('square.realEstate.owned');
      const ratio = REAL_ESTATE.offerMin + nextRandom(s) * (REAL_ESTATE.offerMax - REAL_ESTATE.offerMin);
      const price = Math.round((REAL_ESTATE.basePrice * s.market.realEstateIndex * ratio) / 10) * 10;
      return startDecision(s, { kind: 'realEstate', offerPrice: price }, 'square');
    }
  }
}

const employed = (s: GameState) => s.player.noIncomeMonths === 0;

/** 出来事の条件に合うか */
export function eventMatches(s: GameState, ev: EventDef): boolean {
  const p = s.player;
  const job = JOBS[p.jobId];
  const w = ev.when ?? {};
  const checks: [boolean | undefined, boolean][] = [
    [w.married, p.married],
    [w.hasChildren, p.children.some((c) => !c.independent)],
    [w.homeOwner, p.home !== null],
    [w.employed, employed(s)],
    [w.promotable, job.canBePromoted],
    [w.stableIncome, job.volatility === 0],
    [w.sideBusiness, p.sideBusinessTried],
  ];
  if (checks.some(([want, actual]) => want !== undefined && want !== actual)) return false;
  if (w.spouseWork !== undefined && p.spouse?.work !== w.spouseWork) return false;
  if (w.minYear !== undefined && s.year < w.minYear) return false;
  if (w.maxYear !== undefined && s.year > w.maxYear) return false;
  if (ev.choice === 'jobChange' && jobChangeTargets(s).length === 0) return false;
  return true;
}

function eventWeight(s: GameState, ev: EventDef): number {
  if (!eventMatches(s, ev)) return 0;
  const job = JOBS[s.player.jobId];
  if (ev.weightBy === 'unemployment') return ev.weight * job.unemploymentWeight;
  if (ev.weightBy === 'sickness') return ev.weight * job.sicknessMultiplier;
  return ev.weight;
}

function pickEvent(s: GameState, size: EventSize): EventDef | null {
  return pickWeighted(
    s,
    EVENTS.filter((e) => e.size === size),
    (e) => eventWeight(s, e),
  );
}

const jobChangeTargets = (s: GameState) => JOB_IDS.filter((j) => j !== s.player.jobId && JOBS[j].canTransferTo);

// ---------------------------------------------------------------- 選択肢

/** 銀行預金で払えるか */
const canAfford = (s: GameState, amount: number) => s.player.cash >= amount;

/** 選ぶものがない出来事で、すぐに動くお金（分かる分だけ） */
function previewCash(s: GameState, effects: Effect[]): number | undefined {
  let cash = 0;
  for (const e of effects) {
    if (e.t === 'cash') cash += e.amount;
    // 病気は、医療保険に入っていなければ治療費がかかる。災害は、火災・地震保険に入っていなければ損害がかかる
    if (e.t === 'sickness' && s.player.medicalPremium === null) cash -= SICKNESS.cost;
    if (e.t === 'disaster' && !s.player.home?.fireInsured) cash -= e.amount;
  }
  return cash || undefined;
}

export function getOptions(s: GameState): DecisionOption[] {
  const d = s.decision;
  if (!d) return [];
  switch (d.kind) {
    case 'notice':
      return [{ id: 'ok', key: 'option.ok', enabled: true }];
    case 'marriage':
    case 'birth':
      return [{ id: 'spin', key: 'option.spin', enabled: true }];
    case 'event': {
      const ev = EVENTS_BY_ID[d.eventId!];
      if (ev.choice === 'jobChange') {
        return [
          ...jobChangeTargets(s).map((j) => ({
            id: `job:${j}`,
            key: 'option.job',
            params: { job: j, salary: Math.round(salaryAtYear(j, s.year) * s.market.wageIndex) },
            enabled: true,
          })),
          { id: 'skip', key: 'option.skip', enabled: true },
        ];
      }
      if (ev.choice === 'sideBusiness') {
        return [
          { id: 'try', key: 'option.sideBusinessTry', params: { cost: SIDE_BUSINESS.cost }, enabled: canAfford(s, SIDE_BUSINESS.cost), cash: -SIDE_BUSINESS.cost },
          { id: 'skip', key: 'option.skip', enabled: true },
        ];
      }
      const cash = previewCash(s, ev.effects ?? []);
      return [{ id: 'ok', key: 'option.ok', enabled: true, ...(cash !== undefined ? { cash } : {}) }];
    }
    case 'gamble': {
      if (!d.gambleId) {
        return [
          // 一番小さい金額も賭けられないときは、種類も選べない（選んでも賭けられないため）
          ...GAMBLE_IDS.map((g) => ({ id: `game:${g}`, key: `option.gamble.${g}`, enabled: canAfford(s, Math.min(...GAMBLE_BETS)) })),
          { id: 'skip', key: 'option.skip', enabled: true },
        ];
      }
      return [
        ...GAMBLE_BETS.map((bet) => ({ id: `${d.gambleId}:${bet}`, key: 'option.gamble.bet', params: { bet }, enabled: canAfford(s, bet), cash: -bet })),
        { id: 'back', key: 'option.back', enabled: true },
      ];
    }
    case 'realEstate': {
      const price = d.offerPrice!;
      const loanCash = price * (REAL_ESTATE.downPaymentRate + REAL_ESTATE.buyCostRate);
      const fullCash = price * (1 + REAL_ESTATE.buyCostRate);
      const borrow = price * (1 - REAL_ESTATE.downPaymentRate);
      const payment = loanPayment(borrow, REAL_ESTATE.loan.rate, REAL_ESTATE.loan.years * MONTHS_PER_YEAR);
      return [
        {
          id: 'homeLoan',
          key: 'option.realEstate.homeLoan',
          params: { amount: Math.round(loanCash), payment: Math.round(payment), years: REAL_ESTATE.loan.years },
          enabled: canAfford(s, loanCash),
          cash: -loanCash,
        },
        { id: 'homeCash', key: 'option.realEstate.homeCash', params: { amount: Math.round(fullCash) }, enabled: canAfford(s, fullCash), cash: -fullCash },
        { id: 'skip', key: 'option.skip', enabled: true },
      ];
    }
    case 'talk':
      return [
        ...TALK_AMOUNTS.map((amount) => ({
          id: `join:${amount}`,
          key: `option.talk.${d.talkId}`,
          params: { amount },
          enabled: canAfford(s, amount),
          cash: -amount,
        })),
        { id: 'skip', key: 'option.talk.decline', enabled: true },
      ];
    case 'discard':
      return s.player.hand.map((card, i) => ({
        id: `discard:${i}`,
        key: i === s.player.hand.length - 1 ? 'option.discardNew' : 'option.discard',
        params: { card },
        enabled: true,
      }));
    case 'stock':
      return [
        ...STOCK_SQUARE.shares.map((shares) => {
          const amount = shares * stockSquarePrice(s, d.assetId!);
          return {
            id: `buy:${shares}`,
            key: 'option.stock.buy',
            params: { shares, amount: Math.round(amount) },
            enabled: canAfford(s, amount),
            cash: -amount,
          };
        }),
        { id: 'skip', key: 'option.skip', enabled: true },
      ];
    case 'athleteRetire':
      return ATHLETE_NEXT_JOBS.map((j) => ({
        id: `job:${j}`,
        key: 'option.jobChange',
        params: { job: j, salary: Math.round(JOBS[j].startSalary * s.market.wageIndex) },
        enabled: true,
      }));
  }
}

/** 株のマスで買える値段（1株、割引のあと） */
export const stockSquarePrice = (s: GameState, id: AssetId) => s.market.prices[id] * (1 - STOCK_SQUARE.discount);

/** 1年のターン数 */
export const turnsPerYear = (s: GameState) => MONTHS_PER_YEAR / s.monthsPerTurn;

/** 医療保険の保険料（年）。入る年が遅いほど高い */
export function medicalPremiumAt(year: number): number {
  return INSURANCE.medicalBasePremium + INSURANCE.medicalPremiumPerYear * (year - 1);
}

// ---------------------------------------------------------------- 決定

export function choose(state: GameState, optionId: string): GameState {
  assertPhase(state, 'decision');
  const option = getOptions(state).find((o) => o.id === optionId);
  if (!option) throw new Error(`unknown option: ${optionId}`);
  if (!option.enabled) throw new Error(`option not available: ${optionId}`);
  const s = clone(state);
  const followUp = applyDecision(s, s.decision!, optionId);
  if (followUp) {
    // ルーレットの結果を、同じ流れの中でお知らせとして見せる
    s.decision = followUp;
    return s;
  }
  const from = s.decisionFrom;
  s.decision = null;
  s.decisionFrom = null;
  if (from === 'queue') nextFromQueue(s);
  else endMonth(s);
  return s;
}

/** 決定を反映する。ルーレットの結果を見せるときは、次に出すお知らせを返す */
function applyDecision(s: GameState, d: Decision, optionId: string): Decision | null {
  const p = s.player;
  switch (d.kind) {
    case 'notice':
      return null;
    case 'marriage': {
      const face = rollDie(s);
      if (!MARRIAGE.faces.includes(face)) {
        log(s, 'marriage.no', { params: { face } });
        return { kind: 'notice', messageKey: 'marriage.no', params: { face }, fromSquare: true };
      }
      const workFace = rollDie(s);
      const work: SpouseWork = faceResult(SPOUSE_WORK_FACES, workFace);
      p.married = true;
      p.spouse = { work, income: work === 'full' ? SPOUSE.fullStartIncome * s.market.wageIndex : 0, halfThisYear: false };
      log(s, 'marriage.marry', { notice: true });
      addCash(s, -MARRIAGE.cost, 'marriage.cost');
      return { kind: 'notice', messageKey: `marriage.yes.${work}`, params: { face, workFace, cost: MARRIAGE.cost }, fromSquare: true };
    }
    case 'birth': {
      const face = rollDie(s);
      if (!BIRTH.faces.includes(face)) return { kind: 'notice', messageKey: 'birth.no', params: { face }, fromSquare: true };
      p.children.push({ age: 0, highSchool: null, university: null, independent: false });
      if (p.spouse?.work === 'full') p.spouse.halfThisYear = true;
      log(s, 'birth.born', { notice: true });
      addCash(s, -BIRTH.cost, 'birth.cost');
      return { kind: 'notice', messageKey: p.spouse?.work === 'full' ? 'birth.yes.leave' : 'birth.yes', params: { face, cost: BIRTH.cost }, fromSquare: true };
    }
    case 'event': {
      const ev = EVENTS_BY_ID[d.eventId!];
      if (optionId === 'skip') {
        log(s, `event.${ev.id}.skip`);
      } else if (ev.choice === 'jobChange') {
        changeJob(s, optionId.slice(4), false);
      } else if (ev.choice === 'sideBusiness') {
        p.sideBusinessTried = true;
        addCash(s, -SIDE_BUSINESS.cost, 'event.sideBusiness.cost');
        if (nextRandom(s) < SIDE_BUSINESS.successChance) {
          p.sideBusinessIncome = SIDE_BUSINESS.income * s.market.wageIndex;
          log(s, 'event.sideBusiness.success', { notice: true });
        } else {
          log(s, 'event.sideBusiness.fail', { notice: true });
        }
      } else {
        for (const e of ev.effects ?? []) applyEffect(s, e, `event.${ev.id}`);
      }
      return null;
    }
    case 'gamble':
      if (optionId.startsWith('game:')) return { kind: 'gamble', gambleId: optionId.slice(5) };
      if (optionId === 'back') return { kind: 'gamble' };
      if (optionId !== 'skip') gamble(s, optionId);
      return null;
    case 'realEstate':
      if (optionId !== 'skip') buyHome(s, d.offerPrice!, optionId === 'homeLoan');
      return null;
    case 'talk': {
      const id = d.talkId!;
      if (optionId === 'skip') {
        log(s, `talk.${id}.decline`);
        return null;
      }
      const amount = Number(optionId.slice(5));
      addCash(s, -amount, `talk.${id}.join`, { amount });
      p.talks.push({ id, amount });
      s.stats.talkSpent += amount;
      return null;
    }
    case 'discard': {
      const [card] = p.hand.splice(Number(optionId.slice(8)), 1);
      log(s, 'card.discard', { params: { card } });
      return null;
    }
    case 'stock':
      if (optionId === 'skip') log(s, 'stock.skip', { params: { asset: d.assetId! } });
      else {
        const id = d.assetId!;
        const shares = Number(optionId.slice(4));
        const spent = buyShares(s, id, shares, stockSquarePrice(s, id));
        log(s, 'stock.buy', { params: { asset: id, shares, amount: Math.round(spent) }, notice: true });
      }
      return null;
    case 'athleteRetire':
      changeJob(s, optionId.slice(4), true);
      return null;
  }
}

function changeJob(s: GameState, jobId: JobId, fromStart: boolean) {
  const p = s.player;
  p.jobId = jobId;
  p.salary = (fromStart ? JOBS[jobId].startSalary : salaryAtYear(jobId, s.year)) * s.market.wageIndex;
  // 引退のあとの職業は、引退の記録にする
  log(s, fromStart && p.athleteRetireYear !== null ? 'job.retire' : 'job.change', { params: { job: jobId }, notice: true });
  p.athleteRetireYear = null;
}

function applyEffect(s: GameState, e: Effect, key: string) {
  const p = s.player;
  switch (e.t) {
    case 'cash':
      addCash(s, e.amount, key);
      return;
    case 'salaryRate':
      p.salary *= 1 + e.rate;
      log(s, `${key}.salary`, { params: { rate: Math.round(e.rate * 100) } });
      return;
    case 'noIncome':
      p.noIncomeMonths = Math.max(p.noIncomeMonths, e.months);
      log(s, `${key}.noIncome`, { params: { months: e.months }, notice: true });
      return;
    case 'spousePart':
      if (p.spouse) {
        p.spouse.work = 'part';
        p.spouse.income = SPOUSE_PART_INCOME * s.market.wageIndex;
      }
      log(s, key, { notice: true });
      return;
    case 'sickness': {
      // ポップアップで先に決めた重さを使う。決めていなければ（小さな出来事など）、ここで決める
      const decided = s.decision?.kind === 'event' ? s.decision.params?.heavy : undefined;
      const heavy = decided !== undefined ? decided === 1 : nextRandom(s) < SICKNESS.heavyChance;
      if (heavy) p.noIncomeMonths = Math.max(p.noIncomeMonths, SICKNESS.heavyMonths);
      if (p.medicalPremium !== null) {
        s.stats.insurancePaid += SICKNESS.cost;
        log(s, `${key}.covered`, { params: { cost: SICKNESS.cost }, notice: true });
      } else {
        addCash(s, -SICKNESS.cost, heavy ? `${key}.heavy` : key);
      }
      return;
    }
    case 'disaster':
      if (p.home?.fireInsured) {
        s.stats.insurancePaid += e.amount;
        log(s, `${key}.covered`, { params: { cost: e.amount }, notice: true });
      } else {
        addCash(s, -e.amount, key);
      }
      return;
  }
}

function gamble(s: GameState, optionId: string) {
  const [id, betText] = optionId.split(':') as [GambleId, string];
  const bet = Number(betText);
  let r = nextRandom(s);
  let multiplier = 0;
  for (const o of GAMBLES[id].outcomes) {
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
}

function buyHome(s: GameState, price: number, withLoan: boolean) {
  const fairValue = REAL_ESTATE.basePrice * s.market.realEstateIndex;
  const down = withLoan ? price * REAL_ESTATE.downPaymentRate : price;
  addCash(s, -(down + price * REAL_ESTATE.buyCostRate), 'realEstate.buy');
  s.player.home = {
    value: fairValue,
    loan: withLoan ? createLoan(price - down, REAL_ESTATE.loan.rate, REAL_ESTATE.loan.years) : null,
    // 住宅ローンで買うと、火災・地震保険に自動で入る（design.md 4.4）
    fireInsured: withLoan,
  };
}

// ---------------------------------------------------------------- 月末

function livingCost(s: GameState): number {
  const p = s.player;
  const kids = p.children.filter((c) => !c.independent).length;
  let base = (p.married ? LIVING_COST.couple : LIVING_COST.single) + kids * LIVING_COST.perChild;
  if (p.home) base -= LIVING_COST.homeOwnerDiscount;
  return base * JOBS[p.jobId].livingRate * s.market.livingIndex;
}

/** 教育費（年） */
function educationCost(s: GameState): number {
  const p = s.player;
  const daycare = p.spouse?.work === 'full';
  let total = 0;
  for (const c of p.children) {
    if (c.independent) continue;
    if (c.age <= 5) total += daycare ? EDUCATION_COST.daycare : 0;
    else if (c.age <= 11) total += EDUCATION_COST.elementary;
    else if (c.age <= 14) total += EDUCATION_COST.juniorHigh;
    else if (c.age <= 17) total += EDUCATION_COST.highSchool[c.highSchool ?? 'public'];
    else if (c.university === 'national' || c.university === 'private') total += EDUCATION_COST.university[c.university];
  }
  return total;
}

/**
 * 1ターン分の収入と支出を計算する。dryRun なら状態を変えずに予定だけを返す（画面の「今月の家計」に使う）。
 * 金額のデータは1年分なので、1年のターン数で割る。
 */
function computeMonth(s: GameState, dryRun: boolean) {
  const p = s.player;
  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};
  const m = turnsPerYear(s);

  income.salary = employed(s) ? p.salary / m : 0;
  income.spouse = p.spouse ? (p.spouse.income * (p.spouse.halfThisYear ? 0.5 : 1)) / m : 0;
  income.sideBusiness = p.sideBusinessIncome / m;

  expense.jobCost = JOBS[p.jobId].fixedCost / m;
  expense.living = livingCost(s) / m;
  expense.education = educationCost(s) / m;
  let loanInterest = 0;
  const loan = p.home?.loan;
  if (loan) {
    if (dryRun) expense.loan = Math.min(loan.payment * s.monthsPerTurn, loan.balance * (1 + loan.rate / 12));
    else {
      // 住宅ローンは毎月返すので、1ターンの月数だけ返す
      expense.loan = 0;
      for (let i = 0; i < s.monthsPerTurn; i++) {
        const r = payLoanMonth(loan);
        loanInterest += r.interest;
        expense.loan += r.paid;
      }
      if (loan.balance === 0) p.home!.loan = null;
    }
  } else expense.loan = 0;
  expense.insurance = ((p.medicalPremium ?? 0) + (p.home?.fireInsured ? INSURANCE.firePremium : 0)) / m;
  return { income, expense, loanInterest };
}

const sum = (items: Record<string, number>) => Object.values(items).reduce((a, b) => a + b, 0);

/** 今月の収入と支出の予定。saving は、そのほかに積み立てで買う金額 */
export function estimateMonth(s: GameState): {
  income: Record<string, number>;
  expense: Record<string, number>;
  net: number;
  saving: number;
} {
  const { income, expense } = computeMonth(s, true);
  return { income, expense, net: sum(income) - sum(expense), saving: sum(s.player.saving) * s.monthsPerTurn };
}

/** 積み立て。預金が足りない月や、借金がある月は、自動で休む（借金はしない。design.md 6.3） */
function accumulate(s: GameState): number {
  const p = s.player;
  // 積み立ての金額は「毎月○万円」なので、1ターンの月数分をまとめて買う
  const total = sum(p.saving) * s.monthsPerTurn;
  if (total <= 0) return 0;
  if (p.cash < total || p.cardLoan > 0) {
    if (!p.savingPaused) log(s, 'saving.pause', { notice: true });
    p.savingPaused = true;
    return 0;
  }
  for (const id of ASSET_IDS) if (p.saving[id] > 0) buyAsset(s, id, p.saving[id] * s.monthsPerTurn);
  s.stats.savingTotal += total;
  if (p.savingPaused) log(s, 'saving.resume', { notice: true });
  p.savingPaused = false;
  return total;
}

function addFlows(target: Record<string, number>, items: Record<string, number>) {
  for (const [k, v] of Object.entries(items)) target[k] = (target[k] ?? 0) + v;
}

/** 月末: 給料が入り、生活費などが出ていく。値段が少し動く。12月なら年末へ */
function endMonth(s: GameState) {
  const p = s.player;
  const { income, expense, loanInterest } = computeMonth(s, false);
  const flows = s.yearFlows;
  addFlows(flows.income, income);
  addFlows(flows.expense, expense);
  flows.loanPrincipal += expense.loan - loanInterest;
  s.stats.premiumsPaid += expense.insurance;
  p.cash += sum(income) - sum(expense);
  p.noIncomeMonths = Math.max(0, p.noIncomeMonths - s.monthsPerTurn);

  // お金が余ったら、まずカードローンの返済に回す（design.md 8章）
  let repaid = 0;
  if (p.cash > 0 && p.cardLoan > 0) {
    repaid = Math.min(p.cash, p.cardLoan);
    p.cardLoan -= repaid;
    p.cash -= repaid;
  }
  const saved = accumulate(s);
  flows.saved += saved;
  flows.repaid += repaid;
  s.lastMonth = { year: s.year, month: s.month, income, expense, saved, repaid };
  coverShortfall(s);
  flows.revaluation += updateMarketMonth(s);
  // ニュースは、1年のどの月でもランダムに起きる（design.md 7章）
  const newsMoved = maybeNews(s);
  if (s.newsEvent) log(s, 'news.happened', { params: { news: s.newsEvent.id }, notice: true });
  flows.revaluation += newsMoved;
  flows.revaluation += maybeBigEvent(s);
  coverShortfall(s);

  s.cardUsed = false;
  if (s.month + s.monthsPerTurn > MONTHS_PER_YEAR) {
    endYear(s);
    recordPrices(s, s.month);
    return;
  }
  recordPrices(s, s.month);
  s.month += s.monthsPerTurn;
  s.phase = 'roll';
}

function recordPrices(s: GameState, month: number) {
  s.prices.push({
    year: s.year,
    month,
    prices: { ...s.market.prices },
    livingIndex: s.market.livingIndex,
    realEstateIndex: s.market.realEstateIndex,
    economy: s.market.economy,
  });
}

/** お金が足りないときは、先に資産を売り、それでも足りない分だけカードローンで借りる（利息なし） */
function coverShortfall(s: GameState) {
  const p = s.player;
  if (p.cash >= 0) return;
  let sold = 0;
  for (const id of sellOrder(s)) {
    if (p.cash >= 0) break;
    sold += sellAsset(s, id, -p.cash);
  }
  if (Math.round(sold) > 0) log(s, 'shortfall.sell', { params: { amount: Math.round(sold) }, notice: true });
  if (p.cash < 0) {
    const borrowed = -p.cash;
    p.cardLoan += borrowed;
    p.cash = 0;
    s.yearFlows.borrowed += borrowed;
    if (Math.round(borrowed) > 0) log(s, 'shortfall.loan', { params: { amount: Math.round(borrowed) }, notice: true });
  }
  s.yearFlows.sold += sold;
}

// ---------------------------------------------------------------- 大きなイベント（design.md 5.3）

/**
 * 月末に、大きなイベントが起きるか決める。起きたら反映して、画面に見せるための結果を s.bigEvent に入れる。
 * 1ヶ月に起きるのは1つまで。値動きで動いた自分の資産の金額を返す
 */
export function maybeBigEvent(s: GameState): number {
  for (const ev of BIG_EVENTS) {
    if (nextRandom(s) < turnChance(ev, s.monthsPerTurn)) return applyBigEvent(s, ev.id);
  }
  return 0;
}

/** 大きなイベントを起こす。値動きで動いた自分の資産の金額を返す */
function applyBigEvent(s: GameState, id: string): number {
  const ev = BIG_EVENTS_BY_ID[id];
  const p = s.player;
  const result = { id, rates: {} as Record<AssetId, number>, moved: 0, cash: 0, covered: 0 };
  const pay = (amount: number, key: string) => {
    if (Math.round(amount * 10) === 0) return;
    addCash(s, amount, key);
    result.cash += amount;
  };
  for (const ef of ev.effects) {
    switch (ef.t) {
      case 'market':
        for (const asset of ef.assets) {
          const rate = ef.min + nextRandom(s) * (ef.max - ef.min);
          result.rates[asset] = rate;
          result.moved += shockPrice(s, asset, rate);
        }
        break;
      case 'living':
        s.market.livingIndex *= 1 + ef.rate;
        break;
      case 'depositLoss':
        pay(-Math.max(0, p.cash - ef.threshold) * ef.rate, `bigEvent.${id}.loss`);
        break;
      case 'cash':
        pay(ef.amount, `bigEvent.${id}.cash`);
        break;
      case 'homeDamage':
        if (!p.home) break;
        if (p.home.fireInsured) {
          s.stats.insurancePaid += ef.amount;
          result.covered += ef.amount;
        } else pay(-ef.amount, `bigEvent.${id}.home`);
        break;
    }
  }
  log(s, `bigEvent.${id}`, { notice: true });
  s.bigEvent = result;
  return result.moved;
}

/** 大きなイベントを、今すぐ起こす（テスト用） */
export function triggerBigEvent(state: GameState, id: string): GameState {
  if (!BIG_EVENTS_BY_ID[id]) throw new Error(`unknown big event: ${id}`);
  const s = clone(state);
  const moved = applyBigEvent(s, id);
  s.yearFlows.revaluation += moved;
  coverShortfall(s);
  return s;
}

/** ニュースの画面を閉じる */
export function dismissNews(state: GameState): GameState {
  const s = clone(state);
  s.newsEvent = null;
  return s;
}

/** 大きなイベントの画面を閉じる */
export function dismissBigEvent(state: GameState): GameState {
  const s = clone(state);
  s.bigEvent = null;
  return s;
}

// ---------------------------------------------------------------- 年末

/** 乗った投資の話の結果を決める（design.md 6.4）。戻ったお金は預金に、借金になった分はカードローンに入る */
function resolveTalks(s: GameState) {
  const p = s.player;
  for (const talk of p.talks) {
    const def = INVEST_TALKS_BY_ID[talk.id];
    const outcome = pickWeighted(s, def.outcomes, (o) => o.probability)!;
    const back = talk.amount * outcome.multiplier;
    s.stats.talkReturned += back;
    s.yearFlows.talks.push({ id: talk.id, amount: talk.amount, back });
    const params = { amount: talk.amount, back: Math.abs(back) };
    if (back > talk.amount) {
      addCash(s, back, `talk.${talk.id}.win`, params);
    } else if (back > 0) {
      addCash(s, back, `talk.${talk.id}.lose`, params);
    } else if (back === 0) {
      log(s, `talk.${talk.id}.lose`, { params, notice: true });
    } else {
      p.cardLoan += -back;
      log(s, `talk.${talk.id}.debt`, { params, notice: true });
    }
  }
  p.talks = [];
}

/** 年末: 投資の話の結果が出て、利息と配当が入り、ニュースで相場が大きく動き、決算をまとめる */
function endYear(s: GameState) {
  const p = s.player;
  resolveTalks(s);
  const flows = s.yearFlows;
  const yearly: Record<string, number> = {
    interest: Math.max(0, p.cash) * s.market.depositRate,
    bond: 0,
    dividend: 0,
  };
  for (const id of ASSET_IDS) {
    const a = ASSETS[id];
    const v = assetValue(s, id) * a.incomeYield;
    if (a.kind === 'bond') yearly.bond += v;
    else if (a.kind === 'stock') yearly.dividend += v;
  }
  addFlows(flows.income, yearly);
  p.cash += sum(yearly);
  s.stats.investmentIncome += sum(yearly);

  flows.revaluation += updateMarketYear(s);
  flows.net = sum(flows.income) - sum(flows.expense);
  s.lastSettlement = structuredClone(flows);

  const worth = netWorth(s);
  const prev = s.history.length ? s.history[s.history.length - 1].netWorth : START_CASH;
  const investment = sum(yearly);
  const work = sum(flows.income) - investment - (sum(flows.expense) - flows.loanPrincipal);
  s.history.push({
    year: s.year,
    netWorth: worth,
    cash: p.cash,
    assets: { ...Object.fromEntries(ASSET_IDS.map((id) => [id, assetValue(s, id)])), realEstate: realEstateValue(s) },
    debt: totalDebt(s),
    economy: s.market.economy,
    newsIds: [...s.yearMarket.newsIds],
    breakdown: { work, investment, revaluation: flows.revaluation, other: worth - prev - work - investment - flows.revaluation },
    incomeTotal: sum(flows.income),
    expenseTotal: sum(flows.expense),
    market: {
      prices: { ...s.market.prices },
      realEstateIndex: s.market.realEstateIndex,
      livingIndex: s.market.livingIndex,
      depositRate: s.market.depositRate,
    },
  });
  s.phase = 'yearEnd';
}

/** 年末のニュースと決算を見たあと、次の年へ。最後の年なら終了 */
export function nextYear(state: GameState): GameState {
  assertPhase(state, 'yearEnd');
  if (state.bigEvent) throw new Error('big event is showing');
  if (state.newsEvent) throw new Error('news is showing');
  const s = clone(state);
  if (s.year >= s.years) {
    s.result = computeResult(s);
    s.phase = 'finished';
    return s;
  }
  const p = s.player;
  s.year += 1;
  s.month = 1;
  s.yearFlows = emptyFlows(s.year);
  s.yearMarket = newYearMarket(s);
  growSalary(s);
  if (p.spouse) {
    p.spouse.halfThisYear = false;
    if (p.spouse.work !== 'none') p.spouse.income *= 1 + BASE_INFLATION;
    if (p.spouse.work === 'full') p.spouse.income *= 1 + SPOUSE.fullGrowth;
  }
  p.children.forEach((c) => ageChild(s, c));
  // 年末に、カードを1枚もらう（design.md 3.9）
  gainCard(s, false);
  if (p.hand.length > HAND_MAX) s.queue.push({ kind: 'discard' });
  if (p.jobId === 'athlete' && p.athleteRetireYear !== null && s.year >= p.athleteRetireYear) {
    s.queue.push({ kind: 'athleteRetire' });
  }
  nextFromQueue(s);
  return s;
}

function nextFromQueue(s: GameState) {
  const d = s.queue.shift();
  if (d) startDecision(s, d, 'queue');
  else {
    s.decision = null;
    s.decisionFrom = null;
    s.phase = 'roll';
  }
}

function growSalary(s: GameState) {
  const p = s.player;
  const job = JOBS[p.jobId];
  // 物価に合わせて上がる分（design.md 7章）。昇給はこの上に乗る
  p.salary *= 1 + BASE_INFLATION;
  p.sideBusinessIncome *= 1 + BASE_INFLATION;
  if (job.volatility > 0) {
    const r = job.growth + job.volatility * (nextRandom(s) * 2 - 1);
    p.salary *= 1 + r;
    if (job.hitChance > 0 && nextRandom(s) < job.hitChance) {
      p.salary *= job.hitMultiplier;
      log(s, 'auto.hit', { notice: true });
    }
    p.salary = Math.min(job.maxSalary, Math.max(job.minSalary, p.salary));
  } else {
    p.salary *= 1 + job.growth;
  }
}

/** 子どもが1つ年を取る。進学はルーレットで決まり、お知らせで見せる（design.md 5.2） */
function ageChild(s: GameState, c: Child) {
  if (c.independent) return;
  c.age += 1;
  if (c.age === 6) log(s, 'school.elementary', { notice: true });
  if (c.age === 12) log(s, 'school.juniorHigh', { notice: true });
  if (c.age === 15) {
    const face = rollDie(s);
    c.highSchool = faceResult(HIGH_SCHOOL_FACES, face);
    log(s, `school.highSchool.${c.highSchool}`);
    s.queue.push({ kind: 'notice', messageKey: `school.highSchool.${c.highSchool}`, params: { face } });
  }
  if (c.age === 18) {
    const face = rollDie(s);
    c.university = faceResult(UNIVERSITY_FACES, face);
    log(s, `school.university.${c.university}`);
    s.queue.push({ kind: 'notice', messageKey: `school.university.${c.university}`, params: { face } });
  }
  const independentAge = c.university === 'none' ? CHILD_INDEPENDENT_AGE_NO_UNIVERSITY : CHILD_INDEPENDENT_AGE;
  if (c.age >= independentAge && c.university !== null) {
    c.independent = true;
    log(s, 'auto.childIndependent', { notice: true });
  }
}

// ---------------------------------------------------------------- 取引タイム（design.md 2.1）

/** 取引タイムを開けるか。年末と、取引カードを使ったとき（design.md 2.1、3.9） */
export function canTrade(s: GameState): boolean {
  return s.phase === 'yearEnd' || (s.phase === 'roll' && s.tradeOpen);
}

function assertCanTrade(s: GameState) {
  if (!canTrade(s)) throw new Error(`cannot trade in phase ${s.phase}`);
}

/** 株を shares 株買う（shares > 0）か売る（shares < 0）。株は1株単位（design.md 6.1） */
export function tradeShares(state: GameState, id: AssetId, shares: number): GameState {
  assertCanTrade(state);
  if (ASSETS[id]?.unit !== 'share') throw new Error(`not a share asset: ${id}`);
  const s = clone(state);
  if (shares > 0) {
    const spent = buyShares(s, id, shares);
    if (spent > 0) log(s, 'trade.buyShares', { params: { asset: id, shares: Math.round(spent / s.market.prices[id]), amount: Math.round(spent) } });
  } else if (shares < 0) {
    const gained = sellShares(s, id, -shares);
    if (gained > 0) log(s, 'trade.sellShares', { params: { asset: id, shares: Math.round(gained / s.market.prices[id]), amount: Math.round(gained) } });
  }
  return s;
}

/** 金額分を買う（amount > 0）か売る（amount < 0）。投資信託・ゴールド・国債（1万円単位） */
export function trade(state: GameState, id: AssetId, amount: number): GameState {
  assertCanTrade(state);
  if (!ASSETS[id]) throw new Error(`unknown asset: ${id}`);
  if (ASSETS[id].unit === 'share') throw new Error(`use tradeShares for ${id}`);
  const s = clone(state);
  if (amount > 0) {
    const spent = buyAsset(s, id, amount);
    if (spent > 0) log(s, 'trade.buy', { params: { asset: id, amount: Math.round(spent) } });
  } else if (amount < 0) {
    const gained = sellAsset(s, id, -amount);
    if (gained > 0) log(s, 'trade.sell', { params: { asset: id, amount: Math.round(gained) } });
  }
  return s;
}

export function joinMedical(state: GameState): GameState {
  assertCanTrade(state);
  if (state.player.medicalPremium !== null) throw new Error('already insured');
  const s = clone(state);
  s.player.medicalPremium = medicalPremiumAt(s.year);
  log(s, 'insurance.medical.join', { params: { premium: s.player.medicalPremium } });
  return s;
}

export function quitMedical(state: GameState): GameState {
  assertCanTrade(state);
  const s = clone(state);
  s.player.medicalPremium = null;
  log(s, 'insurance.medical.quit');
  return s;
}

/** 火災・地震保険をやめられるか。住宅ローンが残っている間はやめられない（現実の住宅ローンと同じ） */
export const canQuitFire = (s: GameState) => !!s.player.home?.fireInsured && !s.player.home.loan;

/** 持ち家の火災・地震保険に入る（on）、やめる（off） */
export function setFireInsurance(state: GameState, on: boolean): GameState {
  assertCanTrade(state);
  if (!state.player.home || (!on && !canQuitFire(state))) throw new Error('cannot change fire insurance');
  const s = clone(state);
  s.player.home!.fireInsured = on;
  log(s, on ? 'insurance.fire.join' : 'insurance.fire.quit');
  return s;
}

/** 住宅ローンの繰り上げ返済 */
export function prepay(state: GameState, amount: number): GameState {
  assertCanTrade(state);
  if (!state.player.home?.loan) throw new Error('no loan');
  const s = clone(state);
  const home = s.player.home!;
  const paid = prepayLoan(home.loan!, Math.max(0, Math.min(amount, s.player.cash)));
  s.player.cash -= paid;
  if (home.loan!.balance === 0) home.loan = null;
  log(s, 'loan.prepay', { cash: -paid });
  return s;
}

/** 家を売って手に入るお金（相場の値段 − 手数料 − 残りの住宅ローン） */
export function homeSaleProceeds(s: GameState): number {
  const home = s.player.home;
  if (!home) return 0;
  return home.value * (1 - REAL_ESTATE.sellFeeRate) - (home.loan?.balance ?? 0);
}

/** 家を売れるか（ローンを返して、預金がマイナスにならないか） */
export const canSellHome = (s: GameState) => !!s.player.home && s.player.cash + homeSaleProceeds(s) >= 0;

export function sellHome(state: GameState): GameState {
  assertCanTrade(state);
  if (!canSellHome(state)) throw new Error('cannot sell home');
  const s = clone(state);
  addCash(s, homeSaleProceeds(s), 'realEstate.sell');
  s.player.home = null;
  return s;
}

// ---------------------------------------------------------------- そのほか

function assertPhase(s: GameState, phase: GameState['phase']) {
  if (s.phase !== phase) throw new Error(`expected phase ${phase}, got ${s.phase}`);
}

export { financialAssets, netWorth };
