import { describe, expect, it } from 'vitest';
import talksJson from '../data/investTalks.json';
import { BOARD } from '../data/board';
import { INVEST_TALKS, checkInvestTalks, expectedMultiplier } from '../data/investTalks';
import { has } from '../i18n';
import { choose, chooseJob, chooseYears, createGame, dismissBigEvent, dismissNews, getOptions, roll, setSaving } from './engine';
import type { GameState } from './types';

function started(cash = 500): GameState {
  const s = setSaving(chooseJob(chooseYears(createGame(1), 20), 'employee'), {});
  // ボーナスマスは届かない遠くに置く
  return { ...s, bonusSquare: 60, player: { ...s.player, cash } };
}

/** 投資の話のマスに止まった状態にする */
function onTalk(s: GameState, talkId: string): GameState {
  return { ...s, phase: 'decision', decision: { kind: 'talk', talkId }, decisionFrom: 'square' };
}

/** 年末まで進める（ほかの出来事は、いちばん上の選択肢で進める） */
function toYearEnd(s: GameState): GameState {
  while (s.phase !== 'yearEnd') {
    if (s.bigEvent) s = dismissBigEvent(s);
    if (s.newsEvent) s = dismissNews(s);
    if (s.phase === 'roll') s = roll(s);
    else if (s.phase === 'decision') {
      const opts = getOptions(s);
      s = choose(s, (opts.find((o) => o.id === 'skip' && s.decision?.kind === 'talk') ?? opts.find((o) => o.enabled))!.id);
    }
  }
  return s;
}

describe('投資の話（投資の落とし穴）', () => {
  it('investTalks.json にまちがいがなく、どれも平均すると損をする', () => {
    expect(checkInvestTalks(talksJson)).toEqual([]);
    expect(checkInvestTalks({ amounts: [10], talks: [{ id: 'x', outcomes: [{ probability: 1, multiplier: 1.5 }] }] }).length).toBe(1);
    for (const t of INVEST_TALKS) {
      expect(expectedMultiplier(t)).toBeLessThan(1);
      expect(has(`talk.${t.id}.title`)).toBe(true);
      expect(has(`talk.${t.id}.text`)).toBe(true);
      expect(has(`option.talk.${t.id}`)).toBe(true);
    }
  });
  it('投資の話のマスに止まると、3つのどれかを持ちかけられる', () => {
    const index = BOARD.findIndex((sq) => sq.type === 'investTalk');
    const seen = new Set<string>();
    for (let seed = 1; seed < 400 && seen.size < 3; seed++) {
      const base = started();
      const s = roll({ ...base, rngState: seed, player: { ...base.player, position: index - 1 } });
      if (s.player.position === index && s.decision?.kind === 'talk') seen.add(s.decision.talkId!);
    }
    expect([...seen].sort()).toEqual(['hype', 'leverage', 'scam']);
  });
  it('断れば、何も起きない', () => {
    const s = choose(onTalk(started(), 'scam'), 'skip');
    expect(s.player.talks).toHaveLength(0);
    expect(s.stats.talkSpent).toBe(0);
    expect(s.log.some((l) => l.key === 'talk.scam.decline')).toBe(true);
  });
  it('乗ると元手を払い、結果は年末に決まる', () => {
    let s = choose(onTalk(started(), 'hype'), 'join:50');
    expect(s.player.talks).toEqual([{ id: 'hype', amount: 50 }]);
    expect(s.stats.talkSpent).toBe(50);
    s = toYearEnd(s);
    expect(s.player.talks).toHaveLength(0);
    expect([25, 100]).toContain(s.stats.talkReturned);
    // 年末の決算にも、投資の話の結果が出る
    expect(s.lastSettlement!.talks).toEqual([{ id: 'hype', amount: 50, back: s.stats.talkReturned }]);
  });
  it('借りて投資して外れると、借りた分が借金になる。当たると元手の3倍が戻る', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      let s = choose(onTalk({ ...started(0), rngState: seed, player: { ...started(0).player, cash: 10 } }, 'leverage'), 'join:10');
      s = toYearEnd(s);
      results.add(s.stats.talkReturned);
      if (s.stats.talkReturned < 0) expect(s.log.some((l) => l.key === 'talk.leverage.debt')).toBe(true);
    }
    expect([...results].sort((a, b) => a - b)).toEqual([-10, 30]);
  });
  it('預金が足りない金額では乗れない', () => {
    const opts = getOptions(onTalk(started(20), 'scam'));
    expect(opts.find((o) => o.id === 'join:10')!.enabled).toBe(true);
    expect(opts.find((o) => o.id === 'join:50')!.enabled).toBe(false);
  });
});
