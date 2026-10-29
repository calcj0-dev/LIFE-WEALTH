// キャラクターの絵（design.md 10.1）。図形を組み合わせた絵（SVG）で描く。
// 盤面の駒（全身）と、顔のアイコン（顔だけ）の両方に使う。座標は、顔の中心を (0, -8) とした向き。

import type { Look } from '../data/characters';

/** 髪（顔の上と横）。顔の円は中心 (0, -8)、半径 17 */
function Hair({ look }: { look: Look }) {
  const c = look.hair;
  switch (look.hairStyle) {
    case 'long':
      // 前髪（横に分ける）。うしろの長い髪は BackHair で、顔より奥に描く
      return <path d="M-18,-9 Q-16,-32 2,-29 Q18,-27 18,-9 Q10,-21 -2,-19 Q-10,-17 -18,-9 Z" fill={c} />;
    case 'bangs':
      // 少し長めの前髪（おでこに少しかかる）
      return <path d="M-18,-8 Q-17,-32 3,-29 Q18,-27 18,-9 L15,-13 Q10,-11 5,-15 L0,-10 Q-6,-14 -10,-12 L-13,-8 Z" fill={c} />;
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

/** 長い髪のうしろの部分（顔より奥、肩にかかる） */
function BackHair({ look }: { look: Look }) {
  if (look.hairStyle !== 'long') return null;
  return <path d="M-20,-10 Q-22,-34 0,-31 Q22,-34 20,-10 L23,20 Q14,25 11,16 L-11,16 Q-14,25 -23,20 Z" fill={look.hair} stroke="#fff" strokeWidth="3" />;
}

/** 顔（目、めがね・サングラス） */
function Face({ look }: { look: Look }) {
  return (
    <g>
      <BackHair look={look} />
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
      {look.lashes && (
        <g>
          <path d="M-9,-9 L-11,-11 M9,-9 L11,-11" stroke="#2d2a32" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="-10" cy="-1" r="2.6" fill="#ff8fa3" opacity="0.6" />
          <circle cx="10" cy="-1" r="2.6" fill="#ff8fa3" opacity="0.6" />
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

/** 服の形ごとの飾り（design.md 10.1） */
function OutfitDetail({ look }: { look: Look }) {
  switch (look.outfit) {
    case 'cardigan':
      return (
        <g fill="#fff">
          <path d="M0,10 L0,48" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
          <circle cx="0" cy="22" r="2" />
          <circle cx="0" cy="32" r="2" />
        </g>
      );
    case 'jacket':
      return <path d="M-9,10 L0,26 L9,10" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />;
    case 'shirt':
      // 白いえりとボタン
      return (
        <g fill="#fff">
          <path d="M-11,10 L-1,19 L-3,11 Z M11,10 L1,19 L3,11 Z" />
          <circle cx="0" cy="27" r="1.8" />
          <circle cx="0" cy="36" r="1.8" />
        </g>
      );
    case 'hoodie':
      // 首のまわりのフード、ひも、おなかのポケット
      return (
        <g>
          <path d="M-14,12 Q0,24 14,12" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinecap="round" />
          <path d="M-4,17 L-4,27 M4,17 L4,27" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <rect x="-10" y="32" width="20" height="9" rx="4" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
        </g>
      );
    case 'blouse':
      // えりもとのリボン
      return (
        <g fill="#fff">
          <path d="M0,16 L-8,11 L-8,21 Z M0,16 L8,11 L8,21 Z" />
          <circle cx="0" cy="16" r="2.6" />
        </g>
      );
    case 'dress':
      // 腰のリボン
      return <path d="M-14,26 Q0,30 14,26" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" />;
    default:
      return null;
  }
}

/** 全身（盤面の駒）。原点は足もとの少し上。scale で大きさを変える（家族は小さく） */
export function AvatarBody({ look, scale = 1 }: { look: Look; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="52" rx="22" ry="7" fill="rgba(0,0,0,0.2)" />
      {look.outfit === 'dress' ? (
        // ワンピースは、すそが広がる形
        <path d="M-13,10 Q0,4 13,10 L21,46 Q0,54 -21,46 Z" fill={look.color} stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      ) : (
        <rect x={look.lashes ? -15 : -17} y="8" width={look.lashes ? 30 : 34} height="42" rx="15" fill={look.color} stroke="#fff" strokeWidth="4" />
      )}
      <OutfitDetail look={look} />
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
