// 「このゲームについて」の画面（design.md 10.3）。免責の全文と、数値の出典の一覧を出す。タイトル画面から開く

import { SOURCES } from '../data/sources';
import { t } from '../i18n';

/** 免責の文（全文） */
const DISCLAIMERS = ['about.disclaimer.advice', 'about.disclaimer.fiction', 'about.disclaimer.numbers', 'about.disclaimer.own'];

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal about" onClick={(e) => e.stopPropagation()}>
        <h2>{t('about.title')}</h2>
        <p>{t('app.subtitle')}</p>
        <h3>{t('about.disclaimer')}</h3>
        <ul>
          {DISCLAIMERS.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <h3>{t('about.sources')}</h3>
        <p className="muted">{t('about.sourcesLead')}</p>
        <ul className="about-sources">
          {SOURCES.map((src) => (
            <li key={src.key}>
              <span className="about-source-key">{t(src.key)}: </span>
              {src.url ? (
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.title}
                </a>
              ) : (
                src.title
              )}
            </li>
          ))}
        </ul>
        <div className="options">
          <button onClick={onClose}>{t('about.close')}</button>
        </div>
      </div>
    </div>
  );
}
