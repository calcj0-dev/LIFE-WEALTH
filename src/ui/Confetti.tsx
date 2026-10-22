// 紙ふぶき（design.md 10.1）。大急騰・相続、ボーナスゲット、結果の画面の1位で出す。
// 「動きを減らす」設定の人には出さない（styles.css で消す）。

const COLORS = ['#ff7a45', '#ffd166', '#58c35c', '#4d96ff', '#ff5d8f', '#9b5de5'];

/** 毎回同じ並びになる、簡単な乱数 */
function seeded(n: number) {
  let s = n * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function Confetti({ count = 48, seed = 1 }: { count?: number; seed?: number }) {
  const rand = seeded(seed);
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: rand() * 100,
    delay: rand() * 0.6,
    duration: 1.8 + rand() * 1.2,
    color: COLORS[i % COLORS.length],
    size: 6 + rand() * 6,
    turn: rand() > 0.5 ? 1 : -1,
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--turn' as string]: p.turn,
          }}
        />
      ))}
    </div>
  );
}
