// 画面の文字は言語ファイルから読む（design.md 11.1）。言語を足すときは src/locales/ にファイルを追加する。

import ja from './locales/ja.json';

type Messages = Record<string, string>;

const LOCALES: Record<string, Messages> = { ja };
let current: Messages = LOCALES.ja;
let currentLang = 'ja';

export function setLanguage(lang: string) {
  if (LOCALES[lang]) {
    current = LOCALES[lang];
    currentLang = lang;
  }
}

/** 金額として表示するパラメータ（単位は万円） */
const MONEY_PARAMS = new Set(['cost', 'salary', 'price', 'bet', 'premium', 'spent', 'returned', 'paid', 'received', 'amount', 'back']);

/** 金額（万円）を言語に合わせた書き方にする */
export function formatMoney(man: number): string {
  if (currentLang === 'ja') {
    const sign = man < 0 ? '−' : '';
    // 千円以下は扱わない。金額はすべて万円単位で出す（design.md 0.1）
    const v = Math.round(Math.abs(man));
    if (v === 0) return '0万円';
    if (v >= 10000) {
      const oku = Math.floor(v / 10000);
      const rest = v % 10000;
      return `${sign}${oku.toLocaleString('ja-JP')}億${rest ? `${rest.toLocaleString('ja-JP')}万` : ''}円`;
    }
    return `${sign}${v.toLocaleString('ja-JP')}万円`;
  }
  return `${man < 0 ? '-' : ''}¥${Math.round(Math.abs(man) * 10000).toLocaleString('en-US')}`;
}

export function formatSigned(n: number): string {
  const v = Math.round(n);
  return v > 0 ? `+${v}` : `${v}`;
}

export function t(key: string, params?: Record<string, number | string>): string {
  let text = current[key] ?? key;
  if (!params) return text;
  const all: Record<string, number | string> = { ...params };
  if (typeof params.job === 'string') all.jobName = t(`job.${params.job}`);
  if (typeof params.asset === 'string') all.assetName = t(`asset.${params.asset}`);
  if (typeof params.card === 'string') all.cardName = t(`card.${params.card}`);
  for (const [name, value] of Object.entries(all)) {
    const shown = MONEY_PARAMS.has(name) && typeof value === 'number' ? formatMoney(value) : String(value);
    text = text.split(`{${name}}`).join(shown);
  }
  return text;
}

export function has(key: string): boolean {
  return key in current;
}
