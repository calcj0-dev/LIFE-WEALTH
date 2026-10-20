import type { AssetId, Economy } from '../game/types';
import { ASSET_IDS } from './assets';
import data from './news.json';
import { assertValid, checkFields, checkUniqueIds, isNumber, type Problems } from './validate';

export interface NewsDef {
  id: string;
  /** 起きやすさ */
  weight: number;
  /** その年の景気を決める（なければ確率で移り変わる） */
  economy?: Economy;
  /** その年の値動きへの上乗せ */
  shocks: Partial<Record<AssetId | 'realEstate', number>>;
  /** 預金金利の変化（例: 0.005 = 0.5%上がる） */
  depositRateChange?: number;
  /** 物価の変化（例: 0.05 = 5%上がる） */
  inflation?: number;
  /** 大事な年（ポップアップで出す） */
  important?: boolean;
}

export function checkNews(raw: unknown, assetIds: string[] = ASSET_IDS): Problems {
  const list = (raw as { news?: unknown }).news;
  if (!Array.isArray(list) || list.length === 0) return ['news がありません'];
  const problems: Problems = [];
  const targets = new Set([...assetIds, 'realEstate']);
  list.forEach((n, i) => {
    const where = `news[${i}]`;
    problems.push(
      ...checkFields(where, n, { id: 'string', weight: 'number', shocks: 'object', economy: 'string?', depositRateChange: 'number?', inflation: 'number?', important: 'boolean?' }),
    );
    if (isNumber(n.weight) && n.weight <= 0) problems.push(`${where}: weight は0より大きくします`);
    if (n.economy !== undefined && !['boom', 'normal', 'recession'].includes(n.economy)) problems.push(`${where}: economy が正しくありません`);
    for (const [k, v] of Object.entries(n.shocks ?? {})) {
      if (!targets.has(k)) problems.push(`${where}: shocks の「${k}」という銘柄はありません`);
      if (!isNumber(v)) problems.push(`${where}: shocks.${k} が数ではありません`);
    }
  });
  problems.push(...checkUniqueIds('news', list));
  return problems;
}

assertValid('src/data/news.json', checkNews(data));

/** 年末に1つ起きる政治・経済のニュース。design.md 7章 */
export const NEWS: NewsDef[] = data.news as NewsDef[];
