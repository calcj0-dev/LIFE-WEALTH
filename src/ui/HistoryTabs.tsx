import { useState } from 'react';
import type { GameState } from '../game/types';
import { t } from '../i18n';
import { AssetChart } from './AssetChart';
import { PriceChart, ReturnTable } from './PriceCharts';

const TABS = ['mine', 'prices', 'returns'] as const;

/** 「わたしの資産」「値動きのチャート」「年利の実績」を切り替えて見る */
export function HistoryTabs({ s }: { s: GameState }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('mine');
  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? undefined : 'secondary'} onClick={() => setTab(id)}>
            {t(`history.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'mine' && <AssetChart history={s.history} />}
      {tab === 'prices' && <PriceChart points={s.prices} />}
      {tab === 'returns' && <ReturnTable history={s.history} />}
    </div>
  );
}
