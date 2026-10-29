// マスの絵（design.md 3.1、10.1）。絵文字は端末ごとに見た目が変わるので、図形を組み合わせた絵（SVG）で描く。
// 原点はマスの中心。マスの大きさは 74 なので、絵は -26〜26 くらいに収める。白を基本にして、どのマスの色にも合うようにする。

import type { SquareType } from '../game/types';

const W = '#ffffff';
const INK = 'rgba(0,0,0,0.28)';

/** お金のコイン。sign が + ならプラス、− ならマイナス */
function Coin({ x, y, r, sign }: { x: number; y: number; r: number; sign: '+' | '-' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={sign === '+' ? '#ffe066' : W} stroke={INK} strokeWidth="2" />
      <circle r={r * 0.72} fill="none" stroke={sign === '+' ? '#e0a800' : '#f25c54'} strokeWidth="2" opacity="0.7" />
      <rect x={-r * 0.45} y={-r * 0.12} width={r * 0.9} height={r * 0.24} rx="1.5" fill={sign === '+' ? '#c98a00' : '#d63a33'} />
      {sign === '+' && <rect x={-r * 0.12} y={-r * 0.45} width={r * 0.24} height={r * 0.9} rx="1.5" fill="#c98a00" />}
    </g>
  );
}

/** 出来事の大きさ（1〜3）の数だけ、コインを並べる */
function Coins({ n, sign }: { n: number; sign: '+' | '-' }) {
  const r = n === 1 ? 18 : n === 2 ? 14 : 11;
  const xs = n === 1 ? [0] : n === 2 ? [-12, 12] : [-17, 0, 17];
  const ys = n === 3 ? [5, -6, 5] : xs.map(() => 0);
  return (
    <g>
      {xs.map((x, i) => (
        <Coin key={i} x={x} y={ys[i]} r={r} sign={sign} />
      ))}
    </g>
  );
}

export function SquareIcon({ type, married }: { type: SquareType; married?: boolean }) {
  switch (type) {
    case 'plusSmall':
      return <Coins n={1} sign="+" />;
    case 'plusMedium':
      return <Coins n={2} sign="+" />;
    case 'plusLarge':
      return <Coins n={3} sign="+" />;
    case 'minusSmall':
      return <Coins n={1} sign="-" />;
    case 'minusMedium':
      return <Coins n={2} sign="-" />;
    case 'minusLarge':
      return <Coins n={3} sign="-" />;
    case 'chance':
      // きらきら（4つの角の星）
      return (
        <g fill={W} stroke={INK} strokeWidth="1.5">
          <path d="M0,-22 Q3,-3 22,0 Q3,3 0,22 Q-3,3 -22,0 Q-3,-3 0,-22 Z" />
          <path d="M15,-17 Q16,-13 20,-12 Q16,-11 15,-7 Q14,-11 10,-12 Q14,-13 15,-17 Z" />
        </g>
      );
    case 'start':
      // 旗。右下に小さなカード（止まるとカードがもらえる。design.md 3.3）
      return (
        <g>
          <g transform="translate(17 15) rotate(10)">
            <rect x="-8" y="-11" width="16" height="22" rx="3" fill={W} stroke={INK} strokeWidth="1.5" />
            <text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#4d96ff">
              ?
            </text>
          </g>
          <rect x="-14" y="-22" width="4" height="44" rx="2" fill="#6b4a2b" />
          <g transform="translate(-10 -22)">
            {[0, 1, 2].map((row) =>
              [0, 1, 2, 3].map((col) => (
                <rect key={`${row}-${col}`} x={col * 7} y={row * 7} width="7" height="7" fill={(row + col) % 2 ? '#2d2a32' : W} />
              )),
            )}
          </g>
        </g>
      );
    case 'family':
      return married ? (
        // 赤ちゃん
        <g>
          <circle cy="2" r="17" fill="#ffe0c4" stroke={INK} strokeWidth="2" />
          <path d="M-2,-14 Q2,-22 6,-14" fill="none" stroke="#6b4a2b" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="-6" cy="0" r="2.2" fill="#2d2a32" />
          <circle cx="6" cy="0" r="2.2" fill="#2d2a32" />
          <path d="M-4,8 Q0,11 4,8" fill="none" stroke="#c75b84" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        // 指輪
        <g>
          <circle cy="5" r="15" fill="none" stroke="#ffe066" strokeWidth="6" />
          <circle cy="5" r="15" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M-8,-13 L0,-23 L8,-13 L0,-8 Z" fill="#bde7ff" stroke={W} strokeWidth="2" />
        </g>
      );
    case 'job':
      // カバン（転職）
      return (
        <g>
          <rect x="-8" y="-20" width="16" height="9" rx="3" fill="none" stroke={W} strokeWidth="4" />
          <rect x="-22" y="-13" width="44" height="32" rx="6" fill={W} stroke={INK} strokeWidth="2" />
          <rect x="-22" y="-2" width="44" height="4" fill="#3f6fb5" opacity="0.5" />
          <rect x="-4" y="-5" width="8" height="9" rx="2" fill="#ffd166" stroke={INK} strokeWidth="1" />
        </g>
      );
    case 'card':
      return (
        <g>
          <rect x="-15" y="-20" width="26" height="36" rx="4" fill={W} stroke={INK} strokeWidth="2" transform="rotate(-10)" />
          <rect x="-9" y="-18" width="26" height="36" rx="4" fill={W} stroke={INK} strokeWidth="2" transform="rotate(8)" />
          <text x="4" y="8" textAnchor="middle" fontSize="20" fontWeight="900" fill="#4d96ff">
            ?
          </text>
        </g>
      );
    case 'luckyCard':
      // 四つ葉
      return (
        <g fill="#7ee08a" stroke={W} strokeWidth="2">
          <circle cx="-8" cy="-8" r="10" />
          <circle cx="8" cy="-8" r="10" />
          <circle cx="-8" cy="8" r="10" />
          <circle cx="8" cy="8" r="10" />
          <path d="M2,10 Q8,20 4,26" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'stock':
      // 右肩上がりのグラフ
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-20,18 L20,18 M-20,18 L-20,-18" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
          <path d="M-15,10 L-5,0 L3,6 L16,-12" stroke={W} strokeWidth="5" />
          <path d="M8,-13 L17,-13 L17,-4" stroke={W} strokeWidth="5" />
        </g>
      );
    case 'investTalk':
      // ふきだしと「！」（うまい話に注意）
      return (
        <g>
          <path d="M-20,-16 Q-20,-22 -14,-22 L14,-22 Q20,-22 20,-16 L20,6 Q20,12 14,12 L-2,12 L-10,21 L-9,12 L-14,12 Q-20,12 -20,6 Z" fill={W} stroke={INK} strokeWidth="2" />
          <rect x="-2.5" y="-17" width="5" height="16" rx="2.5" fill="#f25c54" />
          <circle cx="0" cy="5" r="3" fill="#f25c54" />
        </g>
      );
    case 'gamble':
      // サイコロ
      return (
        <g>
          <rect x="-18" y="-18" width="36" height="36" rx="8" fill={W} stroke={INK} strokeWidth="2" transform="rotate(-8)" />
          <g fill="#9b5de5" transform="rotate(-8)">
            <circle cx="-8" cy="-8" r="3.5" />
            <circle cx="0" cy="0" r="3.5" />
            <circle cx="8" cy="8" r="3.5" />
          </g>
        </g>
      );
    case 'realEstate':
      return (
        <g>
          <path d="M-22,0 L0,-20 L22,0" fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="-15" y="-2" width="30" height="22" rx="2" fill={W} stroke={INK} strokeWidth="2" />
          <rect x="-4" y="7" width="8" height="13" rx="1" fill="#f9a03f" />
        </g>
      );
  }
}
