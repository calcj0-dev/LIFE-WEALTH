// キャラクターの絵（design.md 10.1）。図形を組み合わせた絵（SVG）で描く。
// 盤面の駒（全身）と、顔のアイコン（顔だけ）の両方に使う。座標は、顔の中心を (0, -8) とした向き。

import type { Look } from '../data/characters';

/** 髪（顔の上と横）。顔の円は中心 (0, -8)、半径 17 */
function Hair({ look }: { look: Look }) {
  const c = look.hair;
  switch (look.hairStyle) {
    case 'long':
      return (
        <g fill={c}>
          <path d="M-19,-10 Q0,-36 19,-10 L19,10 Q16,14 13,10 L13,-8 Q0,-20 -13,-8 L-13,10 Q-16,14 -19,10 Z" />
        </g>
      );
    case 'bun':
      return (
        <g fill={c}>
          <circle cx="0" cy="-30" r="8" />
          <path d="M-17,-11 Q0,-34 17,-11 Q8,-18 0,-18 Q-8,-18 -17,-11 Z" />
        </g>
      );
    case 'curly':
      return (
        <g fill={c}>
          {[-14, -7, 0, 7, 14].map((x, i) => (
            <circle key={i} cx={x} cy={-22 + Math.abs(x) * 0.5} r="7" />
          ))}
        </g>
      );
    case 'neat':
      return <path d="M-17,-10 Q-14,-30 4,-27 Q17,-24 17,-10 Q6,-20 -17,-10 Z" fill={c} />;
    case 'tuft':
      // 赤ちゃん: 頭のてっぺんに少しだけ
      return <path d="M-3,-24 Q0,-34 4,-25 Q1,-28 -3,-24 Z" fill={c} />;
    case 'spiky':
      return <path d="M-17,-10 L-15,-28 L-8,-21 L-2,-32 L4,-22 L11,-30 L13,-20 L18,-24 L17,-10 Q0,-18 -17,-10 Z" fill={c} />;
    default:
      return <path d="M-17,-12 Q0,-34 17,-12 Z" fill={c} />;
  }
}

/** 顔（目、めがね・サングラス） */
function Face({ look }: { look: Look }) {
  return (
    <g>
      <circle cx="0" cy="-8" r="17" fill={look.skin} stroke="#fff" strokeWidth="4" />
      <Hair look={look} />
      {look.glasses === 'sunglasses' ? (
        <g fill="#1f1a17">
          <rect x="-12" y="-11" width="10" height="7" rx="3" />
          <rect x="2" y="-11" width="10" height="7" rx="3" />
          <rect x="-2" y="-9" width="4" height="2" />
        </g>
      ) : (
        <g fill="#2d2a32">
          <circle cx="-6" cy="-6" r="2.5" />
          <circle cx="6" cy="-6" r="2.5" />
        </g>
      )}
      {look.glasses === 'glasses' && (
        <g fill="none" stroke="#3a3a3a" strokeWidth="1.8">
          <circle cx="-6" cy="-6" r="5" />
          <circle cx="6" cy="-6" r="5" />
          <path d="M-1,-6 L1,-6" />
        </g>
      )}
      <path d="M-4,1 Q0,4 4,1" fill="none" stroke="#b5654a" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

/** 持ち物（貯金箱、スマホ）。右手のあたりに持つ */
function PropItem({ look }: { look: Look }) {
  if (look.prop === 'piggyBank') {
    return (
      <g transform="translate(20 34)">
        <ellipse cx="0" cy="0" rx="9" ry="7" fill="#ff9fc2" stroke="#fff" strokeWidth="2" />
        <rect x="-3" y="-8" width="6" height="2" rx="1" fill="#c75b84" />
        <circle cx="6" cy="-1" r="1.2" fill="#2d2a32" />
      </g>
    );
  }
  if (look.prop === 'phone') {
    return (
      <g transform="translate(20 32)">
        <rect x="-5" y="-9" width="10" height="17" rx="2.5" fill="#1f1a17" stroke="#fff" strokeWidth="2" />
        <rect x="-3" y="-6" width="6" height="10" rx="1" fill="#4dd0e1" />
      </g>
    );
  }
  return null;
}

/** 全身（盤面の駒）。原点は足もとの少し上。scale で大きさを変える（家族は小さく） */
export function AvatarBody({ look, scale = 1 }: { look: Look; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="52" rx="22" ry="7" fill="rgba(0,0,0,0.2)" />
      <rect x="-17" y="8" width="34" height="42" rx="15" fill={look.color} stroke="#fff" strokeWidth="4" />
      {look.outfit === 'cardigan' && (
        <g fill="#fff">
          <path d="M0,10 L0,48" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
          <circle cx="0" cy="22" r="2" />
          <circle cx="0" cy="32" r="2" />
        </g>
      )}
      {look.outfit === 'jacket' && <path d="M-9,10 L0,26 L9,10" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />}
      <PropItem look={look} />
      <Face look={look} />
    </g>
  );
}

/** 顔のアイコン（順位の欄、ライバルの動きの欄など）。size は表示の大きさ（px） */
export function AvatarIcon({ look, size = 22 }: { look: Look; size?: number }) {
  return (
    <svg className="avatar-icon" width={size} height={size} viewBox="-22 -36 44 44" aria-hidden="true">
      <circle cx="0" cy="-14" r="21" fill={look.color} opacity="0.25" />
      <Face look={look} />
    </svg>
  );
}
