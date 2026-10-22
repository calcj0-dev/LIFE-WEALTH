// タイトル画面の絵（design.md 10.1）。盤面のマスの上に、あなたとライバル2人が並び、コインが浮かぶ。

import { AvatarBody } from '../board/Avatar';
import { SQUARE_COLORS } from '../board/Board';
import { SquareIcon } from '../board/SquareIcon';
import { PLAYER_LOOKS, RIVAL_LOOKS } from '../data/characters';
import type { SquareType } from '../game/types';

const ROW: SquareType[] = ['plusSmall', 'minusMedium', 'stock', 'chance', 'plusLarge', 'family', 'card'];

export function TitleScene() {
  const size = 58;
  const gap = 12;
  const width = ROW.length * (size + gap);
  return (
    <svg className="title-scene" viewBox={`${-width / 2 - 20} -120 ${width + 40} 200`} aria-hidden="true">
      {/* 道 */}
      <rect x={-width / 2 - 14} y={-size / 2 - 10} width={width + 28} height={size + 20} rx={size / 2} fill="#efdcae" />
      {ROW.map((type, i) => {
        const x = -width / 2 + gap / 2 + i * (size + gap) + size / 2;
        return (
          <g key={type} transform={`translate(${x} 0)`}>
            <rect x={-size / 2} y={-size / 2 + 5} width={size} height={size} rx="14" fill="rgba(0,0,0,0.12)" />
            <rect x={-size / 2} y={-size / 2} width={size} height={size} rx="14" fill={SQUARE_COLORS[type]} stroke="#fff" strokeWidth="4" />
            <g transform="scale(0.78)">
              <SquareIcon type={type} />
            </g>
          </g>
        );
      })}
      {/* 3人のキャラクター（あなたは真ん中） */}
      {[
        { look: RIVAL_LOOKS.steady, x: -90 },
        { look: PLAYER_LOOKS[0], x: 0 },
        { look: RIVAL_LOOKS.bold, x: 90 },
      ].map((c, i) => (
        // 動きを付けると位置の指定が上書きされるので、位置と動きを別の重なりにする
        <g key={i} transform={`translate(${c.x} -66)`}>
          <g className={`title-hop title-hop-${i}`}>
            <AvatarBody look={c.look} scale={i === 1 ? 1.15 : 1} />
          </g>
        </g>
      ))}
      {/* 浮かぶコイン */}
      {[
        { x: -170, y: -90 },
        { x: 160, y: -100 },
        { x: -40, y: -112 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`}>
          <g className={`title-coin title-coin-${i}`}>
            <circle r="11" fill="#ffd166" stroke="#e0a800" strokeWidth="2" />
            <path d="M-5,0 L5,0 M0,-5 L0,5" stroke="#c98a00" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      ))}
    </svg>
  );
}
