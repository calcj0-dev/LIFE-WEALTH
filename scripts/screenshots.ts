// 画面を自動で撮影する（design.md 11章）。お渡しする前に、撮影した画面を見て、見づらさやまちがいがないかを確かめる。
// 使い方: npm run screenshots -- [保存先のフォルダ]（省略すると screenshots/）
// 環境変数 STEPS で、すすめるターン数を減らせる（例: STEPS=80）
// ゲームを最初から自動で進め、新しい種類の画面が出るたびに1枚撮る。

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';

const OUT = process.argv[2] ?? 'screenshots';
/** 何ターン分すすめるか */
const MAX_STEPS = Number(process.env.STEPS ?? 900);
/** 撮影する画面の大きさ（PC と、横向きのスマホ） */
const VIEWPORTS = [
  { name: 'pc', width: 1366, height: 768, steps: MAX_STEPS },
  // スマホは、主な画面がそろうところまで
  { name: 'phone', width: 844, height: 390, steps: Math.min(160, MAX_STEPS) },
];

mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();

/** ボタンを、書いてある文字で探して押す。見つからなければ false */
async function clickText(page: Page, scope: string, text: string | RegExp): Promise<boolean> {
  const btn = page.locator(`${scope} button:not([disabled])`, { hasText: text }).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  return true;
}

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('crash', () => console.log(`[${vp.name}] 画面が落ちました（${n}枚目のあと、最後の画面: ${lastTitle}）`));
  await page.goto('http://localhost:5199/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const shots = new Set<string>();
  let n = 0;
  const shot = async (name: string, force = false) => {
    if (!force && shots.has(name)) return;
    shots.add(name);
    n++;
    await page.screenshot({ path: join(OUT, `${vp.name}-${String(n).padStart(2, '0')}-${name}.png`) });
  };

  await shot('title');
  await clickText(page, 'body', 'はじめから');
  await page.waitForTimeout(200);
  await shot('years');
  await page.locator('.choice-card', { hasText: process.env.YEARS ?? '10年' }).first().click();
  await clickText(page, 'body', 'この年数で始める');
  await page.waitForTimeout(200);
  await shot('job');
  await clickText(page, 'body', 'ルーレットを回す');
  await page.waitForTimeout(2800);
  await shot('job-result');
  await clickText(page, 'body', 'この人生で始める');
  await page.waitForTimeout(200);
  // ゴールドを毎月2万円積み立てる（取引タイムに「持っている」銘柄が出るように）
  await clickText(page, 'body', '＋1万');
  await clickText(page, 'body', '＋1万');
  await shot('saving');
  await clickText(page, 'body', 'この金額で始める');
  await page.waitForTimeout(300);
  await shot('game');
  // 盤面の全体図
  if (await clickText(page, '.board-area', '全体図')) {
    await page.waitForTimeout(600);
    await shot('overview');
    // ホイールで拡大し、ドラッグで動かす
    const box = await page.locator('.board-area svg.board-overview').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200);
      await page.waitForTimeout(500);
      await shot('overview-zoom');
      await page.mouse.down();
      await page.mouse.move(cx + 200, cy + 120, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      await shot('overview-drag');
      await clickText(page, '.board-zoom', '−');
      await page.waitForTimeout(400);
      await shot('overview-zoomout');
    }
    await clickText(page, '.board-toolbar', '駒を追う');
    await page.waitForTimeout(600);
  }

  let tradeShown = false;
  let lastTitle = '';
  for (let step = 0; step < vp.steps; step++) {
    if (step % 50 === 0) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      const { metrics } = (await cdp.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
      const pick = (k: string) => Math.round(metrics.find((x) => x.name === k)?.value ?? 0);
      const storage = await page.evaluate(() => (localStorage.getItem('life-and-wealth.save') ?? '').length);
      console.log(`[${vp.name}] step ${step} heap ${Math.round(pick('JSHeapUsedSize') / 1e6)}MB nodes ${pick('Nodes')} listeners ${pick('JSEventListeners')} layouts ${pick('LayoutCount')} save ${Math.round(storage / 1000)}KB ${lastTitle}`);
      await cdp.detach();
    }
    if (await page.locator('.result').count()) {
      await shot('result');
      break;
    }
    const modal = page.locator('.overlay .modal').first();
    if (await modal.count()) {
      const title = ((await modal.locator('h2').first().textContent()) ?? '').trim();
      lastTitle = title;
      // 画面の種類ごとに1枚（月や年の数字は外して比べる）
      const kind = title.replace(/\d+年目\s*(\d+(〜\d+)?月)?/g, '').replace(/\s+/g, '');
      await shot(kind.slice(0, 20) || 'modal');
      // 年末の決算: 1回だけ取引タイムを開いて、銘柄を選び、買う画面まで撮る
      if (!tradeShown && (await modal.locator('button', { hasText: '取引タイムへ' }).count())) {
        tradeShown = true;
        await clickText(page, '.overlay', '取引タイムへ');
        await page.waitForTimeout(200);
        await shot('trade');
        await page.locator('.trade-item').nth(1).click();
        await page.waitForTimeout(200);
        await clickText(page, '.trade-panel', '買う');
        await clickText(page, '.trade-panel', '10万円');
        await page.waitForTimeout(100);
        await shot('trade-buy');
        await clickText(page, '.trade-panel', '確定');
        await page.waitForTimeout(100);
        await shot('trade-after');
        for (const tab of ['積み立て', '保険・家']) {
          await clickText(page, '.trade-modal .tabs', tab);
          await page.waitForTimeout(100);
          await shot(`trade-${tab}`);
        }
        await clickText(page, '.overlay', '次の年へ');
        continue;
      }
      // 詳しく開ける行があれば、1回ずつ開いて撮る
      const openable = modal.locator('.summary-item-head:not(.static)').first();
      if ((await openable.count()) && !shots.has(`${kind}-open`)) {
        await openable.click();
        await shot(`${kind}-open`);
      }
      const order = ['ルーレットを回す', '結果を見る', /^次へ/, 'OK', '見送る', '断る', '次の年へ', '結果を見る', /捨てる/, /転職/, /になる/];
      let clicked = false;
      for (const text of order) {
        if (await clickText(page, '.overlay', text)) {
          clicked = true;
          if (process.env.TRACE) console.log(`  ${step} [${title}] → ${String(text)}`);
          break;
        }
      }
      if (!clicked) await modal.locator('button:not([disabled])').first().click();
      await page.waitForTimeout(150);
      // ルーレットが回るのを待つ
      if (await page.locator('.roulette-steps').count()) await page.waitForTimeout(2700);
      continue;
    }
    // ぴったりカードがあれば、数を選ぶ画面（進んだ先のマスの色）を1回撮る
    const exactCard = page.locator('.game-card', { hasText: 'ぴったり' }).locator('button:not([disabled])', { hasText: '使う' });
    if (!shots.has('exact') && (await exactCard.count())) {
      await exactCard.first().click();
      await page.waitForTimeout(150);
      await shot('exact');
      await clickText(page, '.exact-buttons', 'やめる');
    }
    // ふつうのターン: ルーレットを回して、駒の移動を待つ
    if (await clickText(page, '.board-area', 'ルーレットを回す')) {
      if (process.env.TRACE) console.log(`  ${step} ルーレット (${await page.locator('.hud-age').textContent()})`);
      await page.waitForTimeout(2600);
      // 給料と生活費のアクション（浮かぶ金額）を、1回ずつ撮る
      for (let i = 0; i < 12; i++) {
        for (const word of ['お給料', '生活費']) {
          if (!shots.has(`pay-${word}`) && (await page.locator('.side-panel .money-float', { hasText: word }).count())) await shot(`pay-${word}`);
        }
        await page.waitForTimeout(150);
      }
      if (step === 5) await shot('game-after-turns', true);
      continue;
    }
    await page.waitForTimeout(200);
  }
  if (errors.length) console.log(`[${vp.name}] 画面のエラー:\n${errors.join('\n')}`);
  console.log(`[${vp.name}] ${n}枚撮影しました（${OUT}）`);
  await page.close();
}

await browser.close();
await server.close();
