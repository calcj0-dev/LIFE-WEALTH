// 「音を消す」ボタン（design.md 10.1）。盤面の左上に置く。

import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { isMuted, onMuteChange, setMuted } from './sound';

export function MuteButton() {
  const [muted, setState] = useState(isMuted());
  useEffect(() => onMuteChange(() => setState(isMuted())), []);
  const label = t(muted ? 'sound.off' : 'sound.on');
  return (
    <button className="secondary mute-button" onClick={() => setMuted(!muted)} aria-label={label} title={label} aria-pressed={muted}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
