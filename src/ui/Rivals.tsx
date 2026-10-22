// ライバル（CPU）の見せ方（design.md 12.2、12.4）。名前と駒の色、「ライバルの動き」の欄、
// 大事な場面のお知らせ、ニュースや大きなイベントでの「みんなの資産の動き」。

import { useEffect, useRef, useState } from 'react';
import { standings, type Who } from '../game/standings';
import type { GameState, LogEntry, RivalId, SeatData } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { niceStep } from './AssetChart';
import { yearTickStep } from './chartColors';
import { Confetti } from './Confetti';
import { AvatarIcon } from '../board/Avatar';
import { RIVAL_LOOKS, lookById, type Look } from '../data/characters';
import { MoneyDelta } from './Delta';
import { logLabel, visibleEntries } from './logLabel';

/** だれかのキャラクター（あなたは選んだキャラクター。design.md 10.1） */
export const lookOf = (s: GameState, w: Who): Look => (w === 'you' ? lookById(s.avatar) : RIVAL_LOOKS[w]);

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
      <AvatarIcon look={RIVAL_LOOKS[line.id]} />
      <span className="rival-line-text">
        {rivalName(line.id)}: {logLabel(line.entry)}
      </span>
      {line.entry.cash !== undefined && <MoneyDelta v={line.entry.cash} />}
    </div>
  );
}

/**
 * 右側の「ライバルの動き」の欄。新しい順に4行。自動では消えない。
 * hideMonth を渡すと、その月の動きは出さない（ライバルの番を見せる前に、結果が見えないように）
 */
export function RivalFeed({ s, hideMonth }: { s: GameState; hideMonth?: { year: number; month: number } }) {
  const [all, setAll] = useState(false);
  if (!s.rivals.length) return null;
  const lines = rivalLines(s).filter((l) => !hideMonth || l.entry.year * 100 + l.entry.month < hideMonth.year * 100 + hideMonth.month);
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
  // ボーナスマスを取られたときは、見出しを変えて、少し派手にする
  const taker = lines.find((l) => l.entry.key === 'bonus.get');
  return (
    <div className={`overlay${taker ? ' shake' : ''}`}>
      <div className={`modal rival-alert${taker ? ' bonus-taken' : ''}`}>
        <h2>{taker ? t('rivalAlert.bonusTaken', { name: rivalName(taker.id) }) : t('rivalAlert.title')}</h2>
        {lines.map((l, i) => (
          <div key={i} className="rival-alert-row" style={{ borderColor: RIVAL_LOOKS[l.id].color }}>
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
  const rows: { name: string; look: Look; v: number }[] = [
    { name: t('rival.you'), look: lookOf(s, 'you'), v: amountOf(s) },
    ...s.rivals.map((r) => ({ name: rivalName(r.id), look: RIVAL_LOOKS[r.id], v: amountOf(r) })),
  ];
  return (
    <div className="everyone-moved">
      <div className="muted">{t('rival.everyoneMoved')}</div>
      {rows.map((r) => (
        <div key={r.name} className="rival-line">
          <AvatarIcon look={r.look} />
          <span className="rival-line-text">{r.name}</span>
          {Math.round(r.v) !== 0 ? <MoneyDelta v={r.v} /> : <span className="muted">{t('rival.noChange')}</span>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 順位（design.md 12.4）

export const whoName = (w: Who) => (w === 'you' ? t('rival.you') : rivalName(w));
export const whoColor = (s: GameState, w: Who) => lookOf(s, w).color;

/** 上の欄の順位。3人の順位と純資産を横に並べ、あなたの順位が上がったら短く光る。スマホでは、あなたの順位だけ */
export function RankStrip({ s }: { s: GameState }) {
  const list = standings(s);
  const myRank = list.find((x) => x.who === 'you')!.rank;
  const prev = useRef(myRank);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (myRank < prev.current) setFlash(Date.now());
    prev.current = myRank;
  }, [myRank]);
  if (!s.rivals.length) return null;
  return (
    <div className={`rank-strip${flash ? ' rank-up' : ''}`} key={flash}>
      {list.map((x) => (
        <span key={x.who} className={`rank-item${x.who === 'you' ? ' me' : ''}`}>
          <AvatarIcon look={lookOf(s, x.who)} />
          <b>{t('rank.nth', { n: x.rank })}</b>
          <span className="rank-name">{whoName(x.who)}</span>
          <span className="rank-worth">{formatMoney(x.worth)}</span>
        </span>
      ))}
    </div>
  );
}

/** 年末の決算の順位表（順位、名前、純資産、去年からの増減） */
export function RankTable({ s }: { s: GameState }) {
  if (!s.rivals.length) return null;
  return (
    <table className="worth-table rank-table">
      <tbody>
        {standings(s).map((x) => (
          <tr key={x.who} className={x.who === 'you' ? 'me' : undefined}>
            <td>
              <b>{t('rank.nth', { n: x.rank })}</b>
            </td>
            <td>
              <AvatarIcon look={lookOf(s, x.who)} /> {whoName(x.who)}
            </td>
            <td className="ledger-money">{formatMoney(x.worth)}</td>
            <td className="ledger-money">
              <MoneyDelta v={x.worth - x.lastYearWorth} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** 結果の画面の最後の順位と、投資の成績の表彰（design.md 9章） */
export function FinalRanking({ s }: { s: GameState }) {
  if (!s.rivals.length) return null;
  const list = standings(s);
  const me = list.find((x) => x.who === 'you')!;
  const byReturn = [...list].sort((a, b) => b.investReturn - a.investReturn);
  const best = byReturn[0];
  return (
    <div className="final-ranking">
      {me.rank === 1 && <Confetti count={70} seed={7} />}
      <div className="final-headline">{t('result.yourRank', { n: me.rank })}</div>
      <div className="final-list">
        {list.map((x) => (
          <div key={x.who} className={`final-row${x.who === 'you' ? ' me' : ''}`}>
            <span className="final-medal">{MEDALS[x.rank - 1] ?? ''}</span>
            <AvatarIcon look={lookOf(s, x.who)} />
            <span className="final-name">{whoName(x.who)}</span>
            <strong>{formatMoney(x.worth)}</strong>
          </div>
        ))}
      </div>
      <div className="card invest-award">
        <h4>{t('result.investAward')}</h4>
        {best.investReturn > 0 && <div className="invest-award-winner">{t('result.investAwardWinner', { name: whoName(best.who) })}</div>}
        {byReturn.map((x) => (
          <div key={x.who} className="rival-line">
            <AvatarIcon look={lookOf(s, x.who)} />
            <span className="rival-line-text">{whoName(x.who)}</span>
            <span className={x.investReturn >= 0 ? 'plus' : 'minus'}>{`${formatSigned(x.investReturn * 100)}%`}</span>
          </div>
        ))}
        <p className="muted">{t('result.investAwardNote')}</p>
      </div>
    </div>
  );
}

/** 3人の純資産の移り変わり（1つのグラフに重ねる。お金の使い方のちがいで、どう差が開いたかを見せる） */
export function WorthRaceChart({ s }: { s: GameState }) {
  if (!s.rivals.length || s.history.length < 1) return null;
  const series: { who: Who; values: number[] }[] = [
    { who: 'you', values: s.history.map((r) => r.netWorth) },
    ...s.rivals.map((r) => ({ who: r.id as Who, values: r.history.map((h) => h.netWorth) })),
  ];
  const W = 640;
  const H = 240;
  const pad = { l: 74, r: 14, t: 12, b: 26 };
  const all = series.flatMap((x) => x.values);
  const lo = Math.min(0, ...all);
  const hi = Math.max(1, ...all);
  const step = niceStep(hi - lo);
  const top = Math.ceil(hi / step) * step;
  const bottom = Math.floor(lo / step) * step;
  const n = s.history.length;
  const x = (i: number) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((top - v) / (top - bottom || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-6; v += step) ticks.push(v);
  const tick = yearTickStep(n);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('result.race')}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-sub)">
              {formatMoney(v)}
            </text>
          </g>
        ))}
        {series.map((ser) => (
          <path
            key={ser.who}
            d={ser.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')}
            fill="none"
            stroke={whoColor(s, ser.who)}
            strokeWidth={ser.who === 'you' ? 3.5 : 2.5}
          />
        ))}
        {s.history
          .filter((r) => r.year % tick === 0 || r.year === 1)
          .map((r) => (
            <text key={r.year} x={x(s.history.indexOf(r))} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-sub)">
              {t('hud.year', { year: r.year })}
            </text>
          ))}
      </svg>
      <div className="legend">
        {series.map((ser) => (
          <span key={ser.who}>
            <i style={{ background: whoColor(s, ser.who) }} />
            {whoName(ser.who)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** あなたがボーナスマスに止まったときの画面（design.md 3.10） */
export function BonusModal({ amount, onClose }: { amount: number; onClose: () => void }) {
  return (
    <div className="overlay">
      <Confetti count={60} seed={3} />
      <div className="modal bonus-get">
        <div className="bonus-get-star">★</div>
        <h2>{t('bonus.getTitle')}</h2>
        <div className="bonus-get-amount">+{formatMoney(amount)}</div>
        <p className="muted">{t('bonus.getText')}</p>
        <div className="options">
          <button onClick={onClose}>{t('option.ok')}</button>
        </div>
      </div>
    </div>
  );
}
