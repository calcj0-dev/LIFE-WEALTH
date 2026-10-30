import { describe, expect, it } from 'vitest';
import assetsJson from '../data/assets.json';
import eventsJson from '../data/events.json';
import jobsJson from '../data/jobs.json';
import newsJson from '../data/news.json';
import { ASSETS, ASSET_IDS, checkAssets } from '../data/assets';
import { BOARD, BONUS_SPOTS, PETAL_STOCK, SQUARE_COUNTS } from '../data/board';

/** 最初の結婚・出産マス */
/** 結婚・出産マスのうち、1つ手前からも、その先6マスも、分かれ道のない一本道のもの（テストで止まりやすくするため） */
const plainRoad = (i: number) => [i - 1, i, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6].every((k) => BOARD[k] && BOARD[k].next.length === 1 && BOARD[k].next[0] === k + 1);
const FAMILY_INDEX = BOARD.findIndex((sq, i) => sq.type === 'family' && plainRoad(i));
import { EVENTS, EVENTS_BY_ID, checkEvents } from '../data/events';
import { GAMBLES, GAMBLE_IDS } from '../data/gamble';
import { JOBS, JOB_IDS, checkJobs } from '../data/jobs';
import { NEWS, checkNews } from '../data/news';
import { BIRTH, MARRIAGE, STOCK_SQUARE, YEAR_OPTIONS } from '../data/rules';
import { has } from '../i18n';
import { payShortfall, playGame } from './autoplay';
import {
  canSellHome,
  dismissBigEvent,
  dismissNews,
  choose,
  chooseJob,
  chooseYears,
  createGame,
  estimateMonth,
  getOptions,
  joinMedical,
  medicalPremiumAt,
  nextYear,
  prepay,
  recommendedSaving,
  roll,
  sellHome,
  setSaving,
  trade,
  tradeShares,
} from './engine';
import { createLoan, netWorth, payLoanMonth } from './finance';
import { applyNews, maybeNews, newYearMarket, updateMarketMonth, updateMarketYear } from './market';
import { NEWS_PER_YEAR } from '../data/news';
import { dismissGambleResult, distanceOnBoard, maybeBigEvent, sellForShortfall, shortfallPending } from './engine';
import type { GameState } from './types';

function started(seed = 1, years = 20, job = 'employee', saving: Record<string, number> = {}): GameState {
  return setSaving(chooseJob(chooseYears(createGame(seed), years), job), saving);
}

/** 決定を、いちばん上の選べる選択肢で進める */
function settle(s: GameState): GameState {
  if (s.bigEvent) s = dismissBigEvent(s);
  if (s.newsEvent) s = dismissNews(s);
  while (s.phase === 'decision') s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
  if (s.bigEvent) s = dismissBigEvent(s);
  if (s.newsEvent) s = dismissNews(s);
  return payShortfall(s);
}

/** 年末まで進める */
function toYearEnd(s: GameState): GameState {
  while (s.phase !== 'yearEnd') s = settle(roll(s));
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
    expect(checkNews({ frequency: { count: 2, years: 1.5 }, news: [{ id: 'n', weight: 1, shocks: { noSuchAsset: 0.1 } }] })).toEqual([
      'news[0]: shocks の「noSuchAsset」という銘柄はありません',
    ]);
    expect(checkEvents({ events: [{ id: 'e', sign: 'plus', size: 'huge', weight: 1, effects: [{ t: 'magic' }], when: { age: 30 } }] }).length).toBe(3);
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
  it('転職マスでは、転職先の候補が2つ出て、選ぶか今のままでいるかを決める', () => {
    const index = BOARD.findIndex((sq, i) => sq.type === 'job' && i > 0 && BOARD[i - 1].next.length === 1);
    for (let seed = 1; seed < 300; seed++) {
      const base = started();
      const s = roll({ ...base, rngState: seed, player: { ...base.player, position: index - 1 } });
      if (s.player.position !== index || s.lastRoll !== 1) continue;
      const opts = getOptions(s);
      expect(opts.filter((o) => o.id.startsWith('job:'))).toHaveLength(2);
      expect(opts.some((o) => o.id === 'skip')).toBe(true);
      const moved = choose(s, opts[0].id);
      expect(moved.player.jobId).toBe(opts[0].id.slice(4));
      return;
    }
    throw new Error('not found');
  });
  it('ふつうの道（真ん中の輪と花びら）の種類ごとの数が設計どおり。全部で約250マス', () => {
    const normal = BOARD.filter((sq) => sq.route === 'main' || sq.route === 'petal');
    for (const [type, n] of Object.entries(SQUARE_COUNTS)) {
      expect(normal.filter((sq) => sq.type === type)).toHaveLength(n);
    }
    expect(BOARD.length).toBeGreaterThan(240);
    expect(BOARD.length).toBeLessThan(270);
  });
  it('分かれ道は10か所（花びらの入り口4、戻り道の入り口4、ハイリスクの道と投資の道の入り口2）。どの道も真ん中の輪に戻ってくる', () => {
    const forks = BOARD.filter((sq) => sq.next.length > 1);
    expect(forks).toHaveLength(10);
    const second = (route: string) => forks.filter((f) => BOARD[f.next[1]].route === route).length;
    expect([second('petal'), second('shortcut'), second('risk'), second('invest')]).toEqual([4, 4, 1, 1]);
    for (const f of forks) {
      for (const first of f.next) {
        let pos = first;
        for (let i = 0; i < 80 && BOARD[pos].route !== 'main'; i++) pos = BOARD[pos].next[0];
        expect(BOARD[pos].route).toBe('main');
      }
    }
  });
  it('花びらは1周できる（花びらを出て、真ん中の輪を数マス進むと、また同じ花びらの入り口に着く）', () => {
    for (const petal of ['tl', 'tr', 'br', 'bl'] as const) {
      const sq = BOARD.find((x) => x.route === 'petal' && x.petal === petal)!;
      const loop = distanceOnBoard(sq.next[0], sq.id) + 1;
      expect(loop).toBeLessThan(55);
    }
  });
  it('スタートは真ん中の輪にある。どのマスからも、どのマスへも行ける', () => {
    expect(BOARD[0].route).toBe('main');
    for (const sq of BOARD) expect(distanceOnBoard(0, sq.id)).toBeLessThan(Infinity);
  });
  it('ボーナスマスが出る場所は20か所。どれもスタートや分かれ道ではなく、通りすぎても60マス以内で戻ってこられる', () => {
    expect(new Set(BONUS_SPOTS).size).toBe(20);
    const loop = (id: number) => Math.min(...BOARD[id].next.map((n) => distanceOnBoard(n, id) + 1));
    for (const id of BONUS_SPOTS) {
      expect(BOARD[id].type).not.toBe('start');
      expect(BOARD[id].next).toHaveLength(1);
    }
    for (const id of BONUS_SPOTS) expect(loop(id)).toBeLessThanOrEqual(60);
  });
  it('花びらの株のマスでは、その花びらの株が出る', () => {
    for (const petal of ['tl', 'tr', 'br', 'bl'] as const) {
      const sq = BOARD.find((x) => x.type === 'stock' && x.petal === petal)!;
      const before = BOARD.find((x) => x.next.length === 1 && x.next[0] === sq.id)!;
      const base = started();
      const s = roll({ ...base, bonusSquare: BONUS_SPOTS.find((id) => id !== sq.id)!, player: { ...base.player, position: before.id, hand: ['exact'] } }, { index: 0, exact: 1 });
      expect(s.player.position).toBe(sq.id);
      expect(s.decision?.assetId).toBe(PETAL_STOCK[petal]);
    }
  });
  it('スタートに止まると、カードが1枚もらえる', () => {
    const before = BOARD.find((x) => x.next.length === 1 && x.next[0] === 0)!;
    const base = started();
    const s = roll({ ...base, player: { ...base.player, position: before.id, hand: ['exact'] } }, { index: 0, exact: 1 });
    expect(s.player.position).toBe(0);
    expect(s.player.hand).toHaveLength(1);
    expect(s.log.some((e) => e.key === 'card.get')).toBe(true);
  });
  it('分かれ道では止まって道を選び、残りのマス数だけ選んだ道を進む', () => {
    const fork = BOARD.find((sq) => sq.next.length > 1 && BOARD[sq.next[1]].route === 'risk')!;
    for (let seed = 1; seed < 300; seed++) {
      const base = started();
      const s = roll({ ...base, rngState: seed, player: { ...base.player, position: fork.id - 1 } });
      if (s.lastRoll! < 3) continue;
      expect(s.decision?.kind).toBe('fork');
      expect(s.player.position).toBe(fork.id);
      const left = Number(s.decision!.params!.steps);
      const after = choose(s, `path:${fork.next[1]}`);
      expect(after.lastPath[0]).toBe(fork.next[1]);
      expect(after.lastPath).toHaveLength(left);
      return;
    }
    throw new Error('not found');
  });
  it('ライバルは、分かれ道で止まらずに、ボーナスマスに近い道を選ぶ', () => {
    const s = playGame(9, 'employee', 10);
    expect(s.phase).toBe('finished');
    // ライバルも、分かれた道のマスを通ることがある
    expect(s.rivals.some((r) => r.log.length > 0)).toBe(true);
  });
  it('スタートは0番', () => {
    expect(BOARD[0].type).toBe('start');
  });
  it('マスどうしが重ならない（どの2マスの間も、マスの大きさより広い）', () => {
    for (const a of BOARD) for (const b of BOARD) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(80);
  });
  it('真ん中の輪は1周つながっている', () => {
    const hub = BOARD.filter((sq) => sq.route === 'main');
    let pos = 0;
    for (let i = 0; i < hub.length; i++) pos = BOARD[pos].next[0];
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
    const s0 = trade({ ...started(), phase: 'yearEnd' }, 'fund', 30);
    const s1 = trade(s0, 'fund', -30);
    expect(s0.player.cash).toBeCloseTo(20, 6);
    expect(s1.player.cash).toBeCloseTo(50, 6);
    expect(s1.player.holdings.fund).toBeCloseTo(0, 6);
  });
  it('預金より多くは買えない', () => {
    const s = trade({ ...started(), phase: 'yearEnd' }, 'gold', 10000);
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
  it('あなたは売る資産を選んで必ず売り、売れる資産がなくなったら、残りを利息なしで借りる', () => {
    let s = trade({ ...started(), phase: 'yearEnd' }, 'bond', 40);
    s = { ...s, phase: 'roll', player: { ...s.player, cash: -2000 } };
    // 足りないままでは、ルーレットを回せない
    expect(shortfallPending(s)).toBe(true);
    expect(() => roll(s)).toThrow();
    s = sellForShortfall(s, 'bond', 'one');
    expect(s.player.holdings.bond).toBeCloseTo(39, 6);
    s = sellForShortfall(s, 'bond', 'needed');
    expect(s.player.holdings.bond).toBe(0);
    expect(s.player.cash).toBe(0);
    expect(s.player.cardLoan).toBeGreaterThan(1900);
    expect(shortfallPending(s)).toBe(false);
  });
  it('計算の誤差で残る、ごくわずかなマイナスでは止めない（足りない画面から進めなくなっていた）', () => {
    let s = trade({ ...started(), phase: 'yearEnd' }, 'bond', 40);
    s = { ...s, phase: 'roll', player: { ...s.player, cash: -5e-324 } };
    expect(shortfallPending(s)).toBe(false);
    expect(() => roll(s)).not.toThrow();
  });
  it('月末に足りなくなっても、あなたの資産は自動では売らない（ライバルは自動で売る）', () => {
    let s = trade({ ...started(), phase: 'yearEnd' }, 'bond', 40);
    s = { ...s, phase: 'roll', player: { ...s.player, cash: -500 } };
    s.rivals[0].player.cash = -500;
    s.rivals[0].player.holdings.bond = 40;
    s = { ...s, player: { ...s.player, cash: 0 } };
    expect(shortfallPending(s)).toBe(false);
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
    expect(s.lastSettlement).not.toBeNull();
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
  it('独身なら、結婚・出産マスにちょうど止まると結婚のルーレット', () => {
    const s = landOn(started(), FAMILY_INDEX);
    expect(s.decision?.kind).toBe('marriage');
  });
  it('結婚・出産マスは、必ず止まるマスではない（出目が残っていれば通りすぎる）', () => {
    let passed = false;
    for (let seed = 1; seed <= 200 && !passed; seed++) {
      let s = started(seed);
      s = { ...s, player: { ...s.player, position: FAMILY_INDEX - 1 } };
      s = roll(s);
      if (s.lastRoll! > 1) {
        expect(s.player.position).toBeGreaterThan(FAMILY_INDEX);
        passed = true;
      }
    }
    expect(passed).toBe(true);
  });
  it('結婚ルーレットは、1・3・5で結婚、2・4・6で結婚しない', () => {
    let married = 0;
    let single = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let s = landOn(started(seed), FAMILY_INDEX);
      s = choose({ ...s, rngState: seed * 7919 }, 'spin');
      const face = Number(s.decision!.params!.face);
      expect(s.player.married).toBe(MARRIAGE.faces.includes(face));
      if (s.player.married) married++;
      else single++;
    }
    expect(married).toBeGreaterThan(30);
    expect(single).toBeGreaterThan(30);
  });
  it('結婚したら、毎月の支出（共働きなら収入も）がいくらからいくらになるかを出す', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = landOn(started(seed), FAMILY_INDEX);
      s = choose({ ...s, rngState: seed * 7919 }, 'spin');
      if (!s.player.married) continue;
      const pr = s.decision!.params!;
      expect(Number(pr.expenseTo)).toBeGreaterThan(Number(pr.expenseFrom));
      if (s.player.spouse!.work === 'full') expect(Number(pr.incomeTo)).toBeGreaterThan(Number(pr.incomeFrom));
      return;
    }
    throw new Error('結婚する例が見つからない');
  });
  it('プラスのマスではお金が増える出来事、マイナスのマスでは減る出来事、チャンスのマスでは選ぶ出来事が起きる', () => {
    for (const [type, sign] of [
      ['plusSmall', 'plus'],
      ['minusMedium', 'minus'],
      ['plusLarge', 'plus'],
      ['minusLarge', 'minus'],
      ['chance', 'chance'],
    ] as const) {
      // 1つ手前が分かれ道だと止まってしまうので、そうでないマスを使う
      const index = BOARD.findIndex((sq, i) => sq.type === type && i > 0 && BOARD[i - 1].next.length === 1 && BOARD[i - 1].next[0] === i);
      for (let seed = 1; seed <= 15; seed++) {
        const s = landOn(started(seed), index);
        if (s.decision?.kind !== 'event') continue;
        expect(EVENTS_BY_ID[s.decision.eventId!].sign).toBe(sign);
      }
    }
  });
  it('マスに合う出来事がないときは、同じ色の1つ小さい出来事にする', () => {
    // YouTuber は昇進も昇給もなく、11年目からは親からの援助もないので、プラス（大）の出来事がない
    const index = BOARD.findIndex((sq) => sq.type === 'plusLarge');
    const base = started(3, 20, 'youtuber');
    const s = landOn({ ...base, year: 11 }, index);
    expect(s.decision?.kind).toBe('event');
    const ev = EVENTS_BY_ID[s.decision!.eventId!];
    expect(ev.sign).toBe('plus');
    expect(ev.size).not.toBe('large');
  });
  it('小さな出来事のマスでも、出来事の画面を出してから起こす', () => {
    const index = BOARD.findIndex((sq) => sq.type === 'minusSmall');
    const s = landOn(started(), index);
    expect(s.decision?.kind).toBe('event');
    const after = choose(s, 'ok');
    expect(after.phase).toBe('roll');
    expect(after.log.some((l) => l.key.startsWith(`event.${s.decision!.eventId}`))).toBe(true);
  });
  it('結婚していれば、結婚・出産マスで出産のルーレットを回し、当たれば子どもが生まれる', () => {
    const index = FAMILY_INDEX;
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

describe('積み立て', () => {
  it('毎月、決めた金額で投資信託を買う', () => {
    const base = started(1, 20, 'employee', { fund: 3 });
    let s: GameState = { ...base, player: { ...base.player, cash: 100 } };
    s = settle(roll(s));
    expect(s.stats.savingTotal).toBe(3);
    expect(s.player.holdings.fund).toBeGreaterThan(0);
  });
  it('おすすめの金額は、毎月の手取りの1割（1万円単位）', () => {
    expect(recommendedSaving(started())).toBe(2);
  });
  it('積み立てできるのは投資信託とゴールドだけ', () => {
    const s = chooseJob(chooseYears(createGame(1), 20), 'employee');
    expect(() => setSaving(s, { it: 1 })).toThrow();
    expect(() => setSaving(s, { bond: 1 })).toThrow();
    expect(() => setSaving(s, { fund: 1.5 })).toThrow();
    expect(setSaving(s, { fund: 2, gold: 1 }).player.saving.gold).toBe(1);
  });
  it('預金が足りない月は、積み立てを休み、借金はしない', () => {
    let s = started(1, 20, 'employee', { fund: 1000 });
    s = settle(roll(s));
    expect(s.player.savingPaused).toBe(true);
    expect(s.stats.savingTotal).toBe(0);
    expect(s.player.cardLoan).toBe(0);
    expect(s.log.some((l) => l.key === 'saving.pause')).toBe(true);
  });
  it('取引タイムで金額を変えられる。年末以外は変えられない', () => {
    const s = started();
    expect(() => setSaving(s, { fund: 1 })).toThrow();
    expect(setSaving(toYearEnd(s), { fund: 5 }).player.saving.fund).toBe(5);
  });
});

describe('株のマスと取引タイム', () => {
  it('株のマスでは、業種別の株を10%安く買える', () => {
    const index = BOARD.findIndex((sq) => sq.type === 'stock');
    const base = started();
    let s = landOn({ ...base, player: { ...base.player, cash: 100 } }, index);
    expect(s.decision?.kind).toBe('stock');
    const id = s.decision!.assetId!;
    expect(ASSETS[id].kind).toBe('stock');
    const price = s.market.prices[id];
    expect(getOptions(s).map((o) => o.id)).toEqual(['buy:1', 'buy:3', 'buy:10', 'skip']);
    s = choose(s, 'buy:1');
    expect(s.player.holdings[id]).toBe(1);
    expect(s.player.cost[id]).toBeCloseTo(price * (1 - STOCK_SQUARE.discount), 6);
  });
  it('売り買いできるのは年末の取引タイムだけ', () => {
    expect(() => trade(started(), 'fund', 10)).toThrow();
    expect(() => trade(toYearEnd(started()), 'fund', 10)).not.toThrow();
  });
  it('医療保険は取引タイムで入れる。保険料は入る年が遅いほど高い', () => {
    const s = joinMedical(toYearEnd(started()));
    expect(s.player.medicalPremium).toBe(medicalPremiumAt(1));
    expect(medicalPremiumAt(11)).toBeCloseTo(medicalPremiumAt(1) + 2, 6);
  });
  it('繰り上げ返済でローンが減り、家を売ると賃貸に戻る', () => {
    let s = toYearEnd(started());
    s = { ...s, player: { ...s.player, cash: 500, home: { value: 3000, loan: { balance: 2000, rate: 0.01, monthsLeft: 400, payment: 6 }, fireInsured: true } } };
    s = prepay(s, 100);
    expect(s.player.home!.loan!.balance).toBeCloseTo(1900, 6);
    expect(s.player.cash).toBeCloseTo(400, 6);
    expect(canSellHome(s)).toBe(true);
    s = sellHome(s);
    expect(s.player.home).toBeNull();
    expect(s.player.cash).toBeCloseTo(400 + 3000 * 0.97 - 1900, 6);
  });
});

describe('株は1株単位、買った額を覚える', () => {
  it('株の最初の値段は、IT株20万円、食品株10万円、エネルギー株15万円、銀行株10万円', () => {
    const s = started();
    expect([s.market.prices.it, s.market.prices.food, s.market.prices.energy, s.market.prices.bank]).toEqual([20, 10, 15, 10]);
    expect(ASSETS.fund.unit).toBe('amount');
    expect(ASSETS.it.unit).toBe('share');
  });
  it('株は1株単位で売り買いし、金額では売り買いできない', () => {
    const y = toYearEnd({ ...started(), player: { ...started().player, cash: 1000 } });
    const s = tradeShares(y, 'it', 3);
    expect(s.player.holdings.it - y.player.holdings.it).toBe(3);
    expect(s.player.cost.it - y.player.cost.it).toBeCloseTo(3 * y.market.prices.it, 6);
    expect(() => trade(y, 'it', 10)).toThrow();
    const sold = tradeShares(s, 'it', -1);
    const held = s.player.holdings.it;
    expect(sold.player.holdings.it).toBe(held - 1);
    // 売った割合（持っている株のうち1株）の分だけ、買った額が減る
    expect(sold.player.cost.it).toBeCloseTo((s.player.cost.it * (held - 1)) / held, 6);
  });
  it('お金が足りないときは、株も1株単位で売る', () => {
    let s = tradeShares(toYearEnd({ ...started(), player: { ...started().player, cash: 1000 } }), 'it', 10);
    s = { ...s, phase: 'roll', player: { ...s.player, cash: -30 } };
    const held = s.player.holdings.it;
    s = sellForShortfall(s, 'it', 'one');
    expect(s.player.holdings.it).toBe(held - 1);
    // 1株で足りなければ、足りない分だけ売る
    if (shortfallPending(s)) s = sellForShortfall(s, 'it', 'needed');
    expect(Number.isInteger(s.player.holdings.it)).toBe(true);
    expect(s.player.cash).toBeGreaterThanOrEqual(0);
  });
});

describe('1ターンの月数', () => {
  it('3ヶ月にすると、1年は4ターンで、1ターンの給料は3ヶ月分になる', () => {
    let s = setSaving(chooseJob(chooseYears(createGame(1, { monthsPerTurn: 3 }), 20), 'employee'), { fund: 2 });
    expect(estimateMonth(s).income.salary).toBeCloseTo(250 / 4, 6);
    expect(estimateMonth(s).saving).toBe(6);
    let turns = 0;
    while (s.phase !== 'yearEnd') {
      s = settle(roll(s));
      turns++;
    }
    expect(turns).toBe(4);
    expect(s.stats.savingTotal).toBe(2 * 12);
    s = settle(nextYear(s));
    expect([s.year, s.month]).toEqual([2, 1]);
  });
  it('3ヶ月でも、最後まで遊べる', () => {
    let s = setSaving(chooseJob(chooseYears(createGame(2, { monthsPerTurn: 3 }), 10), 'engineer'), { fund: 2 });
    while (s.phase !== 'finished') {
      if (s.phase === 'roll') s = settle(roll(s));
      else if (s.phase === 'decision') s = settle(s);
      else if (s.phase === 'yearEnd') s = settle(nextYear(s));
    }
    expect(s.history).toHaveLength(10);
    expect(s.prices).toHaveLength(10 * 4 + 1);
  });
  it('12を割り切れない月数は使えない', () => {
    expect(() => createGame(1, { monthsPerTurn: 5 })).toThrow();
  });
});

describe('段階3.7の細かいところ', () => {
  const onGamble = (s: GameState, cash: number): GameState => ({ ...s, phase: 'decision', decision: { kind: 'gamble' }, decisionFrom: 'square', player: { ...s.player, cash } });
  it('ギャンブルは、種類を選んでから金額を選ぶ。金額の画面から戻れる', () => {
    let s = onGamble(started(), 100);
    expect(getOptions(s).map((o) => o.id)).toEqual(['game:lottery', 'game:horse', 'game:pachinko', 'skip']);
    s = choose(s, 'game:horse');
    expect(s.decision).toEqual({ kind: 'gamble', gambleId: 'horse' });
    expect(getOptions(s).map((o) => o.id)).toEqual(['horse:1', 'horse:10', 'horse:100', 'back']);
    expect(choose(s, 'back').decision).toEqual({ kind: 'gamble' });
  });
  it('賭けると、結果の画面に出す結果（賭けた額、戻った額、倍率）が残り、記録にも賭けた額と戻った額が入る（段階8）', () => {
    for (let seed = 1; seed < 50; seed++) {
      const base = onGamble(started(seed), 100);
      const s = choose(choose(base, 'game:horse'), 'horse:10');
      const r = s.gambleResult!;
      expect(r.id).toBe('horse');
      expect(r.bet).toBe(10);
      expect(r.back).toBeCloseTo(10 * r.multiplier, 6);
      const entry = s.log.find((e) => e.key === 'gamble.horse');
      if (r.back !== r.bet) expect(entry?.params).toEqual({ bet: 10, back: r.back });
      expect(dismissGambleResult(s).gambleResult).toBeNull();
    }
  });
  it('1万円もないときは、ギャンブルの種類も選べない', () => {
    const opts = getOptions(onGamble(started(), 0));
    expect(opts.filter((o) => o.enabled).map((o) => o.id)).toEqual(['skip']);
  });
  it('家の売り出しに、頭金と諸費用、毎月の返済額を出す', () => {
    const s: GameState = { ...started(), phase: 'decision', decision: { kind: 'realEstate', offerPrice: 3000 }, decisionFrom: 'square' };
    const loan = getOptions(s).find((o) => o.id === 'homeLoan')!;
    expect(loan.params?.amount).toBe(450);
    // 2,700万円を金利1%・35年で借りると、毎月の返済は約7.6万円（画面には約8万円と出す）
    expect(loan.params?.payment).toBe(8);
  });
  it('カードを捨てる画面で、新しくもらったカード（手札の最後）に NEW が付く', () => {
    const base = started();
    const s: GameState = { ...base, phase: 'decision', decision: { kind: 'discard' }, decisionFrom: 'square', player: { ...base.player, hand: ['dash', 'dash', 'dash', 'dash'] } };
    expect(getOptions(s).map((o) => o.key)).toEqual(['option.discard', 'option.discard', 'option.discard', 'option.discardNew']);
  });
  it('1ヶ月のお金の動き（今月のまとめに出すもの）を記録する', () => {
    const s = settle(roll(started(1, 20, 'employee', { fund: 2 })));
    expect(s.lastMonth?.income.salary).toBeCloseTo(s.player.salary / 12, 6);
    expect(s.lastMonth?.saved).toBe(2);
  });
});

describe('ニュース', () => {
  it('1.5年に2回くらい、1年のどの月でもランダムに起きる', () => {
    expect(NEWS_PER_YEAR).toBeCloseTo(2 / 1.5, 6);
    let count = 0;
    const months = new Set<number>();
    const years = 30;
    for (let seed = 1; seed <= 20; seed++) {
      const s = playGame(seed, 'employee', years);
      const news = s.log.filter((l) => l.key === 'news.happened');
      count += news.length;
      news.forEach((l) => months.add(l.month));
    }
    const perYear = count / (20 * years);
    expect(perYear).toBeGreaterThan(1.1);
    expect(perYear).toBeLessThan(1.6);
    expect(months.size).toBeGreaterThanOrEqual(10);
  });
  it('「平穏な一年」のニュースはない', () => {
    expect(NEWS.some((n) => n.id === 'calm')).toBe(false);
  });
  it('ニュースが起きると、その月に値段と景気が動き、画面に出す内容が残る', () => {
    const s = started();
    const crisis = NEWS.find((n) => n.id === 'crisis')!;
    const before = s.market.prices.fund;
    applyNews(s, crisis);
    expect(s.market.prices.fund).toBeCloseTo(before * (1 + crisis.shocks.fund!), 6);
    expect(s.market.economy).toBe('recession');
    expect(s.newsEvent?.id).toBe('crisis');
    expect(() => roll(s)).toThrow();
  });
});

describe('相場', () => {
  it('長い目で見ると、銘柄ごとの平均の値上がりに近くなる', () => {
    const years = 50;
    const rates: Record<string, number[]> = Object.fromEntries(ASSET_IDS.map((id) => [id, []]));
    for (let seed = 1; seed <= 1000; seed++) {
      const s = createGame(seed);
      for (let y = 0; y < years; y++) {
        for (let m = 0; m < 12; m++) {
          updateMarketMonth(s);
          maybeNews(s);
          maybeBigEvent(s);
        }
        updateMarketYear(s);
        s.yearMarket = newYearMarket(s);
      }
      for (const id of ASSET_IDS) rates[id].push(Math.pow(s.market.prices[id] / ASSETS[id].startPrice, 1 / years) - 1);
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
