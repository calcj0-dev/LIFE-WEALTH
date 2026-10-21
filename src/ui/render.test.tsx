import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board } from '../board/Board';
import { Roulette } from '../board/Roulette';
import { playGame } from '../game/autoplay';
import { choose, chooseJob, dismissBigEvent, chooseYears, createGame, estimateMonth, getOptions, nextYear, roll, setSaving } from '../game/engine';
import type { GameState } from '../game/types';
import { App } from '../App';
import { AutoPopup, FeedPanel, NewsBrief, YearEndBrief } from './Feed';
import { Hud, SidePanel } from './GameScreen';
import { LedgerTable, NetWorthTable } from './Ledger';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal } from './Modals';
import { PriceChart, ReturnTable } from './PriceCharts';
import { Result } from './Result';
import { BudgetCard, JobRoulette, YearsSetup, minutesFor } from './Setup';
import { SavingSetup, TradeModal } from './Trade';
import { CardHand } from './Cards';
import { BigEventModal } from './BigEvent';

const noop = () => {};

/** 画面に、文字の番号（例: event.travel.title）がそのまま出ていないか */
const RAW_KEY = />(event|option|square|marriage|birth|school|news|settle|label|auto|job|gamble|realEstate|shortfall|feed|worth|stock|trade|saving|insurance|loan|setup|budget|panel|card|cards|bonus|discard)(\.[a-zA-Z]+)+</;

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
    expect(renderToString(<LedgerTable income={plan.income} expense={plan.expense} />)).toContain('職業の固定費');
    const saving = renderToString(<SavingSetup s={athlete} onDone={noop} />);
    expect(saving).toContain('積み立ての金額を決めよう');
    expect(saving).toContain('投資信託');
    expect(saving).toContain('ゴールド');
    expect(saving).not.toContain('IT株');
    expect(renderToString(<BudgetCard s={setSaving(athlete, { fund: 3 })} title="家計" />)).toContain('積み立てで毎月 3万円');
  });
  it('1年の流れのどの場面も、エラーなく描ける', () => {
    let s: GameState = setSaving(chooseJob(chooseYears(createGame(5), 10), 'employee'), { fund: 2, gold: 1 });
    while (s.phase !== 'finished') {
      if (s.bigEvent) {
        expect(renderToString(<BigEventModal s={s} onClose={noop} />)).not.toMatch(RAW_KEY);
        s = dismissBigEvent(s);
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
        s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
      } else if (s.phase === 'yearEnd') {
        const html = [
          renderToString(<NewsModal s={s} onNext={noop} />),
          renderToString(<AutoPopup onClose={noop}><NewsBrief s={s} /></AutoPopup>),
          renderToString(<AutoPopup onClose={noop}><YearEndBrief s={s} /></AutoPopup>),
          renderToString(<YearEndModal s={s} onNext={noop} />),
          renderToString(<NetWorthTable s={s} />),
          renderToString(<Hud s={s} />),
          renderToString(<SidePanel s={s} onOpenHistory={noop} onOpenFeed={noop} />),
          renderToString(<FeedPanel s={s} onClose={noop} />),
          renderToString(<HistoryModal s={s} onClose={noop} />),
          renderToString(<TradeModal s={s} onChange={noop} onDone={noop} />),
        ].join('');
        expect(html).toContain('取引タイム');
        expect(html).toContain('年末のニュース');
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
