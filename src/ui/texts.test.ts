import { describe, expect, it } from 'vitest';
import { payShortfall } from '../game/autoplay';
import { BOARD } from '../data/board';
import { JOB_IDS } from '../data/jobs';
import { NEWS } from '../data/news';
import { choose, chooseJob, dismissBigEvent, dismissNews, chooseYears, createGame, getOptions, joinMedical, nextYear, roll, setSaving, trade, tradeShares, shortfallPending } from '../game/engine';
import type { GameState } from '../game/types';
import { has } from '../i18n';
import { describeDecision } from './decisionText';
import { logLabel } from './logLabel';

/** ゲームを最後まで遊び、画面に出る文字の番号をすべて集める */
function collectKeys(seed: number, jobIndex: number): { keys: Set<string>; labels: Set<string> } {
  const keys = new Set<string>();
  const labels = new Set<string>();
  let s: GameState = setSaving(chooseJob(chooseYears(createGame(seed), 30), JOB_IDS[jobIndex % JOB_IDS.length]), { fund: 2 });
  let n = seed;
  const rand = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  while (s.phase !== 'finished') {
    if (s.newsEvent) {
      keys.add(`news.${s.newsEvent.id}.title`).add(`news.${s.newsEvent.id}.text`);
      s = dismissNews(s);
      continue;
    }
    if (s.bigEvent) {
      keys.add(`bigEvent.${s.bigEvent.id}.title`).add(`bigEvent.${s.bigEvent.id}.text`);
      s = dismissBigEvent(s);
      continue;
    }
    if (shortfallPending(s)) {
      keys.add('shortfall.title').add('shortfall.text');
      s = payShortfall(s);
      continue;
    }
    if (s.phase === 'roll') s = roll(s);
    else if (s.phase === 'decision') {
      const d = s.decision!;
      if (d.kind === 'event') keys.add(`event.${d.eventId}.title`).add(`event.${d.eventId}.text`);
      else if (d.kind === 'talk') keys.add(`talk.${d.talkId}.title`).add(`talk.${d.talkId}.text`);
      else if (d.kind === 'notice') keys.add(`${d.messageKey}.title`).add(`${d.messageKey}.text`);
      else keys.add(`${d.kind}.title`).add(`${d.kind}.text`);
      describeDecision(s);
      const opts = getOptions(s);
      opts.forEach((o) => keys.add(o.key));
      const enabled = opts.filter((o) => o.enabled);
      s = choose(s, enabled[Math.floor(rand() * enabled.length)].id);
    } else if (s.phase === 'yearEnd') {
      Object.keys(s.lastSettlement!.income).forEach((k) => keys.add(`settle.${k}`));
      Object.keys(s.lastSettlement!.expense).forEach((k) => keys.add(`settle.${k}`));
      // 取引タイムで、いろいろな操作をしてみる
      if (s.year === 2) s = tradeShares(tradeShares(trade(trade(s, 'fund', 10), 'fund', -5), 'it', 2), 'it', -1);
      if (s.year === 3 && s.player.medicalPremium === null) s = joinMedical(s);
      s = nextYear(s);
    }
  }
  // 記録の名前が、番号のまま出ていないか
  for (const l of s.log) labels.add(logLabel(l) === l.key ? l.key : '');
  return { keys, labels };
}

describe('言語ファイル', () => {
  it('ゲーム中に出る文字が、すべて ja.json にある', () => {
    const keys = new Set<string>();
    const raw = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const r = collectKeys(seed, seed);
      r.keys.forEach((k) => keys.add(k));
      r.labels.forEach((k) => k && raw.add(k));
    }
    NEWS.forEach((n) => keys.add(`news.${n.id}.text`));
    JOB_IDS.forEach((j) => keys.add(`job.${j}`));
    BOARD.forEach((sq) => keys.add(`squareType.${sq.type}`));
    expect([...keys].filter((k) => !has(k))).toEqual([]);
    expect([...raw]).toEqual([]);
  });
});
