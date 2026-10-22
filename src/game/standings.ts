// 順位（design.md 12.3、12.4）。あなたとライバルの純資産を比べる。

import { START_CASH } from '../data/rules';
import { netWorth } from './finance';
import { investReturn } from './score';
import type { GameState, RivalId, SeatData } from './types';

/** だれか（あなたは 'you'） */
export type Who = 'you' | RivalId;

export interface Standing {
  who: Who;
  /** 今の純資産 */
  worth: number;
  /** 1年前の年末の純資産（1年目は始めの預金） */
  lastYearWorth: number;
  /** 投資の成績（design.md 9章） */
  investReturn: number;
  /** 1から。純資産が同じなら、同じ順位 */
  rank: number;
}

/** 1人分の記録を、計算に使える形にする（相場などは全員に共通） */
const asState = (s: GameState, v: SeatData): GameState => ({ ...s, ...v });

/** 全員の順位。純資産の多い順に並べる */
export function standings(s: GameState): Standing[] {
  const views: { who: Who; v: SeatData }[] = [{ who: 'you', v: s }, ...s.rivals.map((r) => ({ who: r.id, v: r }))];
  const list = views.map(({ who, v }) => {
    const st = asState(s, v);
    // 年末の決算の間は、今年の記録が最後に入っているので、その1つ前が去年
    const records = s.phase === 'yearEnd' || s.phase === 'finished' ? v.history.slice(0, -1) : v.history;
    return { who, worth: netWorth(st), lastYearWorth: records.at(-1)?.netWorth ?? START_CASH, investReturn: investReturn(st), rank: 0 };
  });
  list.sort((a, b) => b.worth - a.worth);
  list.forEach((x, i) => (x.rank = i > 0 && Math.round(x.worth) === Math.round(list[i - 1].worth) ? list[i - 1].rank : i + 1));
  return list;
}
