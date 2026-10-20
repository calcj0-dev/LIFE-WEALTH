import { netWorth } from './finance';
import type { GameResult, GameState } from './types';

// 結果の計算。design.md 9章。最後の純資産で競う。
// あとで CPU との順位など、別の評価に差し替えられるよう、この部品だけで完結させる。

export function computeResult(s: GameState): GameResult {
  return { netWorth: netWorth(s) };
}
