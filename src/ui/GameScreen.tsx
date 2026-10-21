import { ASSETS, ASSET_IDS } from '../data/assets';
import { assetValue, netWorth, realEstateValue } from '../game/finance';
import type { GameState } from '../game/types';
import { formatMoney, t } from '../i18n';
import { AnimatedMoney, type MoneyLevel } from './AnimatedMoney';
import { dateLabel } from './dateLabel';
import { BudgetCard } from './Setup';

/** 画面の上。何年目・純資産・景気・借金だけを出す。銀行預金と資産の内訳は右側に出す（design.md 0.1） */
export function Hud({ s, level }: { s: GameState; level?: MoneyLevel }) {
  const p = s.player;
  return (
    <div className="hud">
      <div className="hud-age">
        {dateLabel(s, s.year, s.month)}
        <span className="hud-years">{t('hud.years', { years: s.years })}</span>
      </div>
      <div className="hud-item">
        <span className="label">{t('hud.netWorth')}</span>
        <AnimatedMoney className="value" value={netWorth(s)} level={level} />
      </div>
      <div className="hud-item">
        <span className="label">{t('hud.economy')}</span>
        <span className="value">{t(`economy.${s.market.economy}`)}</span>
      </div>
      {p.cardLoan > 0 && (
        <div className="hud-item">
          <span className="label">{t('hud.debt')}</span>
          <span className="value minus">{formatMoney(p.cardLoan)}</span>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/** 銘柄の名前。株は株数も添える（例: IT株（ミライテック） 3株） */
export function holdingName(s: GameState, id: string): string {
  const name = t(`asset.${id}`);
  if (ASSETS[id].unit !== 'share') return name;
  return `${name} ${t('trade.sharesCount', { n: Math.round(s.player.holdings[id] ?? 0) })}`;
}

export function SidePanel({
  s,
  onOpenHistory,
  onOpenFeed,
  level,
}: {
  s: GameState;
  onOpenHistory: () => void;
  onOpenFeed: () => void;
  level?: MoneyLevel;
}) {
  const p = s.player;
  const family = p.married ? t(`panel.married.${p.spouse!.work}`) : t('panel.single');
  const insurance = [
    p.medicalPremium !== null ? t('panel.insurance.medical') : null,
    p.home?.fireInsured ? t('panel.insurance.fire') : null,
  ].filter(Boolean);
  const owned = ASSET_IDS.filter((id) => assetValue(s, id) >= 0.5);
  return (
    <div className="side-panel">
      <BudgetCard s={s} title={t('panel.budget')} />
      <div className="panel-buttons">
        <button className="secondary feed-button" onClick={onOpenFeed}>
          {t('feed.open')}
        </button>
      </div>
      <div className="card">
        <h4>{t('panel.assets')}</h4>
        <Row k={t('asset.deposit')} v={<AnimatedMoney value={p.cash} level={level} />} />
        {owned.map((id) => (
          <Row key={id} k={holdingName(s, id)} v={formatMoney(assetValue(s, id))} />
        ))}
        {p.home && <Row k={t('asset.realEstate')} v={formatMoney(realEstateValue(s))} />}
        {ASSET_IDS.filter((id) => p.saving[id] > 0).map((id) => (
          <div key={id} className={`muted${p.savingPaused ? ' minus' : ''}`}>
            {t(p.savingPaused ? 'panel.saving.paused' : 'panel.saving', { name: t(`asset.${id}`), amount: p.saving[id] })}
          </div>
        ))}
        {p.talks.length > 0 && <div className="minus">{t('panel.talks', { count: p.talks.length })}</div>}
        <button className="secondary history-button" style={{ marginTop: 8 }} onClick={onOpenHistory}>
          {t('history.open')}
        </button>
      </div>
      <div className="card">
        <h4>{t('panel.job')}</h4>
        <Row k={t(`job.${p.jobId}`)} v={formatMoney(p.salary)} />
        {p.noIncomeMonths > 0 && <div className="minus">{t('panel.noIncome', { months: p.noIncomeMonths })}</div>}
      </div>
      <div className="card">
        <h4>{t('panel.family')}</h4>
        <div>{family}</div>
        {p.children.length > 0 && <div>{t('panel.children', { count: p.children.length })}</div>}
        <div>{p.home ? t('panel.home') : t('panel.rent')}</div>
      </div>
      <div className="card">
        <h4>{t('panel.insurance')}</h4>
        <div>{insurance.length ? insurance.join('、') : t('panel.insurance.none')}</div>
      </div>
    </div>
  );
}
