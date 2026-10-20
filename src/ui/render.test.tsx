import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board } from '../board/Board';
import { Roulette } from '../board/Roulette';
import { POLICY_PRESETS } from '../data/assets';
import { playGame } from '../game/autoplay';
import { choose, chooseJob, continueYear, createGame, getOptions, nextYear, roll, setPolicy } from '../game/engine';
import type { GameState } from '../game/types';
import { App } from '../App';
import { Hud, SidePanel } from './GameScreen';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal } from './Modals';
import { Result } from './Result';
import { PriceChart, ReturnTable } from './PriceCharts';
import { BudgetCard, JobRoulette, PolicySetup } from './Setup';
import { AssetManager } from './AssetManager';

const noop = () => {};

describe('画面', () => {
  it('タイトル画面にバージョンが出る', () => {
    const html = renderToString(<App />);
    expect(html).toContain('LIFE');
    expect(html).toMatch(/v\d+\.\d+\.\d+/);
  });
  it('職業選択と投資方針の画面が描ける', () => {
    const g = createGame(1);
    expect(renderToString(<JobRoulette s={g} onDone={noop} />)).toContain('会社員');
    expect(renderToString(<BudgetCard s={chooseJob(g, 'athlete')} title="家計" />)).toContain('職業の固定費');
    const policy = renderToString(<PolicySetup doneLabel="始める" onDone={noop} />);
    expect(policy).toContain('自動投資');
    expect(policy).toContain('投資しない');
    expect(policy).toContain('バランス型');
  });
  it('1年の流れのどの場面も、エラーなく描ける', () => {
    let s: GameState = setPolicy(chooseJob(createGame(5), 'employee'), POLICY_PRESETS.balanced);
    for (let year = 0; year < 44; year++) {
      expect(renderToString(<NewsModal s={s} onNext={noop} />)).toContain('ニュース');
      s = continueYear(s);
      while (s.phase === 'decision') {
        renderToString(<DecisionModal s={s} onChoose={noop} />);
        s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
      }
      s = roll(s);
      renderToString(<Board position={s.player.position} overview={false} />);
      renderToString(<Board position={s.player.position} overview />);
      renderToString(<Roulette value={s.lastRoll} spinning={false} canSpin={false} onSpin={noop} />);
      while (s.phase === 'decision') {
        const html = renderToString(<DecisionModal s={s} onChoose={noop} />);
        expect(html).not.toMatch(/(event|option|square|marriage)\.[a-zA-Z]+\.?[a-zA-Z]*</);
        s = choose(s, getOptions(s).find((o) => o.enabled)!.id);
      }
      renderToString(<Hud s={s} />);
      renderToString(<SidePanel s={s} onOpenHistory={noop} onOpenManager={noop} />);
      renderToString(<AssetManager s={s} onChange={noop} onClose={noop} />);
      renderToString(<HistoryModal s={s} onClose={noop} />);
      const yearEnd = renderToString(<YearEndModal s={s} last={false} onNext={noop} />);
      expect(yearEnd).not.toMatch(/>(event|auto|marriage|gamble|realEstate|insurance|shortfall|loan|job|school|university|debt)(\.[a-zA-Z]+)*</);
      s = nextYear(s);
    }
    expect(s.phase).toBe('finished');
  });
  it('値動きのチャートと年利の表が描ける', () => {
    const s = playGame(12, 'employee', 'balanced');
    const chart = renderToString(<PriceChart history={s.history} />);
    expect(chart).toContain('<path');
    expect(chart).toContain('物価');
    const table = renderToString(<ReturnTable history={s.history} />);
    expect(table).toContain('これまでの年平均（44年）');
    expect(table.match(/<tr/g)!.length).toBe(1 + 1 + 44);
    expect(renderToString(<PriceChart history={[]} />)).toContain('1年目');
  });
  it('結果画面が描ける', () => {
    const s = playGame(11, 'engineer', 'aggressive');
    const html = renderToString(<Result s={s} onAgain={noop} />);
    expect(html).toContain('ランク');
    expect(html).toContain('<path');
  });
});
