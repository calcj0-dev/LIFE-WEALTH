import { formatMoney, formatSigned, t } from '../i18n';

/** お金の増減を色付きで表示する（増えたら緑、減ったら赤） */
export function MoneyDelta({ v, big }: { v: number; big?: boolean }) {
  if (Math.round(v) === 0) return null;
  return (
    <span className={`delta ${v > 0 ? 'plus' : 'minus'}${big ? ' big' : ''}`}>
      {v > 0 ? '+' : ''}
      {formatMoney(v)}
    </span>
  );
}

/** 幸福ポイントの増減を表示する */
export function HappinessDelta({ v, big }: { v: number; big?: boolean }) {
  if (!v) return null;
  return (
    <span className={`delta happy ${v > 0 ? 'plus' : 'minus'}${big ? ' big' : ''}`}>
      {t('preview.happiness', { v: formatSigned(v) })}
    </span>
  );
}
