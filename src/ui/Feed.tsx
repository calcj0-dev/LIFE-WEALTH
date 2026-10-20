// ふつうの年のニュースと決算を見せる「自動で閉じるポップアップ」と、できごとの履歴のパネル（design.md 2.2）。

import { useEffect, useState } from 'react';
import { newsById } from '../game/market';
import type { GameState, YearRecord } from '../game/types';
import { formatMoney, t } from '../i18n';
import { HappinessDelta, MoneyDelta } from './Delta';
import { MoneySummary } from './Ledger';
import { logLabel, movingEntries } from './logLabel';

/** 自動で閉じるまでの時間（ミリ秒） */
export const AUTO_POPUP_MS = 3000;

/** 約3秒で自動で閉じるポップアップ。押せばすぐ閉じる */
export function AutoPopup({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, AUTO_POPUP_MS);
    return () => clearTimeout(id);
    // onClose は表示のたびに変わらないよう呼び出し側で作る
  }, []);
  return (
    <div className="overlay auto-overlay" onClick={onClose} role="dialog">
      <div className="modal auto-popup">
        {children}
        <div className="auto-bar">
          <div style={{ animationDuration: `${AUTO_POPUP_MS}ms` }} />
        </div>
        <div className="muted auto-hint">{t('auto.close')}</div>
      </div>
    </div>
  );
}

/** ふつうの年のニュース（短く） */
export function NewsBrief({ s }: { s: GameState }) {
  const news = newsById(s.newsId!);
  const amounts = s.marketChange?.amounts;
  const total = amounts ? Object.values(amounts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <div className="muted">{t('auto.news.heading', { age: s.player.age })}</div>
      <h2>{t(`news.${news.id}.title`)}</h2>
      <p>{t(`news.${news.id}.text`)}</p>
      {Math.round(total) !== 0 && (
        <p className="summary-line">
          {t('news.table.mine')}: <MoneyDelta v={total} big />
        </p>
      )}
    </>
  );
}

/** ふつうの年の決算（短く） */
export function YearEndBrief({ s }: { s: GameState }) {
  const rec = s.history[s.history.length - 1];
  const b = rec.breakdown;
  const change = b.work + b.investment + b.revaluation + b.other;
  return (
    <>
      <h2>{t('auto.yearEnd.heading', { age: rec.age })}</h2>
      <MoneySummary income={rec.incomeTotal ?? 0} expense={rec.expenseTotal ?? 0} />
      <div className="summary-row">
        <span>{t('worth.line', { prev: formatMoney(rec.netWorth - change), now: formatMoney(rec.netWorth) })}</span>
        <MoneyDelta v={change} big />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- できごとの履歴

interface YearGroup {
  age: number;
  rec?: YearRecord;
  newsId?: string;
}

/** 年ごとに、ニュース・マスの出来事・決算を、新しい順に並べたパネル */
export function FeedPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const years: YearGroup[] = s.history.map((rec) => ({ age: rec.age, rec, newsId: rec.newsId }));
  // 今の年（まだ決算前）も、ニュースと出来事を出す
  if (!s.history.some((r) => r.age === s.player.age) && s.newsId) years.push({ age: s.player.age, newsId: s.newsId });
  const toggle = (key: string) => setOpen((v) => (v === key ? null : key));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="feed-panel" onClick={(e) => e.stopPropagation()}>
        <div className="feed-head">
          <h2>{t('feed.title')}</h2>
          <button className="secondary" onClick={onClose}>
            {t('feed.close')}
          </button>
        </div>
        {years.length === 0 && <p className="muted">{t('feed.empty')}</p>}
        <div className="feed-list">
          {[...years].reverse().map((y) => {
            const events = movingEntries(s.log.filter((l) => l.age === y.age));
            const newsKey = `news-${y.age}`;
            const endKey = `end-${y.age}`;
            const change = y.rec ? y.rec.breakdown.work + y.rec.breakdown.investment + y.rec.breakdown.revaluation + y.rec.breakdown.other : 0;
            return (
              <section key={y.age} className="feed-year">
                <h3>{t('feed.year', { age: y.age })}</h3>
                {y.rec && (
                  <button className="feed-item" onClick={() => toggle(endKey)}>
                    <span>{t('feed.yearEnd')}</span>
                    <MoneyDelta v={change} />
                    <span className="feed-arrow">{open === endKey ? '▲' : '▼'}</span>
                  </button>
                )}
                {y.rec && open === endKey && (
                  <div className="feed-detail">
                    <MoneySummary income={y.rec.incomeTotal ?? 0} expense={y.rec.expenseTotal ?? 0} />
                    <table className="worth-table">
                      <tbody>
                        {(['work', 'investment', 'revaluation', 'other'] as const)
                          .filter((k) => Math.round(y.rec!.breakdown[k]) !== 0)
                          .map((k) => (
                            <tr key={k}>
                              <td>{t(`feed.breakdown.${k}`)}</td>
                              <td className="ledger-money">
                                <MoneyDelta v={y.rec!.breakdown[k]} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {[...events].reverse().map((e, i) => (
                  <div key={i} className="feed-item static">
                    <span>{logLabel(e)}</span>
                    {e.cash !== undefined && <MoneyDelta v={e.cash} />}
                    {e.happiness !== undefined && <HappinessDelta v={e.happiness} />}
                  </div>
                ))}
                {y.newsId && (
                  <button className="feed-item" onClick={() => toggle(newsKey)}>
                    <span>{t('feed.news', { title: t(`news.${y.newsId}.title`) })}</span>
                    <span className="feed-arrow">{open === newsKey ? '▲' : '▼'}</span>
                  </button>
                )}
                {y.newsId && open === newsKey && <div className="feed-detail">{t(`news.${y.newsId}.text`)}</div>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
