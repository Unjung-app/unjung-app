// brand/*.svg → 앱·웹 아이콘 PNG 일괄 생성. 로고를 바꾸면: python3 brand/make.py && node scripts/brand-icons.cjs
// (Playwright 크로미움으로 SVG를 그려 PNG로 저장한다)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const b = (f) => path.join(root, 'brand', f);
const JOBS = [
  ['icon-B-rounded.svg', 'public/icons/icon-192.png', 192],
  ['icon-B-rounded.svg', 'public/icons/icon-512.png', 512],
  ['icon-B-maskable.svg', 'public/icons/maskable-512.png', 512],
  ['icon-B-square.svg', 'public/icons/apple-touch-icon.png', 180],
  ['icon-B-square.svg', 'assets/images/icon.png', 1024],
  ['icon-B-rounded.svg', 'assets/images/favicon.png', 48],
  ['icon-B-adaptive-fg.svg', 'assets/images/android-icon-foreground.png', 1024],
  ['icon-B-mono.svg', 'assets/images/android-icon-monochrome.png', 1024],
  ['splash-B.svg', 'assets/images/splash-icon.png', 512],
  ['logo-A-navy.svg', 'public/brand/logo-A-navy.png', 2048],
  ['logo-C-light.svg', 'public/brand/logo-C-light.png', 2048],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, out, size] of JOBS) {
    const svg = fs.readFileSync(b(src), 'utf8');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
    await page.screenshot({ path: path.join(root, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(out, size);
  }
  // 포스터·인쇄용 원본 SVG도 웹에 공개 (/brand/...)
  for (const f of ['logo-A-navy.svg', 'logo-C-light.svg', 'mark-A-white.svg', 'mark-C-navy.svg']) {
    fs.copyFileSync(b(f), path.join(root, 'public/brand', f));
  }
  await browser.close();
})();
