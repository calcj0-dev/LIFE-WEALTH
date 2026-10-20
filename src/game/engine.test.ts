import { describe, expect, it } from 'vitest';
import { NO_INVEST_POLICY, POLICY_PRESETS, sharesOf } from '../data/assets';
import { BOARD, MARRIAGE_STOP_INDEX, SQUARE_COUNTS } from '../data/board';
import { GAMBLES, GAMBLE_IDS } from '../data/gamble';
import { JOB_IDS } from '../data/jobs';
import { END_AGE, START_AGE } from '../data/rules';
import { playGame } from './autoplay';
import { choose, chooseJob, continueYear, createGame, getOptions, nextYear, roll, setPolicy, trade, changePolicy } from './engine';
import { assetValue, createLoan, financialAssets, netWorth, payLoanYear } from './finance';
import { securityPoints } from './score';
import type { GameState } from './types';

function started(seed = 1): GameState {
  return setPolicy(chooseJob(createGame(seed), 'employee'), POLICY_PRESETS.balanced);
}

describe('盤面', () => {
  it('72マスで、種類ごとの数が設計どおり', () => {
    expect(BOARD).toHaveLength(72);
    for (const [type, n] of Object.entries(SQUARE_COUNTS)) {
      expect(BOARD.filter((sq) => sq.type === type)).toHaveLength(n);
    }
  });
  it('スタートは0番、結婚ストップは18番', () => {
    expect(BOARD[0].type).toBe('start');
    expect(BOARD[MARRIAGE_STOP_INDEX].type).toBe('stopMarriage');
  });
  it('1周つながっている', () => {
    let pos = 0;
    for (let i = 0; i < 72; i++) pos = BOARD[pos].next[0];
    expect(pos).toBe(0);
  });
});

describe('ギャンブル', () => {
  it('結果の平均が還元率と一致する', () => {
    for (const id of GAMBLE_IDS) {
      const def = GAMBLES[id];
      const ev = def.outcomes.reduce((sum, o) => sum + o.multiplier * o.probability, 0);
      expect(ev).toBeCloseTo(def.returnRate, 6);
      expect(def.outcomes.reduce((sum, o) => sum + o.probability, 0)).toBeLessThanOrEqual(1);
    }
  });
});

describe('お金の計算', () => {
  it('ローンは期間の終わりに残高0になる', () => {
    const loan = createLoan(1800, 0.01, 35);
    let paid = 0;
    for (let i = 0; i < 35; i++) paid += payLoanYear(loan).paid;
    expect(loan.balance).toBe(0);
    expect(paid).toBeGreaterThan(1800);
  });
  it('老後の安心ポイント: 1,000万円で約52、1億円で約100、マイナスは対称', () => {
    expect(securityPoints(1000)).toBeCloseTo(52.1, 1);
    expect(securityPoints(10000)).toBeCloseTo(100.2, 1);
    expect(securityPoints(-1000)).toBeCloseTo(-52.1, 1);
    expect(securityPoints(0)).toBe(0);
  });
  it('同じ年に買ってすぐ売ると、金額は元に戻る', () => {
    const s0 = started();
    const before = s0.player.cash;
    const fundBefore = s0.player.holdings.fund;
    const s1 = trade(trade(s0, 'fund', 10), 'fund', -10);
    expect(s1.player.cash).toBeCloseTo(before, 6);
    expect(s1.player.holdings.fund).toBeCloseTo(fundBefore, 6);
  });
  it('預金より多くは買えない', () => {
    const s = trade(started(), 'gold', 10000);
    expect(s.player.cash).toBeGreaterThanOrEqual(0);
  });
});

describe('投資方針', () => {
  it('方針を変えると、今のお金と資産がその割合になるように売り買いする', () => {
    let s = continueYear(started(9));
    s = { ...s, player: { ...s.player, cash: 1000, holdings: { bond: 0, gold: 0, fund: 0, stock: 0 } } };
    const total = s.player.cash;
    const r = changePolicy(s, POLICY_PRESETS.aggressive);
    const shares = sharesOf(POLICY_PRESETS.aggressive);
    expect(assetValue(r, 'fund')).toBeCloseTo((total * shares.fund) / 100, 0);
    expect(r.player.cash).toBeGreaterThan((total * shares.deposit) / 100 - 1);
    const back = changePolicy(r, NO_INVEST_POLICY);
    expect(financialAssets(back)).toBeCloseTo(0, 6);
    expect(back.player.cash).toBeCloseTo(netWorth(r), 6);
  });
  it('型の割合は、銀行預金を含めて合計100%', () => {
    for (const p of [...Object.values(POLICY_PRESETS), NO_INVEST_POLICY]) {
      const sh = sharesOf(p);
      expect(sh.deposit + sh.bond + sh.gold + sh.fund + sh.stock).toBe(100);
    }
  });
});

describe('借金と支払い', () => {
  it('預金が足りないときは、先に資産を売り、足りない分だけ利息なしで借りる', () => {
    let s = started();
    s = { ...s, phase: 'decision', decision: { kind: 'notice' }, decisionFrom: 'square', player: { ...s.player, cash: -2000, holdings: { bond: 40, gold: 0, fund: 0, stock: 0 } } };
    const r = choose(s, 'ok');
    expect(r.player.holdings.bond).toBe(0);
    expect(r.player.cash).toBe(0);
    expect(r.player.cardLoan).toBeGreaterThan(0);
    expect(r.lastSettlement!.sold).toBeCloseTo(40 * s.market.prices.bond, 6);
    expect(r.lastSettlement!.borrowed).toBeCloseTo(r.player.cardLoan, 6);
    expect(Object.keys(r.lastSettlement!.expense)).not.toContain('cardLoanInterest');
  });
  it('借金があっても、生活費は変わらない', () => {
    const base = started();
    const settle = (cardLoan: number) =>
      choose({ ...base, phase: 'decision', decision: { kind: 'notice' }, decisionFrom: 'square', player: { ...base.player, cardLoan } }, 'ok')
        .lastSettlement!.expense.living;
    expect(settle(100)).toBeCloseTo(settle(0), 6);
  });
  it('預金で払えない選択肢は選べない', () => {
    let s = started();
    s = { ...s, phase: 'decision', decision: { kind: 'life', eventId: 'travel' }, decisionFrom: 'square', player: { ...s.player, cash: 10 } };
    const opts = Object.fromEntries(getOptions(s).map((o) => [o.id, o.enabled]));
    expect(opts).toEqual({ travelAbroad: false, travelDomestic: false, skip: true });
  });
  it('銀行預金で払えれば選べ、預金から払われる', () => {
    let s = started();
    s = { ...s, phase: 'decision', decision: { kind: 'life', eventId: 'travel' }, decisionFrom: 'yearStart', player: { ...s.player, cash: 100 } };
    expect(getOptions(s).find((o) => o.id === 'travelAbroad')!.enabled).toBe(true);
    const r = choose(s, 'travelAbroad');
    expect(r.player.cash).toBeCloseTo(50, 6);
  });
  it('どれも払えない避けられない出来事は、払えなくても選べる', () => {
    let s = started();
    s = { ...s, phase: 'decision', decision: { kind: 'life', eventId: 'care' }, decisionFrom: 'square', player: { ...s.player, cash: 0 } };
    expect(getOptions(s).every((o) => o.enabled)).toBe(true);
  });
});

describe('ゲームの進行', () => {
  it('22歳から65歳まで44年遊ぶと終わる', () => {
    const s = playGame(7, 'employee', 'balanced');
    expect(s.phase).toBe('finished');
    expect(s.history).toHaveLength(END_AGE - START_AGE + 1);
    expect(s.history[0].age).toBe(START_AGE);
    expect(s.history.at(-1)!.age).toBe(END_AGE);
    expect(s.score).not.toBeNull();
  });
  it('純資産が増えた・減った理由の合計は、その年の純資産の増減と一致する', () => {
    const s = playGame(21, 'employee', 'aggressive');
    let prev = 50;
    for (const h of s.history) {
      const b = h.breakdown;
      expect(b.work + b.investment + b.revaluation + b.other).toBeCloseTo(h.netWorth - prev, 6);
      prev = h.netWorth;
    }
    // 出来事などは、働いた分や値上がりに比べて小さいはず（計算の取りこぼしがないことの目安）
    const others = s.history.map((h) => Math.abs(h.breakdown.other));
    expect(Math.max(...others)).toBeLessThan(2000);
  });
  it('同じシード値なら、同じ結果になる', () => {
    const a = playGame(42, 'engineer', 'aggressive');
    const b = playGame(42, 'engineer', 'aggressive');
    expect(a.score).toEqual(b.score);
    expect(a.log).toEqual(b.log);
  });
  it('どの職業・方針でも、数値がおかしくならない', () => {
    for (const job of JOB_IDS) {
      for (const policy of ['safe', 'balanced', 'aggressive'] as const) {
        for (let seed = 1; seed <= 20; seed++) {
          const s = playGame(seed, job, policy);
          expect(Number.isFinite(s.score!.total)).toBe(true);
          expect(Number.isFinite(netWorth(s))).toBe(true);
          expect(s.player.cash).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
  it('結婚ストップは、出目が残っていても必ず止まる', () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      let s = continueYear(started(seed));
      s = { ...s, player: { ...s.player, position: MARRIAGE_STOP_INDEX - 1 } };
      s = roll(s);
      expect(s.player.position).toBe(MARRIAGE_STOP_INDEX);
      expect(s.decision?.kind).toBe('marriage');
      if (s.lastRoll! > 1) found = true;
    }
    expect(found).toBe(true);
  });
  it('結婚を断ると、2周目にもう一度選べる。結婚済みなら何も起きない', () => {
    let s = continueYear(started(3));
    s = { ...s, player: { ...s.player, position: MARRIAGE_STOP_INDEX - 1 } };
    s = roll(s);
    s = choose(s, 'decline');
    expect(s.player.marriageDeclined).toBe(true);
    s = nextYear(s);
    s = continueYear(s);
    s = { ...s, player: { ...s.player, position: MARRIAGE_STOP_INDEX - 1, lap: 1, cash: 100 } };
    s = roll(s);
    expect(getOptions(s).some((o) => o.id.startsWith('marry:'))).toBe(true);
    s = choose(s, 'marry:full:small');
    expect(s.player.married).toBe(true);
    s = nextYear(s);
    s = continueYear(s);
    s = { ...s, player: { ...s.player, position: MARRIAGE_STOP_INDEX - 1, lap: 1 } };
    s = roll(s);
    expect(getOptions(s).map((o) => o.id)).toEqual(['ok']);
  });
});
