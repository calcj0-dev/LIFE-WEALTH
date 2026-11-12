import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * URLを貼ったときのプレビュー（OGP）の画像は、フルのURLで書く必要がある。
 * Vercel で組み立てるときは、本番のURL（VERCEL_PROJECT_PRODUCTION_URL）を使う。SITE_URL で指定もできる
 */
function siteUrl(): Plugin {
  // Node の型を入れていないので、process は globalThis から取る
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const host = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  const url = (env.SITE_URL ?? (host ? `https://${host}` : '')).replace(/\/$/, '');
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.split('%SITE_URL%').join(url),
  };
}

export default defineConfig({
  plugins: [react(), siteUrl()],
  base: './',
});
