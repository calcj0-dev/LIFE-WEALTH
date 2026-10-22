// ライバル（CPU）の見せ方（design.md 12.2、12.4）。名前と駒の色、「ライバルの動き」の欄、
// 大事な場面のお知らせ、ニュースや大きなイベントでの「みんなの資産の動き」。

import { useState } from 'react';
import type { GameState, LogEntry, RivalId, SeatData } from '../game/types';
import { t } from '../i18n';
import { MoneyDelta } from './Delta';
import { logLabel, visibleEntries } from './logLabel';

/** 駒の色。あなたはオレンジ、コツコツさんは緑、イケイケさんは紫（design.md 12.4） */
export const PLAYER_COLOR = '#ff7a45';
export const RIVAL_COLORS: Record<RivalId, string> = { steady: '#3cb371', bold: '#9b5de5' };

export const rivalName = (id: RivalId) => t(`rival.${id}`);

/** ライバルの動きの欄に出さない記録（数が多く、動きとして目立たないもの） */
const QUIET = ['news.happened', 'saving.change', 'stock.skip', 'card.use', 'card.get', 'card.getLucky', 'card.discard'];

/** 1件の動き（だれの、どの記録か） */
interface RivalLine {
  id: RivalId;
  entry: LogEntry;
}

/** ライバルの動きを、新しい順に並べる。from を渡すと、その件数より後に増えた記録だけ */
export function rivalLines(s: GameState, from?: number[]): RivalLine[] {
  const lines: (RivalLine & { order: number })[] = [];
  s.rivals.forEach((r, i) => {
    const start = from?.[i] ?? 0;
    r.log
      .slice(start)
      .filter((e) => (visibleEntries([e]).length > 0 || e.key.startsWith('trade.')) && !QUIET.includes(e.key))
      // 大きなイベントは全員に起きるので、お金が動いたときだけ出す（起きたことは、大きなイベントの画面で見せる）
      .filter((e) => !(e.key.startsWith('bigEvent.') && e.cash === undefined))
      .forEach((entry, k) => lines.push({ id: r.id, entry, order: (entry.year * 100 + entry.month) * 1000 + k }));
  });
  return lines.sort((a, b) => b.order - a.order);
}

/** 大事な動き（ポップアップで知らせる）: 結婚、ボーナスマス、大きな損（design.md 12.2） */
export function isImportant(e: LogEntry): boolean {
  return e.key === 'marriage.marry' || e.key === 'bonus.get' || e.key.endsWith('.debt') || (e.cash !== undefined && e.cash <= -50);
}

function Line({ line }: { line: RivalLine }) {
  return (
    <div className="rival-line">
      <span className="rival-dot" style={{ background: RIVAL_COLORS[line.id] }} />
      <span className="rival-line-text">
        {rivalName(line.id)}: {logLabel(line.entry)}
      </span>
      {line.entry.cash !== undefined && <MoneyDelta v={line.entry.cash} />}
    </div>
  );
}

/** 右側の「ライバルの動き」の欄。新しい順に4行。自動では消えない */
export function RivalFeed({ s }: { s: GameState }) {
  const [all, setAll] = useState(false);
  if (!s.rivals.length) return null;
  const lines = rivalLines(s);
  return (
    <div className="card rival-feed">
      <h4>{t('rivalFeed.title')}</h4>
      {lines.length === 0 && <div className="muted">{t('rivalFeed.empty')}</div>}
      {lines.slice(0, 4).map((l, i) => (
        <Line key={i} line={l} />
      ))}
      {lines.length > 4 && (
        <button className="secondary small" onClick={() => setAll(true)}>
          {t('rivalFeed.more')}
        </button>
      )}
      {all && (
        <div className="overlay">
          <div className="modal">
            <h2>{t('rivalFeed.title')}</h2>
            <div className="rival-feed-all">
              {lines.slice(0, 300).map((l, i) => (
                <div key={i} className="rival-feed-row">
                  <span className="muted">{t('rivalFeed.date', { year: l.entry.year, month: l.entry.month })}</span>
                  <Line line={l} />
                </div>
              ))}
            </div>
            <div className="options">
              <button onClick={() => setAll(false)}>{t('option.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 大事な動きのお知らせ（ライバルの結婚、ボーナスマスを取られた、大きな損）。「OK」で閉じる */
export function RivalAlertModal({ lines, onClose }: { lines: RivalLine[]; onClose: () => void }) {
  return (
    <div className="overlay">
      <div className="modal rival-alert">
        <h2>{t('rivalAlert.title')}</h2>
        {lines.map((l, i) => (
          <div key={i} className="rival-alert-row" style={{ borderColor: RIVAL_COLORS[l.id] }}>
            <Line line={l} />
          </div>
        ))}
        <div className="options">
          <button onClick={onClose}>{t('option.ok')}</button>
        </div>
      </div>
    </div>
  );
}

/** ニュースや大きなイベントで、みんなの資産がいくら動いたか（design.md 12.2） */
export function EveryoneMoved({ s, amountOf }: { s: GameState; amountOf: (v: SeatData) => number }) {
  if (!s.rivals.length) return null;
  const rows: { name: string; color: string; v: number }[] = [
    { name: t('rival.you'), color: PLAYER_COLOR, v: amountOf(s) },
    ...s.rivals.map((r) => ({ name: rivalName(r.id), color: RIVAL_COLORS[r.id], v: amountOf(r) })),
  ];
  return (
    <div className="everyone-moved">
      <div className="muted">{t('rival.everyoneMoved')}</div>
      {rows.map((r) => (
        <div key={r.name} className="rival-line">
          <span className="rival-dot" style={{ background: r.color }} />
          <span className="rival-line-text">{r.name}</span>
          {Math.round(r.v) !== 0 ? <MoneyDelta v={r.v} /> : <span className="muted">{t('rival.noChange')}</span>}
        </div>
      ))}
    </div>
  );
}
