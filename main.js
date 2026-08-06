const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, Notification, systemPreferences, shell, dialog, nativeTheme } = require('electron');
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
  if (process.env.PET) q.push(`pet=${process.env.PET}`);
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
  // macOS는 템플릿 이미지(알파만 사용)라 메뉴바 밝기에 맞춰 자동 반전되지만,
  // 윈도우/리눅스는 그대로 그려지므로 다크 테마 트레이에선 흰색으로 채운다
  const isMac = process.platform === 'darwin';
  const white = !isMac && nativeTheme.shouldUseDarkColors;
  const buf = Buffer.alloc(size * size * 4); // BGRA
  TRAY_ART.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      for (let dy = 0; dy < Z; dy++) {
        for (let dx = 0; dx < Z; dx++) {
          const i = (((y * Z + dy) * size) + x * Z + dx) * 4;
          if (white) buf[i] = buf[i + 1] = buf[i + 2] = 255;
          buf[i + 3] = 255;
        }
      }
    }
  });
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: Z });
  img.setTemplateImage(isMac);
  return img;
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Desktop Pet v${app.getVersion()}`, enabled: false },
    ...(pendingUpdate ? [{
      label: updateBusy ? '업데이트 다운로드 중…' : `v${pendingUpdate.version} 업데이트 받기`,
      enabled: !updateBusy,
      click: startUpdate,
    }] : []),
    { type: 'separator' },
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
    { label: '게임 규칙', click: showManual },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]));
}

/* 규칙 숫자는 pet.js의 상수와 맞춰 둔다 (NAG_AFTER, WORK_BONUS, XP_PER_LEVEL …) */
function showManual() {
  dialog.showMessageBox(win, {
    type: 'none',
    title: '게임 규칙',
    message: '펫 키우기 규칙',
    buttons: ['닫기'],
    detail: [
      '💼 일하는 중 (💼 버튼으로 시작/끝)',
      '  · 타이핑하면 +1점/초',
      '  · 1분 넘게 방치해 펫이 잠들면 -1점/초',
      '  · 키보드를 10분 이상 안 쳐서 잔소리가 뜨면 -2점/초',
      '  · ☕ 자리 비움을 켜면 증감과 잔소리가 멈춰요',
      '',
      '🏅 보너스',
      '  · 일 끝: 10분 이상 + 점수가 늘어난 세션이면 +50',
      '  · 뽀모도로 집중 완주: +100',
      '',
      '📈 레벨',
      '  · 레벨 업에 레벨×2000점 필요',
      '  · 점수가 바닥나면 레벨 강등 TㅁT (세션당 한 번, Lv.1이 바닥)',
      '',
      '🌱 잔디',
      '  · 10분 이상 뽀모도로 집중을 완주하면 그날 잔디에 분이 쌓여요',
      '  · 여러 PC에서 키우면 같은 날짜로 합산됩니다',
    ].join('\n'),
  });
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
      // 패키징된 앱은 콘솔이 없다 — 원인을 파일로 남겨야 배포 후에도 추적할 수 있다
      try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'hook-error.log'), String(err.stack || err));
      } catch (_) { /* 무시 */ }
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

/* ================================================================
 * 자동 업데이트 — GitHub 릴리즈 피드(latest*.yml)로 새 버전을 확인
 *  - Windows(NSIS): electron-updater가 받아서 재시작할 때 설치
 *  - macOS: ad-hoc 서명이라 Squirrel 설치가 안 된다 → 같은 피드에서
 *    zip을 받아 sha512 검증 후 .app을 직접 바꿔치기하고 재시작.
 *    zip 해제는 반드시 ditto로 — 노드 zip 라이브러리는 심볼릭 링크와
 *    실행 권한을 깨뜨려 "손상된 앱"을 만든다
 * ================================================================ */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const RELEASES_URL = 'https://github.com/wooyerine/desktop-pet/releases/latest';
const UPDATE_CHECK_MS = 6 * 3600 * 1000;
let promptedVersion = ''; // 세션 안에서 같은 버전으로 다시 묻지 않는다
let pendingUpdate = null; // 받을 수 있는 새 버전 정보 — 트레이 메뉴에 노출
let updateBusy = false;   // 다운로드/교체 진행 중

function logUpdateError(err) {
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'update-error.log'), String((err && err.stack) || err));
  } catch (_) { /* 무시 */ }
}

/* 다운로드 진행률을 펫 말풍선에 보여 준다 —
 * 대화상자가 닫힌 뒤 완료 창까지 아무 표시가 없으면 멈춘 줄 안다 */
function sendUpdateProgress(p) {
  if (win && !win.isDestroyed()) win.webContents.send('update-progress', p);
}

/* 대화상자에서 "업데이트"를 누르거나 트레이 메뉴에서 골랐을 때 */
function startUpdate() {
  if (!pendingUpdate || updateBusy) return;
  updateBusy = true;
  refreshTrayMenu();
  const info = pendingUpdate;
  if (process.platform === 'darwin') {
    macSwapUpdate(info).then(() => {
      pendingUpdate = null; // 교체 완료 — 재시작만 남았다
      updateBusy = false;
      refreshTrayMenu();
    }).catch((err) => {
      logUpdateError(err);
      sendUpdateProgress({ done: true });
      updateBusy = false;
      refreshTrayMenu();
      manualUpdateFallback(info.version);
    });
  } else {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.downloadUpdate().catch((err) => {
      logUpdateError(err);
      sendUpdateProgress({ done: true });
      updateBusy = false;
      refreshTrayMenu();
    });
  }
}

function setupAutoUpdate() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.on('error', logUpdateError);

  autoUpdater.on('update-available', async (info) => {
    pendingUpdate = info;
    refreshTrayMenu(); // 메뉴에 "업데이트 받기"가 생긴다
    if (info.version === promptedVersion) return;
    promptedVersion = info.version;
    // 펫 창에 붙는 시트로 — 독립 창은 다른 앱에서 타이핑하다 Enter로
    // 자기도 모르게 눌러 버릴 수 있다
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      message: `새 버전 v${info.version}이 나왔어요!`,
      detail: `지금 버전은 v${app.getVersion()}. 업데이트할까요?\n나중에 하려면 메뉴바 아이콘에서 "업데이트 받기"를 누르면 돼요.`,
      buttons: ['업데이트', '나중에'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) startUpdate();
  });

  autoUpdater.on('download-progress', (p) => {
    sendUpdateProgress({ percent: Math.round(p.percent) });
  });

  // Windows: 다 받아지면 재시작 여부만 묻는다 (나중에를 골라도 종료할 때 설치됨)
  autoUpdater.on('update-downloaded', async () => {
    sendUpdateProgress({ done: true });
    pendingUpdate = null;
    updateBusy = false;
    refreshTrayMenu();
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      message: '업데이트 준비 완료',
      detail: '지금 재시작해서 설치할까요? 나중에 해도 앱을 끌 때 설치돼요.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch(logUpdateError);
  setTimeout(check, 15000); // 시작 직후는 창 띄우는 게 먼저
  setInterval(check, UPDATE_CHECK_MS);
}

/* 자동 교체가 불가능한 상황(권한/설치 위치)이면 수동 다운로드로 안내 */
async function manualUpdateFallback(version) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    message: '자동 업데이트를 할 수 없어요',
    detail: `다운로드 페이지에서 v${version}을 받아 Applications에 넣어 주세요.`,
    buttons: ['다운로드 페이지 열기', '닫기'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) shell.openExternal(RELEASES_URL);
}

/* macOS: zip을 받아 검증하고 실행 중인 .app을 원자적으로 바꿔치기 */
async function macSwapUpdate(info) {
  // 1) 실행 중인 번들 경로 — Contents/MacOS/실행파일에서 세 단계 위
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  const parent = path.dirname(bundle);
  if (!bundle.endsWith('.app')) throw new Error(`not an app bundle: ${bundle}`);
  if (bundle.includes('AppTranslocation') || parent.startsWith('/Volumes/')) {
    throw new Error(`bundle not swappable: ${bundle}`); // DMG에서 바로 실행 중이거나 격리 상태
  }
  fs.accessSync(parent, fs.constants.W_OK); // 쓰기 불가면 throw → 수동 안내

  // 2) 피드에서 zip 자산 찾기 — files[].url은 파일명이라 다운로드 주소를 조립한다
  const file = (info.files || []).find((f) => f.url && f.url.endsWith('.zip'));
  if (!file) throw new Error('update feed has no zip');
  const zipUrl = `https://github.com/wooyerine/desktop-pet/releases/download/v${info.version}/${file.url}`;

  // 3) 내려받으며 sha512 해시 계산
  const tmpZip = path.join(app.getPath('temp'), `desktop-pet-${info.version}.zip`);
  const stage = fs.mkdtempSync(path.join(app.getPath('temp'), 'desktop-pet-update-'));
  try {
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const hash = crypto.createHash('sha512');
    const total = file.size || 0;
    let got = 0;
    let lastSent = 0;
    await pipeline(
      Readable.fromWeb(res.body),
      async function* (src) {
        for await (const chunk of src) {
          hash.update(chunk);
          got += chunk.length;
          if (total && Date.now() - lastSent > 300) {
            lastSent = Date.now();
            sendUpdateProgress({ percent: Math.min(99, Math.round((got / total) * 100)) });
          }
          yield chunk;
        }
      },
      fs.createWriteStream(tmpZip)
    );
    if (hash.digest('base64') !== file.sha512) throw new Error('sha512 mismatch');
    sendUpdateProgress({ percent: 100 });

    // 4) ditto로 해제하고 새 번들 모양 최소 검증
    execFileSync('/usr/bin/ditto', ['-x', '-k', tmpZip, stage]);
    const appName = fs.readdirSync(stage).find((n) => n.endsWith('.app'));
    if (!appName) throw new Error('no .app in zip');
    const newApp = path.join(stage, appName);
    fs.accessSync(path.join(newApp, 'Contents', 'MacOS'), fs.constants.R_OK);

    // 5) 교체 — 기존을 옆으로 밀고 새것을 제자리에, 실패하면 되돌린다
    const backup = path.join(parent, `.${path.basename(bundle)}.old-${Date.now()}`);
    fs.renameSync(bundle, backup);
    try {
      try {
        fs.renameSync(newApp, bundle);
      } catch (err) {
        if (err.code !== 'EXDEV') throw err;
        execFileSync('/usr/bin/ditto', [newApp, bundle]); // 임시 폴더가 다른 볼륨이면 복사
      }
    } catch (err) {
      fs.renameSync(backup, bundle); // 롤백
      throw err;
    }
    fs.rm(backup, { recursive: true, force: true }, () => {});
  } finally {
    fs.rm(tmpZip, { force: true }, () => {});
    fs.rm(stage, { recursive: true, force: true }, () => {});
  }

  // 6) 재시작 — 실행 중인 프로세스는 옛 버전이므로 바로 새로 뜨는 게 안전
  sendUpdateProgress({ done: true });
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    message: `v${info.version} 설치 완료!`,
    detail: '지금 재시작할까요? 나중에 하면 다음 실행부터 새 버전이에요.\n' +
      '(업데이트 후 키보드 감지가 멈추면 손쉬운 사용 권한을 다시 등록해 주세요)',
    buttons: ['지금 재시작', '나중에'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    app.relaunch();
    app.quit(); // quit이어야 will-quit에서 입력 훅을 정리한다
  }
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  loadSettings();
  createWindow();
  if (!process.env.SHOT) {
    createTray();
    startInputHooks(); // 스크린샷 모드에선 전역 훅 불필요
    if (app.isPackaged) setupAutoUpdate(); // 개발 실행에선 업데이트 확인 안 함
  }
});

/* 종료 — uiohook.stop()은 부르면 안 된다: macOS 26에서 훅 스레드
 * join을 기다리며 메인 스레드가 영영 멈춘다 (종료가 안 끝나 좀비
 * 프로세스가 남고, 업데이트 재시작도 옛 프로세스를 기다리다 멎는다).
 * 정리 단계 크래시를 피하면서 확실히 끝나도록 바로 프로세스를 내린다 */
app.on('will-quit', () => {
  process.exit(0);
});

ipcMain.handle('status', () => ({ accessibilityOK, platform: process.platform }));

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
