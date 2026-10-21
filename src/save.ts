// セーブはブラウザの中（localStorage）に保存する。使えない環境でも遊べるよう、失敗しても止めない。

import type { GameState } from './game/types';

const KEY = 'life-and-wealth.save';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.saveVersion === 2 ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // 保存できなくても遊び続けられるようにする
  }
}
