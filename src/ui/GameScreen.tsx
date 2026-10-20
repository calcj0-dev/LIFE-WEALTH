import { assetValue, netWorth, realEstateValue } from '../game/finance';
import { ASSET_IDS } from '../data/assets';
import type { GameState } from '../game/types';
import { formatMoney, t } from '../i18n';
import { securityPoints } from '../game/score';
import { BudgetCard } from './Setup';

/** ゲージの満タンの点数（見た目の目安） */
const GAUGE_FULL = 250;

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.max(0, Math.min(100, (value / GAUGE_FULL) * 100));
  return (
    <div className="gauge">
      <span className="label">{label}</span>
      <div className="gauge-bar">
        <div style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="value">{Math.round(value)}</span>
    </div>
  );
}

export function Hud({ s }: { s: GameState }) {
  const p = s.player;
  return (
    <div className="hud">
      <div className="hud-age">{t('hud.age', { age: p.age })}</div>
      <div className="hud-item">
        <span className="label">{t('hud.deposit')}</span>
        <span className="value">{formatMoney(p.cash)}</span>
      </div>
      <div className="hud-item">
        <span className="label">{t('hud.netWorth')}</span>
        <span className="value">{formatMoney(netWorth(s))}</span>
      </div>
      <div className="hud-gauges">
        <Gauge label={t('hud.security')} value={securityPoints(netWorth(s))} color="var(--blue)" />
        <Gauge label={t('hud.happyGauge')} value={p.happiness} color="var(--pink)" />
        <span className="hud-total">{t('hud.total', { v: Math.round(securityPoints(netWorth(s)) + p.happiness) })}</span>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function SidePanel({
  s,
  onOpenHistory,
  onOpenManager,
  onOpenNews,
  onOpenYearEnd,
}: {
  s: GameState;
  onOpenHistory: () => void;
  onOpenManager: () => void;
  onOpenNews?: () => void;
  onOpenYearEnd?: () => void;
}) {
  const p = s.player;
  const rentals = p.properties.filter((x) => x.use === 'rental').length;
  const home = p.properties.some((x) => x.use === 'home');
  const family = p.married ? t(`panel.married.${p.spouse!.work}`) : t('panel.single');
  const insurance = [
    p.medicalPremium !== null ? t('panel.insurance.medical') : null,
    p.properties.some((x) => x.fireInsured) ? t('panel.insurance.fire') : null,
  ].filter(Boolean);
  return (
    <div className="side-panel">
      <button className="manage-button" onClick={onOpenManager}>
        {t('manage.open')}
      </button>
      <BudgetCard s={s} title={t('panel.budget')} />
      <div className="panel-buttons">
        <button className="secondary" disabled={!onOpenNews} onClick={onOpenNews}>
          {t('panel.openNews')}
        </button>
        <button className="secondary" disabled={!onOpenYearEnd} onClick={onOpenYearEnd}>
          {t('panel.openYearEnd')}
        </button>
      </div>
      <div className="card">
        <h4>{t('panel.job')}</h4>
        <Row k={t(`job.${p.jobId}`)} v={formatMoney(p.salary)} />
      </div>
      <div className="card">
        <h4>{t('panel.assets')}</h4>
        <Row k={t('asset.deposit')} v={formatMoney(p.cash)} />
        {ASSET_IDS.map((id) => (
          <Row key={id} k={t(`asset.${id}`)} v={formatMoney(assetValue(s, id))} />
        ))}
        <Row k={t('asset.realEstate')} v={formatMoney(realEstateValue(s))} />
        <button className="secondary history-button" style={{ marginTop: 8 }} onClick={onOpenHistory}>
          {t('history.open')}
        </button>
      </div>
      <div className="card">
        <h4>{t('panel.family')}</h4>
        <div>{family}</div>
        {p.children.length > 0 && <div>{t('panel.children', { count: p.children.length })}</div>}
        <div>{home ? t('panel.home') : t('panel.rent')}</div>
        {rentals > 0 && <div>{t('panel.rentals', { count: rentals })}</div>}
      </div>
      <div className="card">
        <h4>{t('panel.insurance')}</h4>
        <div>{insurance.length ? insurance.join('、') : t('panel.insurance.none')}</div>
      </div>
    </div>
  );
}
