// ライバルの資産を見る画面（design.md 12.4。段階8）。見るだけで、何かを変えることはできない。
// 資産の並びと書き方は、あなたの右側の資産の欄と同じにして、比べやすくする。

import { ASSET_IDS } from '../data/assets';
import { SEAT_KEYS } from '../game/seats';
import { assetValue, costOf, realEstateValue } from '../game/finance';
import { standings } from '../game/standings';
import type { GameState, RivalId } from '../game/types';
import { formatMoney, t } from '../i18n';
import { AvatarIcon } from '../board/Avatar';
import { RIVAL_LOOKS, familyOf } from '../data/characters';
import { MoneyDelta } from './Delta';
import { holdingName } from './GameScreen';
import { logLabel } from './logLabel';
import { rivalLines, rivalName } from './Rivals';

/** ライバルの記録を、あなたの記録の場所に入れた見え方（元の状態は変えない） */
function viewOf(s: GameState, i: number): GameState {
  const view = { ...s } as GameState & Record<string, unknown>;
  for (const k of SEAT_KEYS) (view as Record<string, unknown>)[k] = s.rivals[i][k];
  return view;
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function RivalDetailModal({ s, id, onClose }: { s: GameState; id: RivalId; onClose: () => void }) {
  const i = s.rivals.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const v = viewOf(s, i);
  const p = v.player;
  const rank = standings(s).find((x) => x.who === id)!;
  const owned = ASSET_IDS.filter((a) => assetValue(v, a) >= 0.5);
  const insurance = [p.medicalPremium !== null ? t('panel.insurance.medical') : null, p.home?.fireInsured ? t('panel.insurance.fire') : null].filter(Boolean);
  const recent = rivalLines(s)
    .filter((l) => l.id === id)
    .slice(0, 5);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rival-detail" onClick={(e) => e.stopPropagation()}>
        <div className="rival-detail-head">
          <AvatarIcon look={RIVAL_LOOKS[id]} size={44} />
          <div>
            <h2>{rivalName(id)}</h2>
            <div className="muted">{t(`rival.type.${id}`)}</div>
          </div>
          <div className="rival-detail-rank">
            <b>{t('rank.nth', { n: rank.rank })}</b>
            <div>
              {t('hud.netWorth')} {formatMoney(rank.worth)}
            </div>
          </div>
        </div>
        <div className="rival-detail-body">
          <div className="card">
            <h4>{t('rivalDetail.life')}</h4>
            <Row k={t(`job.${p.jobId}`)} v={formatMoney(p.salary)} />
            <div className="family-icons">
              <AvatarIcon look={RIVAL_LOOKS[id]} size={26} />
              {familyOf(s.seed, id, p.married, p.children, RIVAL_LOOKS[id]).map((m, k) => (
                <AvatarIcon key={k} look={m.look} size={Math.round(26 * Math.max(0.7, m.scale + 0.2))} />
              ))}
            </div>
            <div>{p.married ? t(`panel.married.${p.spouse!.work}`) : t('panel.single')}</div>
            {p.children.length > 0 && <div>{t('panel.children', { count: p.children.length })}</div>}
            <div>{p.home ? t('panel.home') : t('panel.rent')}</div>
          </div>
          <div className="card">
            <h4>{t('panel.assets')}</h4>
            <Row k={t('asset.deposit')} v={formatMoney(p.cash)} />
            {owned.map((a) => {
              const profit = Math.round(assetValue(v, a)) - Math.round(costOf(v, a));
              return (
                <Row
                  key={a}
                  k={holdingName(v, a)}
                  v={
                    <>
                      {formatMoney(assetValue(v, a))}
                      {profit !== 0 && (
                        <span className="rival-detail-profit">
                          （{t('rivalDetail.profit')} <MoneyDelta v={profit} />）
                        </span>
                      )}
                    </>
                  }
                />
              );
            })}
            {p.home && <Row k={t('asset.realEstate')} v={formatMoney(realEstateValue(v))} />}
            {p.home?.loan && p.home.loan.balance > 0 && <Row k={t('rivalDetail.mortgage')} v={<span className="minus">{formatMoney(p.home.loan.balance)}</span>} />}
            {p.cardLoan > 0 && <Row k={t('hud.debt')} v={<span className="minus">{formatMoney(p.cardLoan)}</span>} />}
            <Row k={t('panel.insurance')} v={insurance.length ? insurance.join('、') : t('panel.insurance.none')} />
          </div>
          <div className="card">
            <h4>{t('rivalDetail.recent')}</h4>
            {recent.length === 0 && <div className="muted">{t('rivalFeed.empty')}</div>}
            {recent.map((l, k) => (
              <div key={k} className="rival-line">
                <span className="rival-line-text">{logLabel(l.entry)}</span>
                {l.entry.cash !== undefined && <MoneyDelta v={l.entry.cash} />}
              </div>
            ))}
          </div>
        </div>
        <div className="options">
          <button onClick={onClose}>{t('rivalDetail.close')}</button>
        </div>
      </div>
    </div>
  );
}
