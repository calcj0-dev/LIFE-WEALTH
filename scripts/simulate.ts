// 自動で何千回も遊ばせて、結果を docs/simulation.md にまとめる。
// 使い方: npm run simulate

import { writeFileSync } from 'node:fs';
import { POLICY_PRESETS, type PolicyPresetId } from '../src/data/assets';
import { JOB_IDS } from '../src/data/jobs';
import { RANKS } from '../src/data/rules';
import { playGame, type Strategy } from '../src/game/autoplay';
import type { GameState, JobId } from '../src/game/types';

const SEEDS_PER_CASE = 60;
const POLICIES = Object.keys(POLICY_PRESETS) as PolicyPresetId[];
const MARRIAGE: Strategy['marriage'][] = ['always', 'never'];

interface Row {
  job: JobId;
  policy: PolicyPresetId;
  marriage: Strategy['marriage'];
  married: boolean;
  children: number;
  netWorth: number;
  happiness: number;
  security: number;
  total: number;
  rank: string;
  hadDebt: boolean;
  crisisYears: number;
  gambleSpent: number;
  gambleReturned: number;
  debtRelief: boolean;
  prices: Record<string, number>;
}

function toRow(s: GameState, job: JobId, policy: PolicyPresetId, marriage: Strategy['marriage']): Row {
  return {
    job,
    policy,
    marriage,
    married: s.player.married,
    children: s.player.children.length,
    netWorth: s.score!.netWorth,
    happiness: s.score!.happinessPoints,
    security: s.score!.securityPoints,
    total: s.score!.total,
    rank: s.score!.rank,
    hadDebt: s.log.some((l) => l.key === 'shortfall.loan'),
    crisisYears: s.history.filter((h) => h.newsId === 'crisis').length,
    gambleSpent: s.stats.gambleSpent,
    gambleReturned: s.stats.gambleReturned,
    debtRelief: s.log.some((l) => l.key === 'debtRelief'),
    prices: { ...s.market.prices, realEstate: s.market.realEstateIndex, living: s.market.livingIndex },
  };
}

const rows: Row[] = [];
let seed = 1;
for (const job of JOB_IDS) {
  for (const policy of POLICIES) {
    for (const marriage of MARRIAGE) {
      for (let i = 0; i < SEEDS_PER_CASE; i++) {
        const s = playGame(seed++, job, policy, { marriage, gambleChance: 0.3, spendChance: 0.5 });
        rows.push(toRow(s, job, policy, marriage));
      }
    }
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const man = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}万円`;
const pt = (v: number) => `${Math.round(v)}`;

function summary(label: string, group: Row[]) {
  const w = group.map((r) => r.netWorth);
  return `| ${label} | ${group.length} | ${man(pct(w, 0.1))} | ${man(pct(w, 0.5))} | ${man(pct(w, 0.9))} | ${pt(mean(group.map((r) => r.happiness)))} | ${pt(mean(group.map((r) => r.security)))} | ${pt(mean(group.map((r) => r.total)))} |`;
}

const head =
  '| 区分 | 回数 | 純資産（下位10%） | 純資産（中央） | 純資産（上位10%） | 幸福ポイント（平均） | 老後の安心（平均） | 合計（平均） |\n| --- | --- | --- | --- | --- | --- | --- | --- |';

const byKey = <K extends keyof Row>(key: K, values: Row[K][], label: (v: Row[K]) => string) =>
  values.map((v) => summary(label(v), rows.filter((r) => r[key] === v))).join('\n');

const jobNames: Record<JobId, string> = {
  employee: '会社員',
  civil: '公務員',
  engineer: 'ITエンジニア',
  athlete: 'スポーツ選手',
  youtuber: 'YouTuber',
  freeter: 'フリーター',
};
const policyNames: Record<PolicyPresetId, string> = { safe: '安全型', balanced: 'バランス型', aggressive: '積極型' };

const totals = rows.map((r) => r.total);
const rankLines = RANKS.map((r) => {
  const n = rows.filter((x) => x.rank === r.rank).length;
  return `| ${r.rank} | ${r.min === -Infinity ? '—' : r.min} | ${Math.round((n / rows.length) * 100)}% |`;
}).join('\n');

const spent = rows.reduce((a, r) => a + r.gambleSpent, 0);
const returned = rows.reduce((a, r) => a + r.gambleReturned, 0);

const priceNames: Record<string, string> = {
  bond: '債券（利息を除く）',
  gold: 'ゴールド',
  fund: '投資信託',
  stock: '株式（配当を除く）',
  realEstate: '不動産の相場',
  living: '物価',
};
const assetLines = Object.entries(priceNames)
  .map(([k, name]) => {
    const cagr = rows.map((r) => Math.pow(r.prices[k], 1 / 44) - 1);
    return `| ${name} | ${(pct(cagr, 0.5) * 100).toFixed(1)}% |`;
  })
  .join('\n');

const md = `# 自動シミュレーションの結果

\`npm run simulate\` で作成。職業6 × 投資方針3 × 結婚（する／しない）2 × ${SEEDS_PER_CASE}回 = ${rows.length}回 遊ばせた結果。
選択は自動（旅行や趣味などにお金を使う確率50%、ギャンブルをする確率30%）。

## 全体

${head}
${summary('全体', rows)}

合計点の分布: 下位10% ${pt(pct(totals, 0.1))}、下位20% ${pt(pct(totals, 0.2))}、中央 ${pt(pct(totals, 0.5))}、上位20% ${pt(pct(totals, 0.8))}、上位5% ${pt(pct(totals, 0.95))}

## 職業ごと

${head}
${byKey('job', JOB_IDS, (j) => jobNames[j])}

## 投資方針ごと

${head}
${byKey('policy', POLICIES, (p) => policyNames[p])}

## 結婚する／しない

${head}
${summary('結婚した', rows.filter((r) => r.married))}
${summary('結婚しなかった', rows.filter((r) => !r.married))}
${summary('結婚して子どもがいる', rows.filter((r) => r.married && r.children > 0))}

## ランクの分布

| ランク | 基準点 | 割合 |
| --- | --- | --- |
${rankLines}

## そのほか

- カードローンを使ったことがある割合: ${Math.round((rows.filter((r) => r.hadDebt).length / rows.length) * 100)}%
- 金融危機が1回以上あった割合: ${Math.round((rows.filter((r) => r.crisisYears > 0).length / rows.length) * 100)}%
- ギャンブルの還元率（実際の結果）: ${Math.round((returned / Math.max(1, spent)) * 100)}%
- 債務整理になった割合: ${Math.round((rows.filter((r) => r.debtRelief).length / rows.length) * 100)}%

## 資産ごとの実際の値上がり率（44年間の年平均、中央値）

| 資産 | 年平均 |
| --- | --- |
${assetLines}
`;

writeFileSync(new URL('../docs/simulation.md', import.meta.url), md);
console.log(md);
