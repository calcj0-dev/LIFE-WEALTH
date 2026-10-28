// お金が足りないときの画面（design.md 8章）。桃太郎電鉄を参考に、売る資産を自分で選んで、必ず売る。
// 売れる資産がなくなっても足りなければ、残りは借金になる（ゲームの計算のほうで行う）。

import { ASSETS, ASSET_IDS } from '../data/assets';
import { sellForShortfall } from '../game/engine';
import { assetValue, costOf } from '../game/finance';
import type { GameState } from '../game/types';
import { formatMoney, t } from '../i18n';
import { MoneyDelta } from './Delta';
import { holdingName } from './GameScreen';

export function ShortfallModal({ s, onChange }: { s: GameState; onChange: (next: GameState) => void }) {
  const need = Math.max(0, -s.player.cash);
  const owned = ASSET_IDS.filter((id) => assetValue(s, id) >= 0.01);
  return (
    <div className="overlay">
      <div className="modal shortfall">
        <h2>{t('shortfall.title')}</h2>
        <p>
          {t('shortfall.text', { amount: Math.max(1, Math.round(need)) })}
        </p>
        <table className="table shortfall-table">
          <tbody>
            {owned.map((id) => {
              const value = assetValue(s, id);
              const profit = Math.round(value) - Math.round(costOf(s, id));
              const share = ASSETS[id].unit === 'share';
              return (
                <tr key={id}>
                  <td>
                    <div className="trade-name">{holdingName(s, id)}</div>
                    <div className="trade-sub">
                      {formatMoney(value)} {profit !== 0 && <>（{t('shortfall.profit')} <MoneyDelta v={profit} />）</>}
                    </div>
                  </td>
                  <td className="shortfall-buttons">
                    <button className="secondary small" onClick={() => onChange(sellForShortfall(s, id, 'one'))}>
                      {t(share ? 'shortfall.sellShare' : 'shortfall.sellMan')}
                    </button>
                    <button className="small" onClick={() => onChange(sellForShortfall(s, id, 'needed'))}>
                      {t('shortfall.sellNeeded')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">{t('shortfall.note')}</p>
      </div>
    </div>
  );
}
