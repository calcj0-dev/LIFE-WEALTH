// JSON のデータが正しいかを確かめる（design.md 11章）。
// JSON の書きまちがいは型チェックで見つからないので、読みこむときにここで確かめ、まちがいがあれば止める。

export type Problems = string[];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 決まった項目が、決まった種類で入っているか */
export function checkFields(where: string, obj: unknown, fields: Record<string, 'number' | 'string' | 'boolean' | 'object' | 'number?' | 'string?' | 'boolean?' | 'object?' | 'array?'>): Problems {
  if (!isObject(obj)) return [`${where}: オブジェクトではありません`];
  const problems: Problems = [];
  for (const [name, type] of Object.entries(fields)) {
    const optional = type.endsWith('?');
    const base = type.replace('?', '');
    const v = obj[name];
    if (v === undefined) {
      if (!optional) problems.push(`${where}: ${name} がありません`);
      continue;
    }
    const ok =
      base === 'number' ? isNumber(v) : base === 'object' ? isObject(v) : base === 'array' ? Array.isArray(v) : typeof v === base;
    if (!ok) problems.push(`${where}: ${name} の種類が正しくありません（${base}）`);
  }
  return problems;
}

/** id が重なっていないか */
export function checkUniqueIds(where: string, items: { id: string }[]): Problems {
  const seen = new Set<string>();
  const problems: Problems = [];
  for (const item of items) {
    if (seen.has(item.id)) problems.push(`${where}: id「${item.id}」が重なっています`);
    seen.add(item.id);
  }
  return problems;
}

/** まちがいがあれば、まとめて止める */
export function assertValid(file: string, problems: Problems) {
  if (problems.length) throw new Error(`${file} にまちがいがあります:\n${problems.join('\n')}`);
}

export { isNumber, isObject };
