// ライバル（CPU）の考え方（design.md 12.1）。性格ごとの数値は src/data/rivals.ts。
// ここでは選び方だけを決め、ゲームの進行（engine.ts）から呼ぶ。乱数はゲームと同じシード値つきのものを使う。

import { ASSETS, ASSET_IDS } from '../data/assets';
import type { Personality } from '../data/rivals';
import { buyAsset, buyShares, sellShares } from './finance';
import { nextRandom } from './rng';
import type { AssetId, DecisionOption, GameState } from './types';

/** 残しておく預金（毎月の支出 × 月数） */
const reserveOf = (p: Personality, monthlyExpense: number) => p.reserveMonths * monthlyExpense;

/**
 * 決定の選び方。monthlyExpense は、今の毎月の支出（残しておく預金の計算に使う）
 */
export function cpuChoice(s: GameState, options: DecisionOption[], p: Personality, monthlyExpense: number): string {
  const enabled = options.filter((o) => o.enabled);
  const d = s.decision!;
  const cash = s.player.cash;
  const spare = cash - reserveOf(p, monthlyExpense);
  const has = (id: string) => enabled.some((o) => o.id === id);
  const skip = has('skip') ? 'skip' : enabled[0].id;
  const cost = (o: DecisionOption) => -(o.cash ?? 0);

  switch (d.kind) {
    case 'gamble': {
      if (!d.gambleId) {
        const games = enabled.filter((o) => o.id.startsWith('game:'));
        if (!games.length || nextRandom(s) >= p.gambleChance) return 'skip';
        return games[Math.floor(nextRandom(s) * games.length)].id;
      }
      const bets = enabled.filter((o) => o.id !== 'back').sort((a, b) => cost(a) - cost(b));
      return bets.length ? bets[0].id : 'back';
    }
    case 'talk': {
      const joins = enabled.filter((o) => o.id.startsWith('join:')).sort((a, b) => cost(a) - cost(b));
      return joins.length && nextRandom(s) < p.talkChance ? joins[0].id : 'skip';
    }
    case 'stock': {
      if (!p.stockSquare) return 'skip';
      const buys = enabled.filter((o) => o.id.startsWith('buy:') && cost(o) <= spare).sort((a, b) => cost(b) - cost(a));
      return buys.length ? buys[0].id : 'skip';
    }
    case 'realEstate': {
      const loan = enabled.find((o) => o.id === 'homeLoan');
      // 頭金と諸費用を払っても、残しておく預金が残るときだけ
      if (loan && cost(loan) <= spare && nextRandom(s) < p.homeChance) return loan.id;
      return 'skip';
    }
    case 'event': {
      const jobs = enabled.filter((o) => o.id.startsWith('job:'));
      if (jobs.length) {
        const best = jobs.sort((a, b) => Number(b.params?.salary ?? 0) - Number(a.params?.salary ?? 0))[0];
        return Number(best.params?.salary ?? 0) > s.player.salary && nextRandom(s) < p.jobChangeChance ? best.id : skip;
      }
      if (has('try')) return spare > 0 && nextRandom(s) < p.sideBusinessChance ? 'try' : 'skip';
      return enabled[0].id;
    }
    case 'discard':
      // 新しくもらったカード（一番うしろ）を捨てる
      return enabled[enabled.length - 1].id;
    default:
      return enabled[0].id;
  }
}

/** 1年で一番値上がりした株（流行りの株） */
function hotStock(s: GameState): AssetId {
  const stocks = ASSET_IDS.filter((id) => ASSETS[id].kind === 'stock');
  const rate = (id: AssetId) => s.marketChange?.rates[id] ?? 0;
  return stocks.sort((a, b) => rate(b) - rate(a))[0];
}

/**
 * 年末の売り買い。1年で大きく下がった株を慌てて売り（攻めタイプ）、残しておく分を引いた預金の一部で投資する。
 * 行ったことを [ログの番号, 内容] の形で返す
 */
export function cpuYearEndTrade(s: GameState, p: Personality, monthlyExpense: number): { key: string; params: Record<string, number | string> }[] {
  const done: { key: string; params: Record<string, number | string> }[] = [];
  if (p.panicSell !== null) {
    for (const id of ASSET_IDS) {
      if (ASSETS[id].kind !== 'stock') continue;
      const held = Math.round(s.player.holdings[id] ?? 0);
      if (held <= 0 || (s.marketChange?.rates[id] ?? 0) > p.panicSell) continue;
      const gained = sellShares(s, id, held);
      if (gained > 0) done.push({ key: 'trade.sellShares', params: { asset: id, shares: held, amount: Math.round(gained) } });
    }
  }
  const budget = Math.floor((s.player.cash - reserveOf(p, monthlyExpense)) * p.investRate);
  if (budget < 1) return done;
  for (const b of p.buy) {
    const id = b.asset === 'hotStock' ? hotStock(s) : b.asset;
    const amount = Math.floor(budget * b.share);
    if (amount < 1) continue;
    if (ASSETS[id].unit === 'share') {
      const shares = Math.floor(amount / s.market.prices[id]);
      const spent = buyShares(s, id, shares);
      if (spent > 0) done.push({ key: 'trade.buyShares', params: { asset: id, shares, amount: Math.round(spent) } });
    } else {
      const spent = buyAsset(s, id, amount);
      if (spent > 0) done.push({ key: 'trade.buy', params: { asset: id, amount: Math.round(spent) } });
    }
  }
  return done;
}

