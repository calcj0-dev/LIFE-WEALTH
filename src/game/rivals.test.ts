import { describe, expect, it } from 'vitest';
import { BONUS } from '../data/rules';
import { playGame } from './autoplay';
import { applyNews } from './market';
import { NEWS } from '../data/news';
import { choose, chooseJob, chooseYears, createGame, dismissBigEvent, dismissNews, distanceOnBoard, getOptions, roll, setSaving } from './engine';
import { standings } from './standings';
import type { GameState } from './types';

function started(seed = 1, years = 20): GameState {
  return setSaving(chooseJob(chooseYears(createGame(seed), years), 'employee'), {});
}

describe('ライバル（CPU）', () => {
  it('コツコツさんとイケイケさんの2人がいて、職業はルーレットで決まり、コツコツさんは医療保険に入る', () => {
    const s = started();
    expect(s.rivals.map((r) => r.id)).toEqual(['steady', 'bold']);
    for (const r of s.rivals) expect(r.player.salary).toBeGreaterThan(0);
    expect(s.rivals[0].player.medicalPremium).not.toBeNull();
    expect(s.rivals[1].player.medicalPremium).toBeNull();
  });
  it('rivals: false なら、ライバルなしの1人で遊べる', () => {
    expect(createGame(1, { rivals: false }).rivals).toEqual([]);
  });
  it('あなたのターンが終わると、ライバルも動き、全員の月末（給料など）が済む', () => {
    let s = roll(started());
    while (s.phase === 'decision') s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
    s = dismissNews(dismissBigEvent(s));
    expect(s.month).toBe(2);
    for (const r of s.rivals) {
      expect(r.player.position + r.player.lap * 200).toBeGreaterThan(0);
      expect(r.yearFlows.income.salary).toBeGreaterThan(0);
    }
  });
  it('ニュースは全員に起き、それぞれの資産が動いた金額が記録される', () => {
    const s = started();
    s.rivals[1].player.holdings.it = 10;
    applyNews(s, NEWS.find((n) => n.shocks.it)!);
    for (const v of [s, ...s.rivals]) expect(v.newsEvent?.id).toBe(s.newsEvent!.id);
    expect(s.rivals[1].newsEvent!.amounts.it).not.toBe(0);
    expect(s.newsEvent!.amounts.it).toBe(0);
  });
  it('最後まで遊ぶと、ライバルにも20年分の記録と結果が残る', () => {
    const s = playGame(3, 'employee', 20);
    for (const r of s.rivals) {
      expect(r.history).toHaveLength(20);
      expect(r.result?.netWorth).toBeCloseTo(r.history[19].netWorth, 6);
    }
  });
  it('コツコツさんはギャンブルと投資の話に乗らず、イケイケさんは株を買う', () => {
    let boldBought = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = playGame(seed, 'employee', 20);
      const [steady, bold] = s.rivals;
      expect(steady.stats.gambleSpent).toBe(0);
      expect(steady.stats.talkSpent).toBe(0);
      if (bold.log.some((l) => l.key === 'trade.buyShares' || l.key === 'stock.buy')) boldBought++;
    }
    expect(boldBought).toBeGreaterThan(5);
  });
  it('ボーナスマスは早い者勝ち。ライバルが取ることもある', () => {
    let rivalGot = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = playGame(seed, 'employee', 10);
      rivalGot += s.rivals.reduce((a, r) => a + r.log.filter((l) => l.key === 'bonus.get' && l.cash === BONUS.amount).length, 0);
    }
    expect(rivalGot).toBeGreaterThan(0);
  });
  it('同じシード値なら、ライバルも同じ展開になる', () => {
    const a = playGame(7, 'employee', 10);
    const b = playGame(7, 'employee', 10);
    expect(a.rivals.map((r) => r.result!.netWorth)).toEqual(b.rivals.map((r) => r.result!.netWorth));
  });
  it('順位は純資産の多い順。結果には投資の成績も入る', () => {
    const s = playGame(5, 'employee', 10);
    const list = standings(s);
    expect(list.map((x) => x.who).sort()).toEqual(['bold', 'steady', 'you']);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].worth).toBeGreaterThanOrEqual(list[i].worth);
    expect(list[0].rank).toBe(1);
    expect(typeof s.result!.investReturn).toBe('number');
  });
  it('ライバルがボーナスマスを取っても、次のボーナスマスはあなたの駒から10〜40マス先', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = started(seed, 10);
      for (let turn = 0; turn < 120 && s.phase !== 'finished'; turn++) {
        if (s.phase === 'roll') s = roll(s);
        while (s.phase === 'decision') s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
        s = dismissNews(dismissBigEvent(s));
        if (s.phase === 'yearEnd') break;
        const taken = s.rivals.some((r) => r.log.at(-1)?.key === 'bonus.get' && r.log.at(-1)?.month === s.month - 1);
        if (taken) {
          const d = distanceOnBoard(s.player.position, s.bonusSquare);
          expect(d).toBeLessThanOrEqual(BONUS.maxAhead);
        }
      }
    }
  });
});
