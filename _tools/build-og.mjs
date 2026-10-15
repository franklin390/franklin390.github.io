// Renders images/og-card.png (1200x630) — the social preview card. Language-neutral (English).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, OUT } from './verify/lib/common.mjs';

const url = (p) => pathToFileURL(path.join(ROOT, p)).href;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:P;src:url("${url('fonts/poppins/poppins-bold-webfont.ttf')}");font-weight:700}
@font-face{font-family:P;src:url("${url('fonts/poppins/poppins-regular-webfont.ttf')}");font-weight:400}
@font-face{font-family:L;src:url("${url('fonts/lora/lora-italic-webfont.ttf')}")}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0E0E0E url("${url('images/intro-bg.svg')}") center/cover;position:relative;overflow:hidden;font-family:P}
.ov{position:absolute;inset:0;background:rgba(14,14,14,.3)}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:#FF0077}
.c{position:absolute;left:90px;top:0;bottom:0;right:90px;display:flex;align-items:center;gap:64px}
img{width:250px;height:250px;border-radius:50%;object-fit:cover;border:6px solid #FF0077;flex:none}
.t{color:#fff}
.k{color:#FF4D9E;font-weight:700;letter-spacing:6px;font-size:22px;text-transform:uppercase;margin-bottom:14px}
h1{font-size:76px;line-height:1.05;font-weight:700;margin-bottom:18px}
.r{font-size:38px;font-weight:700;color:#fff;margin-bottom:22px}
.r span{color:#FF4D9E}
p{font-family:L;font-style:italic;font-size:27px;line-height:1.5;color:rgba(255,255,255,.82);max-width:640px}
.u{position:absolute;right:90px;bottom:40px;color:rgba(255,255,255,.7);font-size:22px;letter-spacing:2px}
</style><div class="ov"></div><div class="bar"></div>
<div class="c"><img src="${url('images/profile-pic.jpg')}"><div class="t">
<div class="k">Portfolio</div><h1>Franklin Ferreira</h1>
<div class="r">Staff Data Engineer</div>
<p>Data architecture · Big Data · Governance · FinOps · Generative AI</p></div></div>
<div class="u">franklin390.github.io</div>`;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(OUT, 'og.html');
fs.writeFileSync(tmp, html);
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(ROOT, 'images/og-card.png') });
await browser.close();
console.log('images/og-card.png written');
