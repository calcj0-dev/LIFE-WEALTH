// ルーレット。出目はゲームのルール側（engine.roll）で決め、ここは見せるだけ。
// あとでサイコロの見た目に差し替えられるよう、出目と見た目を分けている。

import { useEffect, useState } from 'react';
import { ROULETTE_MAX } from '../data/rules';
import { t } from '../i18n';

interface Props {
  /** 決まった出目。回っている間は null */
  value: number | null;
  spinning: boolean;
  canSpin: boolean;
  onSpin: () => void;
}

export function Roulette({ value, spinning, canSpin, onSpin }: Props) {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setShown((n) => (n % ROULETTE_MAX) + 1), 70);
    return () => clearInterval(id);
  }, [spinning]);

  const display = spinning ? shown : value;

  return (
    <div className="board-controls">
      {display !== null && <div className={`roulette-number${spinning ? ' spinning' : ''}`}>{display}</div>}
      {!spinning && value !== null && <div className="card">{t('roll.result', { n: value })}</div>}
      {canSpin && <button onClick={onSpin}>{t('roll.button')}</button>}
    </div>
  );
}
