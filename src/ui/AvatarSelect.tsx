// あなたのキャラクターを選ぶ画面（design.md 10.1）。「はじめから」を押したあとに出す。

import { useState } from 'react';
import { AvatarBody } from '../board/Avatar';
import { DEFAULT_LOOK, PLAYER_LOOKS, RIVAL_LOOKS } from '../data/characters';
import { t } from '../i18n';
import { rivalName } from './Rivals';

export function AvatarSelect({ onDone }: { onDone: (avatar: string) => void }) {
  const [picked, setPicked] = useState(DEFAULT_LOOK);
  return (
    <div className="center-screen">
      <h2>{t('avatar.title')}</h2>
      <div className="avatar-select">
        {PLAYER_LOOKS.map((look) => (
          <button key={look.id} className={`avatar-choice secondary${picked === look.id ? ' selected' : ''}`} onClick={() => setPicked(look.id)} aria-pressed={picked === look.id}>
            <svg viewBox="-40 -45 80 105" aria-hidden="true">
              <AvatarBody look={look} />
            </svg>
          </button>
        ))}
      </div>
      <p className="muted">{t('avatar.lead')}</p>
      <div className="avatar-rivals">
        {(['steady', 'bold'] as const).map((id) => (
          <div key={id}>
            <svg viewBox="-40 -45 80 105" aria-hidden="true">
              <AvatarBody look={RIVAL_LOOKS[id]} />
            </svg>
            <div className="muted">{rivalName(id)}</div>
          </div>
        ))}
      </div>
      <button onClick={() => onDone(picked)}>{t('avatar.start')}</button>
    </div>
  );
}
