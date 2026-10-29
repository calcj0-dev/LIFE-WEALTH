// キャラクターの見た目（design.md 10.1）。あなたは4人（男性2人、女性2人。段階8）から選び、ライバル2人は決まった見た目。
// 4人は、髪型、服の形、色の3つで見分けられるようにする。色は、ライバルの色（緑、紫）やマスの色とまぎれないものにする。

export type HairStyle = 'short' | 'bangs' | 'long' | 'bun' | 'curly' | 'neat' | 'spiky' | 'tuft';
/** 服の形（カーディガンはボタン、ジャケットはえり、シャツは白いえり、パーカーはフード、ワンピースはすそが広がる、ブラウスはリボン） */
export type Outfit = 'cardigan' | 'jacket' | 'shirt' | 'hoodie' | 'dress' | 'blouse';
export type Glasses = 'glasses' | 'sunglasses';

export interface Look {
  id: string;
  /** 服の色。順位の欄やグラフでも、この色を使う */
  color: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  glasses?: Glasses;
  outfit?: Outfit;
  /** まつ毛とほおの赤み（女性の見た目） */
  lashes?: boolean;
}

/** あなたが選べる4人（男性2人、女性2人。design.md 10.1） */
export const PLAYER_LOOKS: Look[] = [
  // 男性1: 短い髪、オレンジのシャツ
  { id: 'sun', color: '#ff7a45', skin: '#ffd9b8', hair: '#5a3b2e', hairStyle: 'short', outfit: 'shirt' },
  // 男性2: 少し長めの前髪、青のパーカー
  { id: 'sky', color: '#4d96ff', skin: '#f1c27d', hair: '#2d2a32', hairStyle: 'bangs', outfit: 'hoodie' },
  // 女性1: 長い髪、ピンクのワンピース
  { id: 'berry', color: '#ff5d8f', skin: '#ffe0c4', hair: '#6b3a24', hairStyle: 'long', outfit: 'dress', lashes: true },
  // 女性2: お団子、黄色のブラウス
  { id: 'lemon', color: '#f2b400', skin: '#e0ac69', hair: '#3b2a20', hairStyle: 'bun', outfit: 'blouse', lashes: true },
];
export const DEFAULT_LOOK = PLAYER_LOOKS[0].id;

/** ライバル2人。コツコツさんは緑のカーディガンにめがね。イケイケさんは紫のジャケットにサングラス（持ち物は段階8でなくした） */
export const RIVAL_LOOKS: Record<'steady' | 'bold', Look> = {
  steady: { id: 'steady', color: '#3cb371', skin: '#ffe0c4', hair: '#6b5a4e', hairStyle: 'neat', glasses: 'glasses', outfit: 'cardigan' },
  bold: { id: 'bold', color: '#9b5de5', skin: '#f5c9a0', hair: '#c47a2c', hairStyle: 'spiky', glasses: 'sunglasses', outfit: 'jacket' },
};

export const lookById = (id: string | undefined): Look => PLAYER_LOOKS.find((l) => l.id === id) ?? PLAYER_LOOKS[0];

// ---------------------------------------------------------------- 家族（design.md 10.1）

/** 配偶者の見た目（結婚したときに、この中から決まる） */
export const SPOUSE_LOOKS: Look[] = [
  { id: 'spouseA', color: '#7bc4e8', skin: '#ffd9b8', hair: '#3b2a20', hairStyle: 'long' },
  { id: 'spouseB', color: '#f4a261', skin: '#e0ac69', hair: '#2d2a32', hairStyle: 'short' },
  { id: 'spouseC', color: '#e9a6c7', skin: '#f1c27d', hair: '#5a3b2e', hairStyle: 'bun' },
  { id: 'spouseD', color: '#90be6d', skin: '#c68642', hair: '#1f1a17', hairStyle: 'curly' },
];

/** 子どもの服の色と髪型（生まれた順に決まる） */
const CHILD_COLORS = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2'];
const CHILD_HAIR: HairStyle[] = ['short', 'bun', 'curly', 'long'];

/** 家族1人分（駒のうしろに並ぶ） */
export interface FamilyMember {
  look: Look;
  /** 大きさ（あなたを1とした割合） */
  scale: number;
}

/** 決まった計算で、0以上 n 未満の数を選ぶ（同じゲームなら、いつも同じ見た目になるように） */
function pick(seed: number, salt: string, n: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 2654435761) >>> 0;
  return h % n;
}

/**
 * 駒のうしろに並ぶ家族（配偶者と、独立していない子ども）。見た目は、ゲームのシード値とだれかから決まる。
 * 子どもは赤ちゃん（2歳まで）は小さく、大きくなると少し大きくなる
 */
export function familyOf(seed: number, who: string, married: boolean, children: { age: number; independent: boolean }[], parent: Look): FamilyMember[] {
  const members: FamilyMember[] = [];
  if (married) members.push({ look: SPOUSE_LOOKS[pick(seed, `${who}-spouse`, SPOUSE_LOOKS.length)], scale: 0.62 });
  children.forEach((c, i) => {
    if (c.independent) return;
    const baby = c.age <= 2;
    const look: Look = {
      id: `${who}-child${i}`,
      color: CHILD_COLORS[pick(seed, `${who}-child${i}`, CHILD_COLORS.length)],
      // 子どもの肌は、親（あなた）に近い色にする
      skin: parent.skin,
      hair: parent.hair,
      hairStyle: baby ? 'tuft' : CHILD_HAIR[pick(seed, `${who}-hair${i}`, CHILD_HAIR.length)],
    };
    members.push({ look, scale: baby ? 0.36 : c.age < 12 ? 0.46 : 0.56 });
  });
  return members;
}
