import { describe, expect, it } from 'vitest';
import assetsJson from '../data/assets.json';
import eventsJson from '../data/events.json';
import jobsJson from '../data/jobs.json';
import newsJson from '../data/news.json';
import { ASSETS, ASSET_IDS, checkAssets } from '../data/assets';
import { BOARD, MARRIAGE_STOP_INDEX, SQUARE_COUNTS } from '../data/board';
import { EVENTS, checkEvents } from '../data/events';
import { GAMBLES, GAMBLE_IDS } from '../data/gamble';
import { JOBS, JOB_IDS, checkJobs } from '../data/jobs';
import { NEWS, checkNews } from '../data/news';
import { BIRTH, MARRIAGE, YEAR_OPTIONS } from '../data/rules';
import { has } from '../i18n';
import { playGame } from './autoplay';
import { choose, chooseJob, chooseYears, createGame, estimateMonth, getOptions, nextYear, roll, trade } from './engine';
import { createLoan, netWorth, payLoanMonth } from './finance';
import { newYearMarket, updateMarketMonth, updateMarketYear } from './market';
import type { GameState } from './types';

function started(seed = 1, years = 20, job = 'employee'): GameState {
  return chooseJob(chooseYears(createGame(seed), years), job);
}

/** 決定を、いちばん上の選べる選択肢で進める */
function settle(s: GameState): GameState {
  while (s.phase === 'decision') s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
  return s;
}

/** 指定のマスの1つ手前に置き、ルーレットを回す。出目が1のシード値を探す */
function landOn(s: GameState, index: number): GameState {
  for (let seed = 1; seed < 500; seed++) {
    const t = roll({ ...s, rngState: seed, player: { ...s.player, position: index - 1 } });
    if (t.player.position === index) return t;
  }
  throw new Error('not found');
}

describe('データ（JSON）', () => {
  it('銘柄・ニュース・出来事・職業の JSON に、まちがいがない', () => {
    expect(checkAssets(assetsJson)).toEqual([]);
    expect(checkNews(newsJson)).toEqual([]);
    expect(checkEvents(eventsJson)).toEqual([]);
    expect(checkJobs(jobsJson)).toEqual([]);
  });
  it('まちがいがあれば見つけられる', () => {
    expect(checkAssets({ assets: [{ id: 'x', kind: 'coin' }] }).length).toBeGreaterThan(0);
    expect(checkNews({ news: [{ id: 'n', weight: 1, shocks: { noSuchAsset: 0.1 } }] })).toEqual([
      'news[0]: shocks の「noSuchAsset」という銘柄はありません',
    ]);
    expect(checkEvents({ events: [{ id: 'e', size: 'huge', weight: 1, effects: [{ t: 'magic' }], when: { age: 30 } }] }).length).toBe(3);
    expect(checkJobs({ jobs: [{ id: 'a' }, { id: 'a' }], athleteRetireYear: { min: 5, max: 1 }, athleteNextJobs: ['b'] }).length).toBeGreaterThan(3);
  });
  it('画面に出す文字が、言語ファイルにある', () => {
    const keys = [
      ...ASSET_IDS.map((id) => `asset.${id}`),
      ...NEWS.flatMap((n) => [`news.${n.id}.title`, `news.${n.id}.text`]),
      ...EVENTS.flatMap((e) => [`event.${e.id}.title`, `event.${e.id}.text`]),
      ...JOB_IDS.flatMap((j) => [`job.${j}`, `job.${j}.desc`]),
    ];
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });
  it('積み立てできるのは、投資信託とゴールドだけ', () => {
    expect(ASSET_IDS.filter((id) => ASSETS[id].accumulate).sort()).toEqual(['fund', 'gold']);
  });
});

describe('盤面', () => {
  it('72マスで、種類ごとの数が設計どおり', () => {
    expect(BOARD).toHaveLength(72);
    for (const [type, n] of Object.entries(SQUARE_COUNTS)) {
      expect(BOARD.filter((sq) => sq.type === type)).toHaveLength(n);
    }
  });
  it('スタートは0番、結婚マスは18番', () => {
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
  it('住宅ローンは毎月返し、期間の終わりに残高0になる', () => {
    const loan = createLoan(2700, 0.01, 35);
    let paid = 0;
    for (let i = 0; i < 35 * 12; i++) paid += payLoanMonth(loan).paid;
    expect(loan.balance).toBe(0);
    expect(paid).toBeGreaterThan(2700);
    expect(paid).toBeLessThan(2700 * 1.2);
  });
  it('買ってすぐ売ると、金額は元に戻る', () => {
    const s0 = trade(started(), 'fund', 30);
    const s1 = trade(s0, 'fund', -30);
    expect(s0.player.cash).toBeCloseTo(20, 6);
    expect(s1.player.cash).toBeCloseTo(50, 6);
    expect(s1.player.holdings.fund).toBeCloseTo(0, 6);
  });
  it('預金より多くは買えない', () => {
    const s = trade(started(), 'gold', 10000);
    expect(s.player.cash).toBeGreaterThanOrEqual(0);
  });
  it('今月の家計は、1年分の金額を12で割ったもの', () => {
    const plan = estimateMonth(started(1, 20, 'employee'));
    expect(plan.income.salary).toBeCloseTo(250 / 12, 6);
    expect(plan.expense.living).toBeCloseTo(200 / 12, 6);
    expect(plan.expense.jobCost).toBeCloseTo(10 / 12, 6);
  });
});

describe('お金が足りないとき', () => {
  it('先に資産を売り、足りない分だけ利息なしで借りる', () => {
    let s = trade(started(), 'bond', 40);
    s = { ...s, player: { ...s.player, cash: -2000 } };
    s = landOn(s, 1);
    s = settle(s);
    expect(s.player.holdings.bond).toBe(0);
    expect(s.player.cash).toBe(0);
    expect(s.player.cardLoan).toBeGreaterThan(1900);
  });
  it('借金は、お金が余った月に返す', () => {
    let s = started();
    s = { ...s, player: { ...s.player, cardLoan: 1 } };
    s = settle(roll(s));
    expect(s.player.cardLoan).toBe(0);
  });
});

describe('ゲームの進行', () => {
  it('選んだ年数（12ヶ月 × 年数）遊ぶと終わる', () => {
    for (const years of [10, 20]) {
      const s = playGame(7, 'employee', years);
      expect(s.phase).toBe('finished');
      expect(s.history).toHaveLength(years);
      expect(s.prices).toHaveLength(years * 12 + 1);
      expect(s.result!.netWorth).toBeCloseTo(netWorth(s), 6);
    }
  });
  it('選べる年数は10・20・30・40・50年', () => {
    expect(YEAR_OPTIONS).toEqual([10, 20, 30, 40, 50]);
    expect(() => chooseYears(createGame(1), 15)).toThrow();
  });
  it('1ターンで1ヶ月進み、12月のあとは年末になる', () => {
    let s = started(3);
    for (let i = 0; i < 11; i++) {
      s = settle(roll(s));
      expect(s.phase).toBe('roll');
    }
    expect(s.month).toBe(12);
    s = settle(roll(s));
    expect(s.phase).toBe('yearEnd');
    expect(s.newsId).not.toBeNull();
    s = settle(nextYear(s));
    expect(s.year).toBe(2);
    expect(s.month).toBe(1);
  });
  it('純資産が増えた・減った理由の合計は、その年の純資産の増減と一致する', () => {
    const s = playGame(21, 'employee', 30);
    let prev = 50;
    for (const h of s.history) {
      const b = h.breakdown;
      expect(b.work + b.investment + b.revaluation + b.other).toBeCloseTo(h.netWorth - prev, 6);
      prev = h.netWorth;
    }
  });
  it('同じシード値なら、同じ結果になる', () => {
    const a = playGame(42, 'engineer');
    const b = playGame(42, 'engineer');
    expect(a.result).toEqual(b.result);
    expect(a.log).toEqual(b.log);
  });
  it('どの職業でも、数値がおかしくならない', () => {
    for (const job of JOB_IDS) {
      for (let seed = 1; seed <= 4; seed++) {
        const s = playGame(seed, job, 30);
        expect(Number.isFinite(s.result!.netWorth)).toBe(true);
        expect(s.player.cash).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('スポーツ選手は、5〜10年目のどこかで引退する', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = playGame(seed, 'athlete', 10);
      // 引退の前に、転職の出来事で別の職業に移っていることもある
      const retired = s.log.find((l) => l.key === 'job.retire');
      const changed = s.log.find((l) => l.key === 'job.change');
      expect(retired ?? changed).toBeDefined();
      if (retired) {
        expect(retired.year).toBeGreaterThanOrEqual(5);
        expect(retired.year).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('結婚と出産', () => {
  it('独身なら、結婚マスは出目が残っていても必ず止まる', () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      let s = started(seed);
      s = { ...s, player: { ...s.player, position: MARRIAGE_STOP_INDEX - 1 } };
      s = roll(s);
      expect(s.player.position).toBe(MARRIAGE_STOP_INDEX);
      expect(s.decision?.kind).toBe('marriage');
      if (s.lastRoll! > 1) found = true;
    }
    expect(found).toBe(true);
  });
  it('結婚していれば、結婚マスは止まらずに通りすぎる', () => {
    let passed = false;
    for (let seed = 1; seed <= 200 && !passed; seed++) {
      let s = started(seed);
      s = { ...s, player: { ...s.player, married: true, position: MARRIAGE_STOP_INDEX - 1 } };
      s = roll(s);
      if (s.lastRoll! > 1) {
        expect(s.player.position).toBeGreaterThan(MARRIAGE_STOP_INDEX);
        passed = true;
      }
    }
    expect(passed).toBe(true);
  });
  it('結婚ルーレットは、1・3・5で結婚、2・4・6で結婚しない', () => {
    let married = 0;
    let single = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let s = landOn(started(seed), MARRIAGE_STOP_INDEX);
      s = choose({ ...s, rngState: seed * 7919 }, 'spin');
      const face = Number(s.decision!.params!.face);
      expect(s.player.married).toBe(MARRIAGE.faces.includes(face));
      if (s.player.married) married++;
      else single++;
    }
    expect(married).toBeGreaterThan(30);
    expect(single).toBeGreaterThan(30);
  });
  it('独身で出産マスに止まると、出産祝いを払う', () => {
    const index = BOARD.findIndex((sq) => sq.type === 'birth');
    const s = landOn(started(), index);
    expect(s.phase).toBe('roll');
    expect(s.log.some((l) => l.key === 'birth.gift' && l.cash === -BIRTH.gift)).toBe(true);
  });
  it('結婚していれば、出産マスでルーレットを回し、当たれば子どもが生まれる', () => {
    const index = BOARD.findIndex((sq) => sq.type === 'birth');
    let born = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let s = started(seed);
      s = { ...s, player: { ...s.player, married: true, spouse: { work: 'none', income: 0, halfThisYear: false } } };
      s = landOn(s, index);
      expect(s.decision?.kind).toBe('birth');
      s = choose({ ...s, rngState: seed * 7919 }, 'spin');
      const face = Number(s.decision!.params!.face);
      expect(s.player.children.length).toBe(BIRTH.faces.includes(face) ? 1 : 0);
      born += s.player.children.length;
    }
    expect(born).toBeGreaterThan(15);
  });
  it('子どもは年末ごとに1つ年を取り、15歳と18歳で進学がルーレットで決まる', () => {
    let s = started(5, 30);
    s = { ...s, player: { ...s.player, children: [{ age: 14, highSchool: null, university: null, independent: false }] } };
    while (s.phase !== 'yearEnd') s = settle(roll(s));
    s = nextYear(s);
    expect(s.player.children[0].age).toBe(15);
    expect(s.player.children[0].highSchool).not.toBeNull();
    expect(s.decision?.messageKey).toMatch(/^school\.highSchool\./);
  });
});

describe('相場', () => {
  it('長い目で見ると、銘柄ごとの平均の値上がりに近くなる', () => {
    const years = 50;
    const rates: Record<string, number[]> = Object.fromEntries(ASSET_IDS.map((id) => [id, []]));
    for (let seed = 1; seed <= 300; seed++) {
      const s = createGame(seed);
      for (let y = 0; y < years; y++) {
        for (let m = 0; m < 12; m++) updateMarketMonth(s);
        updateMarketYear(s);
        s.yearMarket = newYearMarket(s);
      }
      for (const id of ASSET_IDS) rates[id].push(Math.pow(s.market.prices[id], 1 / years) - 1);
    }
    for (const id of ASSET_IDS) {
      const sorted = [...rates[id]].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(Math.abs(median - ASSETS[id].meanReturn), id).toBeLessThan(0.01);
    }
  });
  it('職業のデータは、JSON から読みこまれている', () => {
    expect(JOBS.employee.startSalary).toBe(250);
    expect(JOBS.employee.maxSalary).toBe(Infinity);
  });
});
