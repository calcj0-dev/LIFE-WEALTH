// グラフの色。銘柄を足したときに色がなければ、PALETTE から順に使う。

import { ASSET_IDS } from '../data/assets';

const COLORS: Record<string, string> = {
  deposit: '#7cc6fe',
  bond: '#2ec4b6',
  gold: '#e0a800',
  fund: '#4d96ff',
  it: '#9b5de5',
  food: '#7bc950',
  energy: '#ff6b6b',
  bank: '#00a6a6',
  realEstate: '#f9a03f',
  living: '#6b6573',
};

const PALETTE = ['#c77dff', '#ff9f1c', '#43aa8b', '#f15bb5', '#577590'];

export function colorOf(key: string): string {
  if (COLORS[key]) return COLORS[key];
  const i = ASSET_IDS.indexOf(key);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/** 年の目盛りを出す間隔（年数が多いほど広げる） */
export const yearTickStep = (years: number) => (years <= 10 ? 1 : years <= 20 ? 5 : 10);
