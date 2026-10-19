import { ASSET_IDS } from '../data/assets';
import type { AssetId, GameState, Loan } from './types';

/** ローンの毎年の返済額（元利均等） */
export function loanPayment(balance: number, rate: number, years: number): number {
  if (years <= 0) return balance;
  if (rate === 0) return balance / years;
  return (balance * rate) / (1 - Math.pow(1 + rate, -years));
}

export function createLoan(balance: number, rate: number, years: number): Loan {
  return { balance, rate, yearsLeft: years, payment: loanPayment(balance, rate, years) };
}

/** 1年分を返済し、払った額を返す。残りが少なければ残りだけ払う */
export function payLoanYear(loan: Loan): { paid: number; interest: number } {
  if (loan.balance <= 0 || loan.yearsLeft <= 0) return { paid: 0, interest: 0 };
  const interest = loan.balance * loan.rate;
  const paid = Math.min(loan.payment, loan.balance + interest);
  loan.balance = Math.max(0, loan.balance + interest - paid);
  loan.yearsLeft -= 1;
  if (loan.yearsLeft <= 0 || loan.balance < 0.01) {
    loan.balance = 0;
    loan.yearsLeft = 0;
  }
  return { paid, interest };
}

/** 繰り上げ返済。返済額を減らし、期間はそのまま */
export function prepayLoan(loan: Loan, amount: number): number {
  const paid = Math.min(amount, loan.balance);
  loan.balance -= paid;
  loan.payment = loan.balance > 0 ? loanPayment(loan.balance, loan.rate, loan.yearsLeft) : 0;
  if (loan.balance < 0.01) {
    loan.balance = 0;
    loan.yearsLeft = 0;
  }
  return paid;
}

export function assetValue(s: GameState, id: AssetId): number {
  return s.player.holdings[id] * s.market.prices[id];
}

export function financialAssets(s: GameState): number {
  return ASSET_IDS.reduce((sum, id) => sum + assetValue(s, id), 0);
}

export function realEstateValue(s: GameState): number {
  return s.player.properties.reduce((sum, p) => sum + p.value, 0);
}

export function totalDebt(s: GameState): number {
  return (
    s.player.cardLoan + s.player.properties.reduce((sum, p) => sum + (p.loan ? p.loan.balance : 0), 0)
  );
}

/** 純資産 = 現金 + 金融資産 + 不動産 − 借金 */
export function netWorth(s: GameState): number {
  return s.player.cash + financialAssets(s) + realEstateValue(s) - totalDebt(s);
}

/** 金額分を買う。現金が足りなければ買える分だけ。株式は1口単位 */
export function buyAsset(s: GameState, id: AssetId, amount: number): number {
  const price = s.market.prices[id];
  const spend = Math.max(0, Math.min(amount, s.player.cash));
  let units = spend / price;
  if (id === 'stock') units = Math.floor(units);
  const cost = units * price;
  s.player.holdings[id] += units;
  s.player.cash -= cost;
  return cost;
}

/** 金額分を売る。持っている分まで。株式は1口単位 */
export function sellAsset(s: GameState, id: AssetId, amount: number): number {
  const price = s.market.prices[id];
  let units = Math.min(s.player.holdings[id], Math.max(0, amount) / price);
  if (id === 'stock') units = Math.min(s.player.holdings[id], Math.ceil(units));
  const gained = units * price;
  s.player.holdings[id] -= units;
  if (s.player.holdings[id] < 1e-9) s.player.holdings[id] = 0;
  s.player.cash += gained;
  return gained;
}

/** 投資方針どおりに金額を配分して買う */
export function investByPolicy(s: GameState, amount: number): number {
  let spent = 0;
  for (const id of ASSET_IDS) {
    const share = s.player.policy.allocation[id];
    if (share > 0) spent += buyAsset(s, id, amount * share);
  }
  return spent;
}
