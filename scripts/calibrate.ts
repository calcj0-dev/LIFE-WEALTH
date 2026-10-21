// 相場の補正の微調整を求めて、src/data/marketCalibration.json に保存する。
// 銘柄・ニュース・大きなイベントのデータを変えたら、作り直す。使い方: npm run calibrate

import { writeFileSync } from 'node:fs';
import { ASSETS, ASSET_IDS } from '../src/data/assets';
import { baseCorrection, simulateGrowth } from '../src/game/market';

const PATHS = 4000;
const YEARS = 50;
const ROUNDS = 3;

const correction = baseCorrection();
const offsets: Record<string, number> = Object.fromEntries(ASSET_IDS.map((id) => [id, 0]));
for (let round = 0; round < ROUNDS; round++) {
  const g = simulateGrowth(correction, PATHS, YEARS);
  for (const id of ASSET_IDS) {
    const step = (ASSETS[id].meanReturn - g[id]) * (1 + ASSETS[id].meanReturn);
    correction[id] += step;
    offsets[id] += step;
  }
  console.log(`round ${round + 1}`, ASSET_IDS.map((id) => `${id} ${(g[id] * 100).toFixed(2)}%`).join(', '));
}
const rounded = Object.fromEntries(ASSET_IDS.map((id) => [id, Math.round(offsets[id] * 10000) / 10000]));
writeFileSync(
  new URL('../src/data/marketCalibration.json', import.meta.url),
  `${JSON.stringify({ _note: '相場の補正の微調整（銘柄ごと）。npm run calibrate で作る。手で書きかえない', offsets: rounded }, null, 2)}\n`,
);
console.log(rounded);
