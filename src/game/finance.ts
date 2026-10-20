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

/** 金額分を買う。預金が足りなければ買える分だけ。買った金額を返す */
export function buyAsset(s: GameState, id: AssetId, amount: number, price = s.market.prices[id]): number {
  const spend = Math.max(0, Math.min(amount, s.player.cash));
  s.player.holdings[id] = (s.player.holdings[id] ?? 0) + spend / price;
  s.player.cash -= spend;
  return spend;
}

/** 金額分を売る。持っている分まで。売れた金額を返す */
export function sellAsset(s: GameState, id: AssetId, amount: number): number {
  const price = s.market.prices[id];
  const units = Math.min(s.player.holdings[id] ?? 0, Math.max(0, amount) / price);
  const gained = units * price;
  s.player.holdings[id] -= units;
  if (s.player.holdings[id] < 1e-9) s.player.holdings[id] = 0;
  s.player.cash += gained;
  return gained;
}

/** お金が足りないときに売る順番。国債 → ゴールド → 投資信託 → 株（持っている額が多い業種から）（design.md 8章） */
export function sellOrder(s: GameState): AssetId[] {
  const others = ASSET_IDS.filter((id) => ASSETS[id].kind !== 'stock');
  const stocks = ASSET_IDS.filter((id) => ASSETS[id].kind === 'stock').sort((a, b) => assetValue(s, b) - assetValue(s, a));
  return [...others, ...stocks];
}
