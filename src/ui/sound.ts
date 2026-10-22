// 効果音（design.md 10.1）。外の素材は使わず、ブラウザの音を合成する仕組み（Web Audio）で作る。
// 「音を消す」を押したかどうかは、ブラウザに覚えておく。音が出せない環境でも、ゲームは止めない。

const MUTE_KEY = 'life-and-wealth.muted';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isMuted = () => muted;

export function setMuted(on: boolean) {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    // 覚えておけなくても、今の画面では音を消す
  }
  listeners.forEach((f) => f());
}

/** 「音を消す」が変わったら知らせる（ボタンの見た目を変えるため） */
export function onMuteChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** 音を出す準備。ブラウザは、画面を押すまで音を出させないので、そのときは何もしない */
function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * 1つの音。at は鳴らし始めるまでの秒、dur は長さの秒。to を渡すと、高さがそこまで動く。
 * 音量は、鳴らし始めにすぐ上がり、だんだん小さくなる
 */
function tone(a: AudioContext, freq: number, at: number, dur: number, opt: { type?: OscillatorType; volume?: number; to?: number } = {}) {
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opt.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opt.to) osc.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
  const v = opt.volume ?? 0.12;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** ざらざらした音（ドーンという低い音に使う） */
function noise(a: AudioContext, at: number, dur: number, volume: number) {
  const t0 = a.currentTime + at;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

const play = (f: (a: AudioContext) => void) => () => {
  const a = audio();
  if (a) f(a);
};

/** 鳴らす音の一覧 */
export const sfx = {
  /** ルーレットが回る: カタカタカタ…と、だんだん遅くなる（ms はルーレットが回る時間） */
  spin: (ms: number) =>
    play((a) => {
      let t = 0;
      let gap = 0.04;
      while (t < ms / 1000 - 0.1) {
        tone(a, 1400, t, 0.03, { type: 'square', volume: 0.04 });
        t += gap;
        gap *= 1.09;
      }
    })(),
  /** 駒が1マス進む: ポッ（ライバルは小さめ） */
  step: (quiet = false) => play((a) => tone(a, 660, 0, 0.08, { type: 'triangle', volume: quiet ? 0.04 : 0.09, to: 880 }))(),
  /** お金が増える: チャリン♪ */
  coin: play((a) => {
    tone(a, 1318, 0, 0.12, { type: 'square', volume: 0.06 });
    tone(a, 1976, 0.08, 0.3, { type: 'square', volume: 0.06 });
  }),
  /** お金が減る: ブブッ */
  loss: play((a) => {
    tone(a, 180, 0, 0.12, { type: 'sawtooth', volume: 0.07 });
    tone(a, 140, 0.13, 0.16, { type: 'sawtooth', volume: 0.07 });
  }),
  /** 大暴落など: ドーン */
  boom: play((a) => {
    tone(a, 120, 0, 0.8, { volume: 0.25, to: 40 });
    noise(a, 0, 0.7, 0.35);
  }),
  /** 大急騰・相続、順位が上がる: ジャジャーン♪ */
  fanfare: play((a) => {
    [523, 659, 784].forEach((f, i) => tone(a, f, i * 0.09, 0.2, { type: 'square', volume: 0.06 }));
    tone(a, 1046, 0.27, 0.5, { type: 'square', volume: 0.07 });
  }),
  /** 順位が上がる: 短いファンファーレ */
  rankUp: play((a) => {
    tone(a, 784, 0, 0.1, { type: 'square', volume: 0.05 });
    tone(a, 1046, 0.1, 0.25, { type: 'square', volume: 0.06 });
  }),
  /** ボーナスゲット: キラキラ♪と上がっていく */
  bonus: play((a) => {
    [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(a, f, i * 0.07, 0.25, { type: 'triangle', volume: 0.08 }));
  }),
  /** ボーナスを取られた: ガーン（下がっていく） */
  bonusTaken: play((a) => {
    [392, 330, 262].forEach((f, i) => tone(a, f, i * 0.18, 0.3, { type: 'sawtooth', volume: 0.06 }));
    tone(a, 196, 0.54, 0.7, { type: 'sawtooth', volume: 0.07, to: 150 });
  }),
};
