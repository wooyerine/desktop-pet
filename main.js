const { app, BrowserWindow, ipcMain, screen, Notification, systemPreferences, shell } = require('electron');
const path = require('path');

let win = null;
let hook = null;
let accessibilityOK = process.platform !== 'darwin';

function send(type) {
  if (win && !win.isDestroyed()) win.webContents.send('activity', type);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 372, H = 400;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - 24,
    y: workArea.y + workArea.height - H - 24,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const q = [];
  if (process.env.DEMO) q.push(`demo=${process.env.DEMO}`);
  if (process.env.TIMER) q.push(`timer=${process.env.TIMER}`);
  win.loadFile('index.html', { search: q.length ? `?${q.join('&')}` : '' });

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
  createWindow();
  if (!process.env.SHOT) startInputHooks(); // 스크린샷 모드에선 전역 훅 불필요
});

// 종료 전에 훅을 멈추지 않으면 정리 단계에서 크래시가 난다
app.on('will-quit', () => {
  try { if (hook) hook.stop(); } catch (_) { /* 무시 */ }
});

ipcMain.handle('status', () => ({ accessibilityOK }));

ipcMain.on('notify', (_e, { title, body }) => {
  new Notification({ title, body }).show();
  shell.beep();
});

ipcMain.on('quit', () => app.quit());

app.on('window-all-closed', () => app.quit());
