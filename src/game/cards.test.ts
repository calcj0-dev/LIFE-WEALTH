import { describe, expect, it } from 'vitest';
import cardsJson from '../data/cards.json';
import { BOARD, BONUS_SPOTS } from '../data/board';
import { HAND_MAX, checkCards } from '../data/cards';
import { BONUS } from '../data/rules';
import { has } from '../i18n';
import { CARDS } from '../data/cards';
import {
  bonusDistance,
  choose,
  chooseJob,
  chooseYears,
  closeTrade,
  createGame,
  dismissBigEvent,
  dismissNews,
  getOptions,
  nextYear,
  openTradeCard,
  roll,
  setSaving,
  trade,
} from './engine';
import type { GameState } from './types';

function started(seed = 1): GameState {
  return setSaving(chooseJob(chooseYears(createGame(seed), 20), 'employee'), {});
}

const withHand = (s: GameState, hand: string[]): GameState => ({ ...s, player: { ...s.player, hand } });
/** ボーナスマスを、届かない遠くに置く（ほかのテストのじゃまをしないように） */
const farBonus = (s: GameState): GameState => ({ ...s, bonusSquare: (s.player.position + 50) % 200 });
/** 元の道の、その種類のマスのうち、1つ手前が分かれ道でないもの（1マス進んで止まれるように） */
const plainIndex = (type: string) => BOARD.findIndex((sq, i) => sq.type === type && sq.route === 'main' && i > 0 && BOARD[i - 1].next.length === 1 && BOARD[i - 1].next[0] === i);

describe('カード', () => {
  it('cards.json にまちがいがなく、画面の文字がある', () => {
    expect(checkCards(cardsJson)).toEqual([]);
    expect(checkCards({ handMax: 0, cards: [{ id: 'x', kind: 'magic', weight: 1, luckyWeight: 1 }] }).length).toBe(2);
    for (const c of CARDS) {
      expect(has(`card.${c.id}`)).toBe(true);
      expect(has(`card.${c.id}.text`)).toBe(true);
    }
  });
  it('カードマスに止まると、カードが1枚もらえる', () => {
    const index = plainIndex('card');
    for (let seed = 1; seed < 300; seed++) {
      const base = farBonus(started());
      const s = roll({ ...base, rngState: seed, player: { ...base.player, position: index - 1 } });
      if (s.player.position !== index || s.lastRoll !== 1) continue;
      expect(s.player.hand).toHaveLength(1);
      expect(s.log.some((l) => l.key === 'card.get')).toBe(true);
      return;
    }
    throw new Error('not found');
  });
  it('手札が4枚になったら、1枚捨てる', () => {
    const index = plainIndex('card');
    for (let seed = 1; seed < 300; seed++) {
      const base = farBonus(withHand(started(), ['dash', 'dash', 'dash']));
      let s = roll({ ...base, rngState: seed, player: { ...base.player, position: index - 1 } });
      if (s.player.position !== index || s.lastRoll !== 1) continue;
      expect(s.decision?.kind).toBe('discard');
      expect(getOptions(s)).toHaveLength(HAND_MAX + 1);
      s = choose(s, 'discard:0');
      expect(s.player.hand).toHaveLength(HAND_MAX);
      expect(s.phase).toBe('roll');
      return;
    }
    throw new Error('not found');
  });
  it('年末に、カードを1枚もらう', () => {
    let s = started();
    while (s.phase !== 'yearEnd') {
      s = roll(farBonus(s));
      while (s.phase === 'decision') s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
      if (s.bigEvent) s = dismissBigEvent(s);
      if (s.newsEvent) s = dismissNews(s);
    }
    const before = s.player.hand.length;
    s = nextYear(s);
    expect(s.player.hand.length === before + 1 || s.decision?.kind === 'discard').toBe(true);
  });
  it('ダッシュは出目の2倍、スーパーダッシュは3倍進む（ルーレットは1回）', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const base = { ...started(), rngState: seed };
      const a = roll(farBonus(withHand(base, ['dash'])), { index: 0 });
      expect(a.lastRoll).toBe(a.lastFace! * 2);
      expect(a.log.some((l) => l.key === 'card.use' && l.params?.card === 'dash')).toBe(true);
      const b = roll(farBonus(withHand(base, ['superDash'])), { index: 0 });
      expect(b.lastRoll).toBe(b.lastFace! * 3);
    }
  });
  it('ぴったりは、選んだ数だけ進む', () => {
    for (let n = 1; n <= 6; n++) {
      const s = roll(farBonus(withHand(started(), ['exact'])), { index: 0, exact: n });
      expect(s.lastRoll).toBe(n);
    }
    expect(() => roll(withHand(started(), ['exact']), { index: 0, exact: 7 })).toThrow();
  });
  it('取引カードを使うと、その場で売り買いができ、閉じたらルーレットを回す', () => {
    const base = withHand(started(), ['trade', 'dash']);
    expect(() => trade(base, 'fund', 10)).toThrow();
    let s = openTradeCard(base, 0);
    expect(s.tradeOpen).toBe(true);
    s = trade(s, 'fund', 10);
    expect(s.player.holdings.fund).toBeGreaterThan(0);
    expect(() => roll(s)).toThrow();
    s = closeTrade(s);
    // 1ターンに使えるカードは1枚まで
    expect(() => roll(s, { index: 0 })).toThrow();
    s = roll(s);
    expect(s.player.hand).toEqual(['dash']);
  });
});

describe('ボーナスマス', () => {
  it('決まった20か所のどれかに付く（距離に関係なくランダム）', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = started(seed);
      expect(BONUS_SPOTS).toContain(s.bonusSquare);
      expect(BOARD[s.bonusSquare].type).not.toBe('start');
      expect(bonusDistance(s)).toBeLessThan(Infinity);
      seen.add(s.bonusSquare);
    }
    expect(seen.size).toBeGreaterThan(10);
  });
  it('ぴったり止まるとボーナスがもらえ、次のボーナスマスが決まる', () => {
    const base = started();
    const s0 = { ...base, bonusSquare: (base.player.position + 3) % BOARD.length };
    const s = roll(withHand(s0, ['exact']), { index: 0, exact: 3 });
    expect(s.log.some((l) => l.key === 'bonus.get' && l.cash === BONUS.amount)).toBe(true);
    expect(s.bonusSquare).not.toBe(s0.bonusSquare);
  });
  it('通りすぎたときは、もらえない', () => {
    // ライバルが取らないように、ライバルなしで確かめる
    const base = { ...started(), rivals: [] };
    const s0 = { ...base, bonusSquare: (base.player.position + 2) % BOARD.length };
    const s = roll(withHand(s0, ['exact']), { index: 0, exact: 3 });
    expect(s.log.some((l) => l.key === 'bonus.get')).toBe(false);
    expect(s.bonusSquare).toBe(s0.bonusSquare);
  });
});
