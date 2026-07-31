const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, Notification, systemPreferences, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;
let hook = null;
let accessibilityOK = process.platform !== 'darwin';

/* ---- 보기 설정 (펫 크기 / 항상 맨 위) ----
 * 렌더러 localStorage가 아니라 파일에 두는 이유: 창을 만들 때 이미 알아야
 * 큰 크기로 떴다가 줄어드는 깜빡임이 없다.
 *
 * 크기는 페이지 줌이 아니라 "펫 픽셀 한 칸의 크기"다 —
 * 줌으로 줄이면 글씨까지 작아져 읽기 힘들었다. 픽셀 칸만 줄이면
 * 도트가 뭉개지지 않고, 버튼/글씨는 원래 크기 그대로 남는다. */
const SCENE_W = 44, SCENE_H = 24;   // pet.js의 씬 크기 (픽셀 칸 단위)
const PET_SIZES = [
  { label: '작게', px: 4 },
  { label: '보통', px: 6 },
  { label: '크게', px: 8 },
];
const MIN_WIN_W = 294;              // 버튼 바(자리 비움까지 7개)가 잘리지 않는 최소 폭
const settings = { petPx: 8, onTop: true };
const settingsPath = () => path.join(app.getPath('userData'), 'view.json');

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (PET_SIZES.some((s) => s.px === raw.petPx)) settings.petPx = raw.petPx;
    if (typeof raw.onTop === 'boolean') settings.onTop = raw.onTop;
  } catch (_) { /* 없거나 깨졌으면 기본값 */ }
}

function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings)); } catch (_) { /* 무시 */ }
}

function send(type) {
  if (win && !win.isDestroyed()) win.webContents.send('activity', type);
}

function winWidth(petPx) {
  return Math.max(MIN_WIN_W, SCENE_W * petPx + 20);
}

/* 펫 크기를 바꾸고 창 폭을 맞춘다. 높이는 렌더러가 재서 'fit'으로 알려준다 */
function applyPetSize(petPx) {
  settings.petPx = petPx;
  win.webContents.send('pet-size', petPx);
  setWindowSize(winWidth(petPx), win.getBounds().height);
  saveSettings();
  refreshTrayMenu();
}

function applyOnTop(onTop) {
  settings.onTop = !!onTop;
  win.setAlwaysOnTop(settings.onTop, 'floating');
  // 항상 맨 위를 끄면 전체화면 앱 위로도 뜨지 않게 한다
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: settings.onTop });
  saveSettings();
  refreshTrayMenu();
}

/* 펫이 화면에서 제자리에 있도록 위쪽 가운데를 고정한 채 크기만 바꾼다 */
function setWindowSize(w, h) {
  const b = win.getBounds();
  if (b.width === w && b.height === h) return;
  const area = screen.getDisplayMatching(b).workArea;
  win.setBounds({
    x: clamp(Math.round(b.x + (b.width - w) / 2), area.x, area.x + area.width - w),
    y: clamp(b.y, area.y, area.y + area.height - h),
    width: w,
    height: h,
  });
}

function clamp(v, lo, hi) {
  if (hi < lo) return lo; // 창이 작업 영역보다 클 땐 일단 왼쪽/위에 붙인다
  return Math.min(Math.max(v, lo), hi);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = winWidth(settings.petPx);
  // 패널을 닫은 상태의 높이 (펫 + 버튼 바 + HUD + 여백).
  // 어긋나도 로드 직후 렌더러가 실측해서 'fit'으로 고쳐 준다
  const H = SCENE_H * settings.petPx + 80;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: clamp(workArea.x + workArea.width - W - 24, workArea.x, workArea.x + workArea.width - W),
    y: clamp(workArea.y + workArea.height - H - 24, workArea.y, workArea.y + workArea.height - H),
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: settings.onTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  applyOnTop(settings.onTop);

  const q = [`pet_px=${settings.petPx}`]; // 첫 프레임부터 제 크기로 그리도록
  if (process.env.DEMO) q.push(`demo=${process.env.DEMO}`);
  if (process.env.TIMER) q.push(`timer=${process.env.TIMER}`);
  if (process.env.PANEL) q.push(`panel=${process.env.PANEL}`);
  win.loadFile('index.html', { search: `?${q.join('&')}` });

  if (process.env.SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(process.env.SHOT, img.toPNG());
        app.quit();
      }, 1200);
    });
  }
}

/* ---- 메뉴바(트레이) ----
 * 독을 숨긴 앱이라 창 밖에서 손댈 곳이 메뉴바뿐이다.
 * 아이콘은 파일 없이 픽셀 격자에서 바로 만든다 (템플릿 이미지 = 알파만 사용,
 * 밝은/어두운 메뉴바에 맞춰 macOS가 알아서 반전해 준다) */
const TRAY_ART = [
  '................',
  '..##........##..',
  '..###......###..',
  '..####....####..',
  '..############..',
  '.##############.',
  '.###..####..###.',
  '.##############.',
  '.##############.',
  '.######..######.',
  '.##############.',
  '..############..',
  '...##########...',
  '.....######.....',
  '................',
  '................',
];

function trayImage() {
  const Z = 2; // 레티나 대비 2배로 그리고 scaleFactor로 되돌린다
  const size = TRAY_ART.length * Z;
  const buf = Buffer.alloc(size * size * 4); // BGRA
  TRAY_ART.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      for (let dy = 0; dy < Z; dy++) {
        for (let dx = 0; dx < Z; dx++) {
          buf[(((y * Z + dy) * size) + x * Z + dx) * 4 + 3] = 255; // 불투명 검정
        }
      }
    }
  });
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: Z });
  img.setTemplateImage(true);
  return img;
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '펫 크기',
      submenu: PET_SIZES.map((s) => ({
        label: s.label,
        type: 'radio',
        checked: settings.petPx === s.px,
        click: () => applyPetSize(s.px),
      })),
    },
    {
      label: '항상 맨 위',
      type: 'checkbox',
      checked: settings.onTop,
      click: (item) => applyOnTop(item.checked),
    },
    { type: 'separator' },
    { label: '제자리로 (오른쪽 아래)', click: moveToCorner },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]));
}

function moveToCorner() {
  const { width, height } = win.getBounds();
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  win.setBounds({
    x: clamp(area.x + area.width - width - 24, area.x, area.x + area.width - width),
    y: clamp(area.y + area.height - height - 24, area.y, area.y + area.height - height),
    width,
    height,
  });
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Desktop Pet');
  refreshTrayMenu();
}

function startInputHooks() {
  if (process.platform === 'darwin') {
    // 최초 실행 시 손쉬운 사용(Accessibility) 권한 프롬프트를 띄운다
    accessibilityOK = systemPreferences.isTrustedAccessibilityClient(!process.env.SHOT);
  }

  if (accessibilityOK) {
    try {
      const { uIOhook } = require('uiohook-napi');
      let lastMouse = 0;
      uIOhook.on('keydown', () => send('key'));
      uIOhook.on('mousedown', () => send('mouse'));
      uIOhook.on('wheel', () => send('mouse'));
      uIOhook.on('mousemove', () => {
        const now = Date.now();
        if (now - lastMouse > 80) { lastMouse = now; send('mouse'); }
      });
      uIOhook.start();
      hook = uIOhook;
    } catch (err) {
      console.error('uiohook failed, falling back to cursor polling:', err.message);
      accessibilityOK = false;
    }
  }

  // 권한 없이도 동작하는 마우스 폴백: 커서 좌표 폴링 (uiohook이 없을 때만)
  if (!hook) {
    let last = screen.getCursorScreenPoint();
    setInterval(() => {
      const p = screen.getCursorScreenPoint();
      if (p.x !== last.x || p.y !== last.y) {
        last = p;
        send('mouse');
      }
    }, 150);
  }
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  loadSettings();
  createWindow();
  if (!process.env.SHOT) {
    createTray();
    startInputHooks(); // 스크린샷 모드에선 전역 훅 불필요
  }
});

// 종료 전에 훅을 멈추지 않으면 정리 단계에서 크래시가 난다
app.on('will-quit', () => {
  try { if (hook) hook.stop(); } catch (_) { /* 무시 */ }
});

ipcMain.handle('status', () => ({ accessibilityOK }));

// 렌더러가 잰 실제 내용 높이에 창을 맞춘다 —
// 남는 투명 영역이 없어야 그 자리의 다른 앱을 클릭할 수 있다
ipcMain.on('fit', (_e, height) => {
  if (!win || win.isDestroyed()) return;
  if (!Number.isFinite(height)) return;
  setWindowSize(winWidth(settings.petPx), clamp(Math.ceil(height), 80, 1400));
});

ipcMain.on('notify', (_e, { title, body }) => {
  new Notification({ title, body }).show();
  shell.beep();
});

ipcMain.on('quit', () => app.quit());

app.on('window-all-closed', () => app.quit());
