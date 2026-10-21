import { ASSETS, ASSET_IDS } from '../data/assets';
import type { AssetId, GameState, Loan } from './types';

/** ローンの毎月の返済額（元利均等）。rate は年の金利 */
export function loanPayment(balance: number, rate: number, months: number): number {
  if (months <= 0) return balance;
  const r = rate / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

export function createLoan(balance: number, rate: number, years: number): Loan {
  const months = years * 12;
  return { balance, rate, monthsLeft: months, payment: loanPayment(balance, rate, months) };
}

/** 1ヶ月分を返済し、払った額と利息を返す。残りが少なければ残りだけ払う */
export function payLoanMonth(loan: Loan): { paid: number; interest: number } {
  if (loan.balance <= 0 || loan.monthsLeft <= 0) return { paid: 0, interest: 0 };
  const interest = (loan.balance * loan.rate) / 12;
  const paid = Math.min(loan.payment, loan.balance + interest);
  loan.balance = Math.max(0, loan.balance + interest - paid);
  loan.monthsLeft -= 1;
  if (loan.monthsLeft <= 0 || loan.balance < 0.01) {
    loan.balance = 0;
    loan.monthsLeft = 0;
  }
  return { paid, interest };
}

/** 繰り上げ返済。返済額を減らし、期間はそのまま */
export function prepayLoan(loan: Loan, amount: number): number {
  const paid = Math.min(amount, loan.balance);
  loan.balance -= paid;
  loan.payment = loan.balance > 0 ? loanPayment(loan.balance, loan.rate, loan.monthsLeft) : 0;
  if (loan.balance < 0.01) {
    loan.balance = 0;
    loan.monthsLeft = 0;
  }
  return paid;
}

export function assetValue(s: GameState, id: AssetId): number {
  return (s.player.holdings[id] ?? 0) * s.market.prices[id];
}

export function financialAssets(s: GameState): number {
  return ASSET_IDS.reduce((sum, id) => sum + assetValue(s, id), 0);
}

export function realEstateValue(s: GameState): number {
  return s.player.home?.value ?? 0;
}

export function totalDebt(s: GameState): number {
  return s.player.cardLoan + (s.player.home?.loan?.balance ?? 0);
}

/** 純資産 = 銀行預金 + 株・投資信託・国債・ゴールド + 家 − 住宅ローンの残り − 借金（design.md 9章） */
export function netWorth(s: GameState): number {
  return s.player.cash + financialAssets(s) + realEstateValue(s) - totalDebt(s);
}

const isShare = (id: AssetId) => ASSETS[id].unit === 'share';

/** 買った額の合計 */
export const costOf = (s: GameState, id: AssetId) => s.player.cost[id] ?? 0;

/** units 口（株は株数）を price で買う。買った金額を返す */
function addUnits(s: GameState, id: AssetId, units: number, price: number): number {
  const spend = units * price;
  s.player.holdings[id] = (s.player.holdings[id] ?? 0) + units;
  s.player.cost[id] = costOf(s, id) + spend;
  s.player.cash -= spend;
  return spend;
}

/** units 口（株は株数）を売る。売れた金額を返す */
function removeUnits(s: GameState, id: AssetId, units: number): number {
  const held = s.player.holdings[id] ?? 0;
  const sold = Math.min(held, units);
  if (sold <= 0) return 0;
  const gained = sold * s.market.prices[id];
  s.player.cost[id] = costOf(s, id) * (1 - sold / held);
  s.player.holdings[id] = held - sold;
  if (s.player.holdings[id] < 1e-9) {
    s.player.holdings[id] = 0;
    s.player.cost[id] = 0;
  }
  s.player.cash += gained;
  return gained;
}

/**
 * 金額分を買う。預金が足りなければ買える分だけ。株は1株単位なので、金額に収まる株数だけ買う。買った金額を返す。
 * price を渡すと、その値段で買う（株のマスの割引など）
 */
export function buyAsset(s: GameState, id: AssetId, amount: number, price = s.market.prices[id]): number {
  const budget = Math.max(0, Math.min(amount, s.player.cash));
  const units = isShare(id) ? Math.floor(budget / price + 1e-9) : budget / price;
  return addUnits(s, id, units, price);
}

/** 金額分を売る。持っている分まで。株は1株単位なので、金額に届く株数を売る。売れた金額を返す */
export function sellAsset(s: GameState, id: AssetId, amount: number): number {
  const price = s.market.prices[id];
  const units = isShare(id) ? Math.ceil(Math.max(0, amount) / price - 1e-9) : Math.max(0, amount) / price;
  return removeUnits(s, id, units);
}

/** 株を shares 株買う。預金が足りなければ買える分だけ。買った金額を返す */
export function buyShares(s: GameState, id: AssetId, shares: number, price = s.market.prices[id]): number {
  const units = Math.min(Math.floor(shares), Math.floor(Math.max(0, s.player.cash) / price + 1e-9));
  return addUnits(s, id, Math.max(0, units), price);
}

/** 株を shares 株売る。売れた金額を返す */
export function sellShares(s: GameState, id: AssetId, shares: number): number {
  return removeUnits(s, id, Math.floor(shares));
}

/** お金が足りないときに売る順番。国債 → ゴールド → 投資信託 → 株（持っている額が多い業種から）（design.md 8章） */
export function sellOrder(s: GameState): AssetId[] {
  const others = ASSET_IDS.filter((id) => ASSETS[id].kind !== 'stock');
  const stocks = ASSET_IDS.filter((id) => ASSETS[id].kind === 'stock').sort((a, b) => assetValue(s, b) - assetValue(s, a));
  return [...others, ...stocks];
}
