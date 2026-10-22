import { financialAssets, netWorth } from './finance';
import type { GameResult, GameState } from './types';

// 結果の計算。design.md 9章。最後の純資産で競う。
// 別の評価に差し替えられるよう、この部品だけで完結させる。

export function computeResult(s: GameState): GameResult {
  return { netWorth: netWorth(s), investReturn: investReturn(s) };
}

/**
 * 投資の成績。投資に入れたお金に対して、何%増えたか（design.md 9章）。
 * 利益 = 今の投資の額 + 売って戻ったお金 + 配当・国債の利息 − 投資に入れたお金。投資していなければ 0
 */
export function investReturn(s: GameState): number {
  const st = s.stats;
  if (st.invested < 1) return 0;
  return (financialAssets(s) + st.divested + st.assetIncome - st.invested) / st.invested;
}
