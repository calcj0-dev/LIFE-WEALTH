import { describe, expect, it } from 'vitest';
import { POLICY_PRESETS } from '../data/assets';
import { JOB_IDS } from '../data/jobs';
import { NEWS } from '../data/news';
import { choose, chooseJob, continueYear, createGame, getOptions, nextYear, roll, setPolicy } from '../game/engine';
import type { GameState } from '../game/types';
import { has } from '../i18n';

/** ゲームを最後まで遊び、画面に出る文字の番号をすべて集める */
function collectKeys(seed: number, jobIndex: number): Set<string> {
  const keys = new Set<string>();
  let s: GameState = setPolicy(chooseJob(createGame(seed), JOB_IDS[jobIndex % JOB_IDS.length]), POLICY_PRESETS.balanced);
  let n = seed;
  const rand = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  while (s.phase !== 'finished') {
    if (s.phase === 'yearStart') {
      keys.add(`news.${s.newsId}.title`);
      s = continueYear(s);
    } else if (s.phase === 'roll') s = roll(s);
    else if (s.phase === 'decision') {
      const d = s.decision!;
      if (d.kind === 'life' || d.kind === 'good' || d.kind === 'bad') {
        keys.add(`event.${d.eventId}.title`);
        keys.add(`event.${d.eventId}.text`);
      } else if (d.kind === 'notice') {
        keys.add(`${d.messageKey}.title`);
      } else {
        keys.add(`${d.kind}.title`);
      }
      const opts = getOptions(s);
      opts.forEach((o) => keys.add(o.key));
      const enabled = opts.filter((o) => o.enabled);
      s = choose(s, enabled[Math.floor(rand() * enabled.length)].id);
    } else if (s.phase === 'yearEnd') {
      Object.keys(s.lastSettlement!.income).forEach((k) => keys.add(`settle.${k}`));
      Object.keys(s.lastSettlement!.expense).forEach((k) => keys.add(`settle.${k}`));
      s = nextYear(s);
    }
  }
  return keys;
}

describe('言語ファイル', () => {
  it('ゲーム中に出る文字が、すべて ja.json にある', () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) collectKeys(seed, seed).forEach((k) => keys.add(k));
    NEWS.forEach((n) => keys.add(`news.${n.id}.text`));
    JOB_IDS.forEach((j) => keys.add(`job.${j}`));
    const missing = [...keys].filter((k) => !has(k));
    expect(missing).toEqual([]);
  });
});
