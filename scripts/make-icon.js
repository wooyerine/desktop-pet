/* 앱 아이콘 생성 — build/icon.png (1024px)
 *
 *   npx electron scripts/make-icon.js
 *
 * 펫 그림을 따로 그려두면 pet.js를 고칠 때마다 어긋나므로,
 * index.html을 그대로 띄워 pet.js의 도트를 크게 렌더해서 잘라 쓴다. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'icon.png');

const BG = ['#f4e6c8', '#e0c9a0']; // 앱 속 책상/말풍선과 같은 크림 톤
const BORDER = '#1e1a1e';

const CODE = `(function () {
  const S = 24;                       // 도트 한 칸을 크게 그린 뒤 축소해 매끈하게
  const prev = { S: SCALE, H: HALF, w: canvas.width, h: canvas.height };
  SCALE = S; HALF = S / 2;
  canvas.width = SCENE_W * S; canvas.height = SCENE_H * S;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderPet(EYE_OPEN, 0);

  const sx = (PET_X - 1) * S, sy = (PET_Y - 1) * S, sw = 22 * S, sh = 18 * S;

  const N = 1024;
  const out = document.createElement('canvas');
  out.width = out.height = N;
  const o = out.getContext('2d');

  // macOS 관례대로 여백을 두고 둥근 사각형 배경
  const pad = Math.round(N * 0.055);
  const box = N - pad * 2;
  const r = Math.round(box * 0.225);
  const g = o.createLinearGradient(pad, pad, pad, pad + box);
  g.addColorStop(0, ${JSON.stringify(BG[0])});
  g.addColorStop(1, ${JSON.stringify(BG[1])});
  o.beginPath(); o.roundRect(pad, pad, box, box, r); o.fillStyle = g; o.fill();
  o.lineWidth = Math.round(N * 0.022); o.strokeStyle = ${JSON.stringify(BORDER)}; o.stroke();

  // 어깨가 아래로 흘러나가 잘리도록 (반신 초상처럼)
  o.save();
  o.beginPath(); o.roundRect(pad, pad, box, box, r); o.clip();
  o.imageSmoothingEnabled = false;
  const dw = Math.round(box * 0.9);
  const dh = Math.round(dw * (sh / sw));
  o.drawImage(canvas, sx, sy, sw, sh,
    Math.round((N - dw) / 2), Math.round(pad + box * 0.26), dw, dh);
  o.restore();

  SCALE = prev.S; HALF = prev.H; canvas.width = prev.w; canvas.height = prev.h;
  ctx.imageSmoothingEnabled = false;
  return out.toDataURL();
})()`;

app.whenReady().then(async () => {
  if (app.dock) app.dock.hide();
  const win = new BrowserWindow({ width: 500, height: 400, show: false });
  await win.loadFile(path.join(ROOT, 'index.html'));
  const url = await win.webContents.executeJavaScript(CODE);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', OUT);
  app.quit();
});
