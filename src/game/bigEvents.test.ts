import { describe, expect, it } from 'vitest';
import bigEventsJson from '../data/bigEvents.json';
import { BIG_EVENTS, checkBigEvents } from '../data/bigEvents';
import { has } from '../i18n';
import { chooseJob, chooseYears, createGame, dismissBigEvent, roll, setSaving, triggerBigEvent } from './engine';
import type { GameState } from './types';

function started(cash = 50): GameState {
  const s = setSaving(chooseJob(chooseYears(createGame(1), 20), 'employee'), {});
  return { ...s, player: { ...s.player, cash } };
}

const withFund = (s: GameState, units: number): GameState => ({
  ...s,
  player: { ...s.player, holdings: { ...s.player.holdings, fund: units } },
});

const home = (fireInsured: boolean) => ({ value: 3000, loan: null, fireInsured });

describe('大きなイベント', () => {
  it('bigEvents.json にまちがいがなく、画面の文字がある', () => {
    expect(checkBigEvents(bigEventsJson)).toEqual([]);
    expect(checkBigEvents({ events: [{ id: 'x', everyYears: 0, effects: [{ t: 'market', assets: ['nope'], min: 1, max: 0 }] }] }).length).toBe(3);
    for (const e of BIG_EVENTS) {
      expect(has(`bigEvent.${e.id}.title`)).toBe(true);
      expect(has(`bigEvent.${e.id}.text`)).toBe(true);
    }
  });
  it('全部合わせて、2年に1回くらい起きる', () => {
    const perYear = BIG_EVENTS.reduce((a, e) => a + 1 / e.everyYears, 0);
    expect(perYear).toBeGreaterThan(0.4);
    expect(perYear).toBeLessThan(0.6);
  });
  it('大暴落: 株と投資信託が30〜50%下がり、ゴールドは上がる', () => {
    const before = withFund(started(), 100);
    const s = triggerBigEvent(before, 'crash');
    for (const id of ['fund', 'it', 'food', 'energy', 'bank']) {
      expect(s.bigEvent!.rates[id]).toBeGreaterThanOrEqual(-0.5);
      expect(s.bigEvent!.rates[id]).toBeLessThanOrEqual(-0.3);
    }
    expect(s.bigEvent!.rates.gold).toBeGreaterThan(0);
    expect(s.bigEvent!.moved).toBeCloseTo(100 * (s.market.prices.fund - before.market.prices.fund), 6);
    expect(s.bigEvent!.moved).toBeLessThan(-29);
  });
  it('大急騰: 株と投資信託が20〜40%上がる', () => {
    const s = triggerBigEvent(withFund(started(), 100), 'surge');
    expect(s.bigEvent!.rates.fund).toBeGreaterThanOrEqual(0.2);
    expect(s.bigEvent!.moved).toBeGreaterThan(19);
  });
  it('物価の急上昇: 生活費がずっと10%高くなる', () => {
    const before = started();
    const s = triggerBigEvent(before, 'inflationShock');
    expect(s.market.livingIndex).toBeCloseTo(before.market.livingIndex * 1.1, 6);
    expect(s.market.wageIndex).toBe(before.market.wageIndex);
  });
  it('銀行の破綻: 預金のうち1,000万円を超える分の半分を失う', () => {
    expect(triggerBigEvent(started(3000), 'bankFailure').player.cash).toBeCloseTo(2000, 6);
    expect(triggerBigEvent(started(800), 'bankFailure').player.cash).toBeCloseTo(800, 6);
  });
  it('大地震: 全員に100万円。持ち家で保険がなければ、さらに1,000万円', () => {
    const base = started(2000);
    expect(triggerBigEvent(base, 'earthquake').player.cash).toBeCloseTo(1900, 6);
    const insured = triggerBigEvent({ ...base, player: { ...base.player, home: home(true) } }, 'earthquake');
    expect(insured.player.cash).toBeCloseTo(1900, 6);
    expect(insured.bigEvent!.covered).toBe(1000);
    const uninsured = triggerBigEvent({ ...base, player: { ...base.player, home: home(false) } }, 'earthquake');
    expect(uninsured.player.cash).toBeCloseTo(900, 6);
  });
  it('遺産の相続: 500万円もらえる', () => {
    expect(triggerBigEvent(started(), 'inheritance').player.cash).toBeCloseTo(550, 6);
  });
  it('お金が足りなくなったら、借金になる', () => {
    const s = triggerBigEvent(started(0), 'earthquake');
    expect(s.player.cash).toBe(0);
    expect(s.player.cardLoan).toBeCloseTo(100, 6);
  });
  it('画面を閉じるまで、ルーレットは回せない', () => {
    const s = triggerBigEvent(started(), 'inheritance');
    expect(() => roll(s)).toThrow();
    expect(() => roll(dismissBigEvent(s))).not.toThrow();
  });
});
