import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board } from '../board/Board';
import { Roulette } from '../board/Roulette';
import { playGame } from '../game/autoplay';
import { choose, chooseJob, dismissBigEvent, shortfallPending, dismissNews, chooseYears, createGame, estimateMonth, getOptions, nextYear, roll, setSaving } from '../game/engine';
import type { GameState } from '../game/types';
import { App } from '../App';
import { FeedPanel } from './Feed';
import { Hud, SidePanel } from './GameScreen';
import { VerticalLedger, rowsOf, shownTotal } from './Ledger';
import { TurnSummary } from './TurnSummary';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal } from './Modals';
import { AssetPriceChart, PriceChart, ReturnTable } from './PriceCharts';
import { Result } from './Result';
import { BudgetCard, JobRoulette, YearsSetup, minutesFor } from './Setup';
import { SavingSetup, TradeModal } from './Trade';
import { CardHand } from './Cards';
import { moneyLevelOf } from './AnimatedMoney';
import { BigEventModal } from './BigEvent';
import { ShortfallModal } from './Shortfall';
import { payShortfall } from '../game/autoplay';

const noop = () => {};

/** 画面に、文字の番号（例: event.travel.title）がそのまま出ていないか */
const RAW_KEY = />(event|option|square|marriage|birth|school|news|settle|label|auto|job|gamble|realEstate|shortfall|feed|worth|stock|trade|saving|insurance|loan|setup|budget|panel|card|cards|bonus|discard|talk|bigEvent)(\.[a-zA-Z]+)+</;

describe('段階3.7の画面', () => {
  it('家計の合計は、画面に出す行を足した数と必ず合う', () => {
    const items = { a: 30.6, b: 0.83, c: 2.5 };
    expect(rowsOf(items).map((r) => r.v)).toEqual([31, 1, 3]);
    expect(shownTotal(items)).toBe(35);
  });
  it('今月のまとめに、出来事・お給料・銀行預金と純資産の前後が出る（ニュースは出さない）', () => {
    const html = renderToString(
      <TurnSummary
        data={{
          year: 3,
          month: 4,
          monthsPerTurn: 1,
          entries: [{ year: 3, month: 4, key: 'event.appliance', cash: -10 }],
          flow: { year: 3, month: 4, income: { salary: 21 }, expense: { living: 17 }, saved: 3, repaid: 0 },
          cashBefore: 221,
          cashAfter: 212,
          worthBefore: 441,
          worthAfter: 410,
        }}
        onClose={noop}
      />,
    );
    expect(html).not.toContain('ニュース');
    for (const text of ['3年目 4月のまとめ', '家電の故障', 'お給料など', '221万円', '212万円', '441万円', '410万円']) expect(html).toContain(text);
    expect(html).not.toMatch(RAW_KEY);
  });
  it('ニュースの画面の「あなたの資産」は、表の行を足した数と合う', () => {
    const s = { rivals: [], newsEvent: { id: 'rateUp', year: 3, month: 4, prevEconomy: 'normal', rates: { gold: 0.1, bank: 0.1 }, amounts: { gold: 0.6, bank: 0.6 }, moved: 1.2 } } as unknown as GameState;
    const html = renderToString(<NewsModal s={s} onNext={noop} />);
    expect(html).toContain('利上げ');
    expect(html).toMatch(/\+(<!-- -->)?2万円/);
  });
});

describe('お金の光り方', () => {
  it('ニュースと大きなイベントは強、マスの出来事や売り買いは中、それ以外は弱', () => {
    const e = (key: string, extra = {}) => ({ year: 1, month: 1, key, ...extra });
    expect(moneyLevelOf([e('news.happened', { notice: true })])).toBe('strong');
    expect(moneyLevelOf([e('bigEvent.crash', { notice: true })])).toBe('strong');
    expect(moneyLevelOf([e('event.travel', { cash: -15 })])).toBe('medium');
    expect(moneyLevelOf([e('trade.buy')])).toBe('medium');
    expect(moneyLevelOf([])).toBe('weak');
  });
});

describe('画面', () => {
  it('タイトル画面にバージョンが出る', () => {
    const html = renderToString(<App />);
    expect(html).toContain('LIFE');
    expect(html).toMatch(/v\d+\.\d+\.\d+/);
  });
  it('年数を選ぶ画面に、10〜50年と遊ぶ時間の目安が出る', () => {
    const html = renderToString(<YearsSetup onDone={noop} />);
    for (const y of [10, 20, 30, 40, 50]) expect(html).toContain(`${y}年`);
    expect(html).toContain('おすすめ');
    expect(minutesFor(20)).toBe(30);
  });
  it('職業のルーレットと、スタート時の家計が描ける', () => {
    const g = chooseYears(createGame(1), 20);
    expect(renderToString(<JobRoulette s={g} onDone={noop} />)).toContain('会社員');
    const athlete = chooseJob(g, 'athlete');
    expect(renderToString(<BudgetCard s={athlete} title="家計" />)).toContain('残る見込み');
    const plan = estimateMonth(athlete);
    const ledger = renderToString(<VerticalLedger income={plan.income} expense={plan.expense} saved={3} />);
    expect(ledger).toContain('職業の固定費');
    expect(ledger).toContain('積み立てに回した');
    const saving = renderToString(<SavingSetup s={athlete} onDone={noop} />);
    expect(saving).toContain('積み立ての金額を決めよう');
    expect(saving).toContain('投資信託');
    expect(saving).toContain('ゴールド');
    expect(saving).not.toContain('IT株');
    expect(saving).not.toContain('おすすめ（');
    const tradeHtml = renderToString(<TradeModal s={setSaving(athlete, { gold: 2 })} onChange={noop} onDone={noop} />);
    for (const text of ['売り買い', '積み立て', '保険・家', '持っている', '持っていない', '投資の合計']) expect(tradeHtml).toContain(text);
    expect(renderToString(<BudgetCard s={setSaving(athlete, { fund: 3 })} title="家計" />)).toContain('積み立てで毎月 3万円');
  });
  it('1年の流れのどの場面も、エラーなく描ける', () => {
    let s: GameState = setSaving(chooseJob(chooseYears(createGame(5), 10), 'employee'), { fund: 2, gold: 1 });
    while (s.phase !== 'finished') {
      if (s.newsEvent && !s.bigEvent) {
        const html = renderToString(<NewsModal s={s} onNext={noop} />);
        expect(html).toContain('のニュース');
        expect(html).not.toMatch(RAW_KEY);
        s = dismissNews(s);
        continue;
      }
      if (s.bigEvent) {
        expect(renderToString(<BigEventModal s={s} onClose={noop} />)).not.toMatch(RAW_KEY);
        s = dismissBigEvent(s);
        continue;
      }
      if (shortfallPending(s)) {
        const html = renderToString(<ShortfallModal s={s} onChange={noop} />);
        expect(html).toContain('お金が足りません');
        expect(html).not.toMatch(RAW_KEY);
        s = payShortfall(s);
        continue;
      }
      if (s.phase === 'roll') {
        const hand = renderToString(<CardHand s={s} canUse onMove={noop} onTrade={noop} />);
        expect(hand).toContain('ボーナスマスまで');
        expect(hand).not.toMatch(RAW_KEY);
        s = roll(s);
        expect(renderToString(<Board position={s.player.position} overview={false} bonus={s.bonusSquare} />)).toContain('BONUS');
        renderToString(<Roulette value={s.lastRoll} spinning={false} canSpin={false} onSpin={noop} />);
      } else if (s.phase === 'decision') {
        const html = renderToString(<DecisionModal s={s} onChoose={noop} />);
        expect(html).not.toMatch(RAW_KEY);
        const opts = getOptions(s);
        s = choose(s, (opts.find((o) => o.id === 'skip' && o.enabled) ?? opts.find((o) => o.enabled))!.id);
      } else if (s.phase === 'yearEnd') {
        const html = [
          renderToString(<YearEndModal s={s} onNext={noop} onTrade={noop} />),
          renderToString(<Hud s={s} />),
          renderToString(<SidePanel s={s} onOpenHistory={noop} onOpenFeed={noop} />),
          renderToString(<FeedPanel s={s} onClose={noop} />),
          renderToString(<HistoryModal s={s} onClose={noop} />),
          renderToString(<TradeModal s={s} onChange={noop} onDone={noop} />),
        ].join('');
        expect(html).toContain('取引タイム');
        expect(html).toContain('決算');
        expect(html).toContain('できごとの履歴');
        expect(html).not.toMatch(RAW_KEY);
        s = nextYear(s);
      }
    }
    expect(s.phase).toBe('finished');
  });
  it('値動きのチャートと年利の表が描ける', () => {
    const s = playGame(12, 'employee', 20);
    const chart = renderToString(<PriceChart points={s.prices} />);
    expect(chart).toContain('<path');
    expect(chart).toContain('物価');
    expect(chart).toContain('IT株');
    const table = renderToString(<ReturnTable history={s.history} />);
    expect(table).toContain('これまでの年平均（20年）');
    expect(table.match(/<tr/g)!.length).toBe(1 + 1 + 20);
    expect(renderToString(<PriceChart points={[]} />)).toContain('1年目');
    const it = renderToString(<AssetPriceChart points={s.prices} id="it" avgCost={20} />);
    expect(it).toContain('<path');
    expect(it).toContain('買った平均の値段（20万円）');
    expect(renderToString(<AssetPriceChart points={s.prices} id="fund" />)).toContain('ゲームの始めからの値動き');
  });
  it('ライバルがいると、上の欄・決算・結果に順位が出る', () => {
    const s = playGame(4, 'employee', 10);
    expect(renderToString(<Hud s={s} />)).toContain('位');
    const html = renderToString(<Result s={s} onAgain={noop} />);
    for (const text of ['あなたは', 'コツコツさん', 'イケイケさん', '投資の成績', 'みんなの純資産の移り変わり']) expect(html).toContain(text);
    expect(html).not.toMatch(RAW_KEY);
  });
  it('結果画面に、最後の純資産が出る', () => {
    const s = playGame(11, 'engineer', 10);
    const html = renderToString(<Result s={s} onAgain={noop} />);
    expect(html).toContain('最後の純資産');
    expect(html).toContain('10年間の人生');
    expect(html).toContain('<path');
    expect(html).not.toContain('ランク');
  });
});
