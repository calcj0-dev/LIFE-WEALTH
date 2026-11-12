// URLを貼ったときのプレビュー画像（OGP。1200×630）を作る。タイトル画面の絵を使う。
// 使い方: npm run og-image（public/og-image.png を作り直す）

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { TitleScene } from '../src/ui/TitleScene';

const scene = renderToStaticMarkup(createElement(TitleScene));
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  body { margin: 0; }
  .card {
    width: 1200px; height: 630px; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 35%, #fffaf1 0%, #fff1d6 70%, #ffe3b0 100%);
    font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif;
    border: 18px solid #ffb85c;
  }
  .card svg { width: 860px; height: auto; }
  h1 { margin: 6px 0 0; font-size: 96px; font-weight: 900; letter-spacing: 0.04em; color: #ff7a45; }
  h1 span { color: #2ec4b6; }
  p { margin: 10px 0 0; font-size: 34px; font-weight: 700; color: #5a4a3a; }
</style></head><body><div class="card">${scene}<h1>LIFE <span>&amp;</span> WEALTH</h1><p>投資とライフイベントで学ぶ、人生ボードゲーム</p></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.locator('.card').screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('public/og-image.png を作りました');
