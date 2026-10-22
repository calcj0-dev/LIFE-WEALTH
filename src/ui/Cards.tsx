// 手札のカード。ルーレットを回す前に、1ターン1枚まで使える（design.md 3.9）。

import { useState } from 'react';
import { SQUARE_COLORS } from '../board/Board';
import { BOARD } from '../data/board';
import { CARDS_BY_ID, HAND_MAX } from '../data/cards';
import { ROULETTE_MAX } from '../data/rules';
import { bonusDistance } from '../game/engine';
import type { GameState } from '../game/types';
import { t } from '../i18n';

export const CARD_ICONS: Record<string, string> = {
  dash: '👟',
  superDash: '🚀',
  exact: '🎯',
  trade: '🔄',
};

export const cardIcon = (id: string) => CARD_ICONS[id] ?? '🃏';

interface Props {
  s: GameState;
  /** 今カードを使えるか */
  canUse: boolean;
  /** 移動のカードを使う（ぴったりのときは exact に進む数） */
  onMove: (index: number, exact?: number) => void;
  /** 取引カードを使う */
  onTrade: (index: number) => void;
}

export function CardHand({ s, canUse, onMove, onTrade }: Props) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const hand = s.player.hand;
  const usable = canUse && !s.cardUsed;
  return (
    <div className="card-hand">
      <div className="card-hand-head">
        <span>{t('cards.title', { count: hand.length, max: HAND_MAX })}</span>
        <span className="bonus-distance">{t('cards.bonus', { n: bonusDistance(s) })}</span>
      </div>
      {hand.length === 0 && <div className="muted">{t('cards.empty')}</div>}
      <div className="card-list">
        {hand.map((id, i) => (
          <div key={i} className="game-card">
            <div className="game-card-name">
              {cardIcon(id)} {t(`card.${id}`)}
            </div>
            <div className="muted game-card-text">{t(`card.${id}.text`)}</div>
            {usable && choosing !== i && (
              <button
                className="small"
                onClick={() => {
                  const kind = CARDS_BY_ID[id].kind;
                  if (kind === 'exact') setChoosing(i);
                  else if (kind === 'trade') onTrade(i);
                  else onMove(i);
                }}
              >
                {t('cards.use')}
              </button>
            )}
            {usable && choosing === i && (
              <div className="exact-buttons">
                {/* ボタンは、その数だけ進んだ先のマスの色にする。赤いマスを避けたり、ボーナスマスをねらったりできる（design.md 3.3） */}
                {Array.from({ length: ROULETTE_MAX }, (_, k) => k + 1).map((n) => {
                  const target = (s.player.position + n) % BOARD.length;
                  const type = BOARD[target].type;
                  const bonus = target === s.bonusSquare;
                  return (
                    <button
                      key={n}
                      className={`small exact-button${bonus ? ' bonus' : ''}`}
                      style={{ background: SQUARE_COLORS[type] }}
                      title={bonus ? t('cards.exactBonus') : t(`squareType.${type}`)}
                      onClick={() => {
                        setChoosing(null);
                        onMove(i, n);
                      }}
                    >
                      {n}
                      {bonus && '★'}
                    </button>
                  );
                })}
                <button className="secondary small" onClick={() => setChoosing(null)}>
                  {t('cards.cancel')}
                </button>
                <div className="muted exact-hint">{t('cards.exactHint')}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
