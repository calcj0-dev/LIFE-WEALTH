// 自動で何百回も遊ばせて、結果を docs/simulation.md にまとめる。
// 使い方: npm run simulate

import { writeFileSync } from 'node:fs';
import { ASSET_IDS } from '../src/data/assets';
import { JOB_IDS } from '../src/data/jobs';
import { playGame, type PlayCounts, type Strategy } from '../src/game/autoplay';
import type { GameState, JobId } from '../src/game/types';

const SEEDS_PER_CASE = 30;
const YEARS = [20, 40];
const STRATEGIES: { id: string; name: string; strategy: Strategy }[] = [
  { id: 'none', name: '投資しない', strategy: { investRate: 0, gambleChance: 0.3, homeChance: 0.4 } },
  { id: 'saving', name: '積み立てだけ（おすすめの金額）', strategy: { investRate: 0, saving: true, gambleChance: 0.3, homeChance: 0.4 } },
  { id: 'invest', name: '積み立て＋年末に余ったお金の半分を投資信託に', strategy: { investRate: 0.5, saving: true, gambleChance: 0.3, homeChance: 0.4 } },
];

interface Row {
  job: JobId;
  years: number;
  strategy: string;
  netWorth: number;
  married: boolean;
  marriedYear: number | null;
  children: number;
  home: boolean;
  hadDebt: boolean;
  finalDebt: number;
  popupsPerYear: number;
  gambleSpent: number;
  gambleReturned: number;
  prices: Record<string, number>;
}

function toRow(s: GameState, job: JobId, years: number, strategy: string, counts: PlayCounts): Row {
  return {
    job,
    years,
    strategy,
    netWorth: s.result!.netWorth,
    married: s.player.married,
    marriedYear: s.log.find((l) => l.key === 'marriage.marry')?.year ?? null,
    children: s.player.children.length,
    home: s.player.home !== null,
    hadDebt: s.log.some((l) => l.key === 'shortfall.loan'),
    finalDebt: s.player.cardLoan,
    popupsPerYear: counts.popups / years,
    gambleSpent: s.stats.gambleSpent,
    gambleReturned: s.stats.gambleReturned,
    prices: { ...s.market.prices, realEstate: s.market.realEstateIndex, living: s.market.livingIndex },
  };
}

const rows: Row[] = [];
let seed = 1;
for (const years of YEARS) {
  for (const job of JOB_IDS) {
    for (const st of STRATEGIES) {
      for (let i = 0; i < SEEDS_PER_CASE; i++) {
        const counts: PlayCounts = { turns: 0, popups: 0 };
        const s = playGame(seed++, job, years, st.strategy, counts);
        rows.push(toRow(s, job, years, st.id, counts));
      }
    }
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
};
const man = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}万円`;
const rate = (group: Row[], f: (r: Row) => boolean) => `${Math.round((group.filter(f).length / Math.max(1, group.length)) * 100)}%`;

const jobNames: Record<string, string> = {
  employee: '会社員',
  civil: '公務員',
  engineer: 'ITエンジニア',
  athlete: 'スポーツ選手',
  youtuber: 'YouTuber',
  freeter: 'フリーター',
};

function summary(label: string, group: Row[]) {
  const w = group.map((r) => r.netWorth);
  return `| ${label} | ${group.length} | ${man(pct(w, 0.1))} | ${man(pct(w, 0.5))} | ${man(pct(w, 0.9))} | ${rate(group, (r) => r.married)} | ${mean(group.map((r) => r.children)).toFixed(1)} | ${rate(group, (r) => r.home)} | ${rate(group, (r) => r.finalDebt > 0)} |`;
}

const head =
  '| 区分 | 回数 | 純資産（下位10%） | 純資産（中央） | 純資産（上位10%） | 結婚した | 子ども（平均） | 持ち家 | 借金が残った |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |';

function section(years: number) {
  const group = rows.filter((r) => r.years === years);
  const byJob = JOB_IDS.map((j) => summary(jobNames[j] ?? j, group.filter((r) => r.job === j))).join('\n');
  const byStrategy = STRATEGIES.map((st) => summary(st.name, group.filter((r) => r.strategy === st.id))).join('\n');
  const employee = group.filter((r) => r.job === 'employee');
  return `## ${years}年で遊んだ場合

${head}
${summary('全体', group)}

### 職業ごと

${head}
${byJob}

### 投資のしかたごと

${head}
${byStrategy}

### 会社員の投資のしかたごと

${head}
${STRATEGIES.map((st) => summary(st.name, employee.filter((r) => r.strategy === st.id))).join('\n')}
`;
}

const married = rows.filter((r) => r.marriedYear !== null);
const spent = rows.reduce((a, r) => a + r.gambleSpent, 0);
const returned = rows.reduce((a, r) => a + r.gambleReturned, 0);
const priceNames: Record<string, string> = {
  bond: '国債（利息を除く）',
  gold: 'ゴールド',
  fund: '投資信託',
  it: 'IT株（配当を除く）',
  food: '食品株（配当を除く）',
  energy: 'エネルギー株（配当を除く）',
  bank: '銀行株（配当を除く）',
  realEstate: '不動産の相場',
  living: '物価',
};
const long = rows.filter((r) => r.years === 40);
const assetLines = [...ASSET_IDS, 'realEstate', 'living']
  .map((k) => {
    const cagr = long.map((r) => Math.pow(r.prices[k], 1 / 40) - 1);
    return `| ${priceNames[k] ?? k} | ${(pct(cagr, 0.5) * 100).toFixed(1)}% | ${(pct(cagr, 0.1) * 100).toFixed(1)}% 〜 ${(pct(cagr, 0.9) * 100).toFixed(1)}% |`;
  })
  .join('\n');

const md = `# 自動シミュレーションの結果

\`npm run simulate\` で作成。年数（${YEARS.join('・')}年）× 職業${JOB_IDS.length} × 投資のしかた${STRATEGIES.length} × ${SEEDS_PER_CASE}回 = ${rows.length}回 遊ばせた結果。
選択は自動（ギャンブルをする確率30%、家を買えるときに買う確率40%）。
「投資しない」は銀行預金だけ。「積み立てだけ」は、投資信託を毎月おすすめの金額（手取りの1割）で積み立てる。「積み立て＋…」は、さらに年末の取引タイムで、生活費の半年分を残した残りの半分で投資信託を買う。株のマスでは、投資する遊び方のときだけ、ときどき株を買う。

${YEARS.map(section).join('\n')}
## 結婚

- 結婚した年（中央）: ${pct(married.map((r) => r.marriedYear!), 0.5)}年目（早い10% ${pct(married.map((r) => r.marriedYear!), 0.1)}年目、遅い10% ${pct(married.map((r) => r.marriedYear!), 0.9)}年目）

## テンポ

- ポップアップで止まった回数: 1年あたり平均 ${mean(rows.map((r) => r.popupsPerYear)).toFixed(1)}回（12ターンのうち。年末のニュースと決算は含まない）

## そのほか

- カードローンを使ったことがある割合: ${rate(rows, (r) => r.hadDebt)}
- ギャンブルの還元率（実際の結果）: ${Math.round((returned / Math.max(1, spent)) * 100)}%

## 資産ごとの実際の値上がり率（40年の年平均）

| 資産 | 中央 | 下位10% 〜 上位10% |
| --- | --- | --- |
${assetLines}
`;

writeFileSync(new URL('../docs/simulation.md', import.meta.url), md);
console.log(md);
