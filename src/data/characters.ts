// キャラクターの見た目（design.md 10.1）。あなたは4人から選び、ライバル2人は決まった見た目。
// 年齢や性別を決めつけない見た目にする。色は、ライバルの色（緑、紫）やマスの色とまぎれないものにする。

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'neat' | 'spiky';
/** 持ち物（ライバルの性格を見せる） */
export type Prop = 'piggyBank' | 'phone';
export type Glasses = 'glasses' | 'sunglasses';

export interface Look {
  id: string;
  /** 服の色。順位の欄やグラフでも、この色を使う */
  color: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  glasses?: Glasses;
  prop?: Prop;
  /** 上着の形（カーディガンはボタン、ジャケットはえり） */
  outfit?: 'cardigan' | 'jacket';
}

/** あなたが選べる4人 */
export const PLAYER_LOOKS: Look[] = [
  { id: 'sun', color: '#ff7a45', skin: '#ffd9b8', hair: '#5a3b2e', hairStyle: 'short' },
  { id: 'sky', color: '#4d96ff', skin: '#f1c27d', hair: '#2d2a32', hairStyle: 'long' },
  { id: 'lemon', color: '#f2b400', skin: '#e0ac69', hair: '#3b2a20', hairStyle: 'bun' },
  { id: 'berry', color: '#ff5d8f', skin: '#c68642', hair: '#1f1a17', hairStyle: 'curly' },
];
export const DEFAULT_LOOK = PLAYER_LOOKS[0].id;

/** ライバル2人。コツコツさんは緑のカーディガンにめがね、貯金箱。イケイケさんは紫のジャケットにサングラス、スマホ */
export const RIVAL_LOOKS: Record<'steady' | 'bold', Look> = {
  steady: { id: 'steady', color: '#3cb371', skin: '#ffe0c4', hair: '#6b5a4e', hairStyle: 'neat', glasses: 'glasses', prop: 'piggyBank', outfit: 'cardigan' },
  bold: { id: 'bold', color: '#9b5de5', skin: '#f5c9a0', hair: '#c47a2c', hairStyle: 'spiky', glasses: 'sunglasses', prop: 'phone', outfit: 'jacket' },
};

export const lookById = (id: string | undefined): Look => PLAYER_LOOKS.find((l) => l.id === id) ?? PLAYER_LOOKS[0];
