// できごとの履歴のパネル（design.md 2.2）。

import { useState } from 'react';
import type { GameState, YearRecord } from '../game/types';
import { t } from '../i18n';
import { MoneyDelta } from './Delta';
import { MoneySummary } from './Ledger';
import { logLabel, visibleEntries } from './logLabel';

// ---------------------------------------------------------------- できごとの履歴

interface YearGroup {
  year: number;
  rec?: YearRecord;
}

/** 年ごとに、決算・マスの出来事・ニュースを、新しい順に並べたパネル */
export function FeedPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const years: YearGroup[] = s.history.map((rec) => ({ year: rec.year, rec }));
  // 今の年（まだ決算前）も、出来事を出す
  if (!s.history.some((r) => r.year === s.year)) years.push({ year: s.year });
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
        {s.log.length === 0 && <p className="muted">{t('feed.empty')}</p>}
        <div className="feed-list">
          {[...years].reverse().map((y) => {
            const events = visibleEntries(s.log.filter((l) => l.year === y.year));
            const endKey = `end-${y.year}`;
            const rec = y.rec;
            const change = rec ? rec.breakdown.work + rec.breakdown.investment + rec.breakdown.revaluation + rec.breakdown.other : 0;
            return (
              <section key={y.year} className="feed-year">
                <h3>{t('feed.year', { year: y.year })}</h3>
                {rec && (
                  <button className="feed-item" onClick={() => toggle(endKey)}>
                    <span>{t('feed.yearEnd')}</span>
                    <MoneyDelta v={change} />
                    <span className="feed-arrow">{open === endKey ? '▲' : '▼'}</span>
                  </button>
                )}
                {rec && open === endKey && (
                  <div className="feed-detail">
                    <MoneySummary income={{ total: rec.incomeTotal }} expense={{ total: rec.expenseTotal }} />
                    <table className="worth-table">
                      <tbody>
                        {(['work', 'investment', 'revaluation', 'other'] as const)
                          .filter((k) => Math.round(rec.breakdown[k]) !== 0)
                          .map((k) => (
                            <tr key={k}>
                              <td>{t(`feed.breakdown.${k}`)}</td>
                              <td className="ledger-money">
                                <MoneyDelta v={rec.breakdown[k]} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {[...events].reverse().map((e, i) => (
                  <div key={i} className="feed-item static">
                    <span className="muted">{t('feed.month', { month: e.month })}</span>
                    <span>{logLabel(e)}</span>
                    {e.cash !== undefined && <MoneyDelta v={e.cash} />}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
