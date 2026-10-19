import { ASSET_IDS } from '../data/assets';
import { newsById } from '../game/market';
import { getOptions } from '../game/engine';
import type { GameState } from '../game/types';
import { formatMoney, formatSigned, t } from '../i18n';
import { SQUARE_COLORS } from '../board/Board';
import { describeDecision } from './decisionText';

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay">
      <div className="modal">{children}</div>
    </div>
  );
}

export function NewsModal({ s, onNext }: { s: GameState; onNext: () => void }) {
  const news = newsById(s.newsId!);
  const changes = [...ASSET_IDS, 'realEstate' as const]
    .map((id) => ({ id, shock: news.shocks[id] ?? 0 }))
    .filter((c) => c.shock !== 0);
  return (
    <Overlay>
      <div className="muted">{t('news.heading', { age: s.player.age })}</div>
      <h2>{t(`news.${news.id}.title`)}</h2>
      <p>{t(`news.${news.id}.text`)}</p>
      {changes.length > 0 && (
        <table className="table">
          <tbody>
            {changes.map((c) => (
              <tr key={c.id}>
                <td>{t(`asset.${c.id}`)}</td>
                <td className={c.shock > 0 ? 'plus' : 'minus'}>{formatSigned(c.shock * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">
        {t('hud.economy')}: {t(`economy.${s.market.economy}`)}
      </p>
      {news.important && <p><strong>{t('news.important')}</strong></p>}
      <div className="options">
        <button onClick={onNext}>{t('news.next')}</button>
      </div>
    </Overlay>
  );
}

export function DecisionModal({ s, onChoose }: { s: GameState; onChoose: (id: string) => void }) {
  const { title, text, squareType } = describeDecision(s);
  const options = getOptions(s);
  return (
    <Overlay>
      {squareType && (
        <span className="tag" style={{ background: SQUARE_COLORS[squareType] }}>
          {t(`squareType.${squareType}`)}
        </span>
      )}
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.id}
            className={o.id === 'skip' || o.id === 'decline' ? 'secondary' : undefined}
            disabled={!o.enabled}
            title={o.enabled ? undefined : t('decision.unavailable')}
            onClick={() => onChoose(o.id)}
          >
            {t(o.key, o.params)}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function MoneyRows({ items }: { items: Record<string, number> }) {
  return (
    <>
      {Object.entries(items)
        .filter(([, v]) => Math.round(v) !== 0)
        .map(([k, v]) => (
          <tr key={k}>
            <td>{t(`settle.${k}`)}</td>
            <td>{formatMoney(v)}</td>
          </tr>
        ))}
    </>
  );
}

export function YearEndModal({ s, onNext, last }: { s: GameState; onNext: () => void; last: boolean }) {
  const st = s.lastSettlement!;
  return (
    <Overlay>
      <h2>{t('yearEnd.heading', { age: st.age })}</h2>
      <table className="table">
        <tbody>
          <tr>
            <td colSpan={2}><strong className="plus">{t('yearEnd.income')}</strong></td>
          </tr>
          <MoneyRows items={st.income} />
          <tr>
            <td colSpan={2}><strong className="minus">{t('yearEnd.expense')}</strong></td>
          </tr>
          <MoneyRows items={st.expense} />
          <tr>
            <td><strong>{t('yearEnd.net')}</strong></td>
            <td className={st.net >= 0 ? 'plus' : 'minus'}>{formatMoney(st.net)}</td>
          </tr>
          {st.invested > 0 && (
            <tr>
              <td>{t('yearEnd.invested')}</td>
              <td>{formatMoney(st.invested)}</td>
            </tr>
          )}
          {st.sold > 0 && (
            <tr>
              <td>{t('yearEnd.sold')}</td>
              <td className="minus">{formatMoney(st.sold)}</td>
            </tr>
          )}
          {st.borrowed > 0 && (
            <tr>
              <td>{t('yearEnd.borrowed')}</td>
              <td className="minus">{formatMoney(st.borrowed)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="options">
        <button onClick={onNext}>{t(last ? 'yearEnd.finish' : 'yearEnd.next')}</button>
      </div>
    </Overlay>
  );
}
