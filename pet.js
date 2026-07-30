/* ================================================================
 * 픽셀 데스크탑 펫 — 컴퓨터 하는 회색 고양이
 *  - 청키 픽셀 + 굵은 검정 테두리 (어떤 배경에서도 또렷하게)
 *  - 정면으로 앉아 책상 위 키보드를 두드림, 오른쪽엔 모니터
 *  - 키보드를 치면 앞발을 교대로 콩콩, 마우스를 쓰면 오른발이 마우스로
 *  - 뽀모도로 타이머 내장
 * ================================================================ */

const SCALE = 8;
const SCENE_W = 44;
const SCENE_H = 24;

const canvas = document.getElementById('pet-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ---------------- 팔레트 ---------------- */
const PAL = {
  k: '#1e1a1e', // 검정 테두리 / 눈 / 코
  o: '#8e8e98', // 고양이 몸통 회색
  O: '#5f5f6a', // 고양이 진한 회색 (귀 속 / 정수리 / 그늘)
  c: '#bcbcc4', // 고양이 밝은 회색 (주둥이 / 발가락)
  b: '#e0a55e', // 강아지 몸통 탄
  e: '#8a5c33', // 강아지 귀 / 그늘 브라운
  f: '#f4e6c8', // 강아지 크림 (주둥이 / 가슴)
  p: '#e79aa8', // 분홍 (강아지 혀 / 토끼 귀 속 / 토끼 코)
  w: '#f0ece2', // 토끼 몸통 웜 화이트
  u: '#cfc6b8', // 토끼 그늘 베이지
  t: '#d98a3f', // 책상 오렌지
  T: '#a85f2a', // 책상 어두운 오렌지
  y: '#f7c948', // 책상 노란 포인트 / 스파클
  G: '#6b7280', // 모니터 베젤
  v: '#a8ded2', // 모니터 민트 화면
  a: '#d97757', // 화면 속 클로드 (테라코타)
  g: '#d6d9e0', // 키보드 판
  h: '#a8aeb9', // 키캡
  m: '#eef0f4', // 마우스 몸체
  C: '#f9e9cd', // 컵 크림층
  W: '#e2e2e2', // 컵 생크림
  B: '#6b4423', // 빨대 갈색
  L: '#c9a37a', // 라떼층
  D: '#96683c', // 라떼층 점무늬
  E: '#4a3020', // 컵 아래 진한 커피
  z: '#a9c1dd', // Zzz
  s: '#e8c8f0', // 파티 1
  S: '#a7e0b8', // 파티 2
};

/* ---------------- 그리기 헬퍼 ---------------- */
function px(x, y, color) {
  ctx.fillStyle = PAL[color] || color;
  ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = PAL[color] || color;
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

function sprite(grid, ox, oy) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== '.' && PAL[ch]) px(ox + x, oy + y, ch);
    }
  }
}

/* 소품용 절반 픽셀 (고양이는 큼직하게, 소품은 알아볼 수 있게 잘게) */
const HALF = SCALE / 2;

function rect4(x, y, w, h, color) {
  ctx.fillStyle = PAL[color] || color;
  ctx.fillRect(x * HALF, y * HALF, w * HALF, h * HALF);
}

function px4(x, y, color) {
  rect4(x, y, 1, 1, color);
}

function sprite4(grid, ox, oy) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== '.' && PAL[ch]) px4(ox + x, oy + y, ch);
    }
  }
}

/* ---------------- 고양이 (정면, 책상 뒤에 앉음) ----------------
 * 그리드 폭 20: 뾰족 귀 + 볼 털이 살짝 튀어나온 정면 실루엣 */
const CAT_SIL = [
  [[4, 5], [14, 15]],           // 뾰족한 귀 끝
  [[3, 6], [13, 16]],
  [[3, 7], [12, 16]],           // 귀 밑동
  [[3, 16]],                    // 정수리
  [[2, 17]],
  [[2, 17]],                    // 눈 높이
  [[0, 19]],                    // 볼 털 (가장 넓은 곳)
  [[2, 17]],
  [[3, 16]],                    // 턱
  [[3, 16]],                    // 목
  [[2, 17]],                    // 어깨
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],                    // 책상 뒤로
];

const CAT_PAINT = [
  // 귀 속 어두운 색
  [1, 4, 5, 'O'], [1, 14, 15, 'O'],
  [2, 4, 6, 'O'], [2, 13, 15, 'O'],
  // 정수리 어두운 캡
  [3, 3, 16, 'O'],
  [4, 2, 4, 'O'], [4, 15, 17, 'O'],
  // 얼굴 옆 그늘 + 볼 털
  [5, 2, 3, 'O'], [5, 16, 17, 'O'],
  [6, 0, 2, 'O'], [6, 17, 19, 'O'],
  // 밝은 주둥이
  [6, 7, 12, 'c'],
  [7, 6, 13, 'c'],
  [8, 7, 12, 'c'],
  // 어깨/옆구리 그늘
  [10, 2, 3, 'O'], [10, 16, 17, 'O'],
  [11, 2, 3, 'O'], [11, 16, 17, 'O'],
  [12, 2, 2, 'O'], [12, 17, 17, 'O'],
  [13, 2, 2, 'O'], [13, 17, 17, 'O'],
  [14, 2, 2, 'O'], [14, 17, 17, 'O'],
  [15, 2, 2, 'O'], [15, 17, 17, 'O'],
  // 가슴 털 무늬
  [12, 9, 10, 'O'],
  [14, 6, 6, 'O'], [14, 13, 13, 'O'],
];

// 실루엣 → 그리드 (검정 테두리 자동 생성)
function buildSprite(sil, paint, base) {
  const W = 22, H = sil.length + 2;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  sil.forEach((spans, i) => spans.forEach(([s, e]) => {
    for (let x = s; x <= e; x++) grid[i + 1][x + 1] = base;
  }));
  paint.forEach(([r, s, e, ch]) => {
    for (let x = s; x <= e; x++) if (grid[r + 1][x + 1] !== '.') grid[r + 1][x + 1] = ch;
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x] !== '.') continue;
    let near = false;
    for (let ny = y - 1; ny <= y + 1 && !near; ny++)
      for (let nx = x - 1; nx <= x + 1 && !near; nx++)
        if (ny >= 0 && ny < H && nx >= 0 && nx < W &&
            grid[ny][nx] !== '.' && grid[ny][nx] !== 'k') near = true;
    if (near) grid[y][x] = 'k';
  }
  return grid.map((row) => row.join(''));
}

/* ---------------- 강아지 (정면, 처진 귀) ---------------- */
const DOG_SIL = [
  [[5, 14]],                    // 둥근 정수리
  [[3, 16]],
  [[1, 18]],                    // 귀가 양옆으로 처지기 시작
  [[1, 18]],
  [[1, 18]],                    // 눈 높이
  [[1, 18]],
  [[2, 17]],                    // 귀 끝, 볼
  [[2, 17]],
  [[3, 16]],                    // 턱
  [[3, 16]],                    // 목
  [[2, 17]],                    // 어깨
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],                    // 책상 뒤로
];

const DOG_PAINT = [
  // 처진 귀 (양옆 브라운)
  [2, 1, 3, 'e'], [2, 16, 18, 'e'],
  [3, 1, 3, 'e'], [3, 16, 18, 'e'],
  [4, 1, 3, 'e'], [4, 16, 18, 'e'],
  [5, 1, 2, 'e'], [5, 17, 18, 'e'],
  [6, 2, 2, 'e'], [6, 17, 17, 'e'],
  // 이마 크림 블레이즈 → 주둥이로 이어짐
  [2, 9, 10, 'f'], [3, 9, 10, 'f'], [4, 8, 11, 'f'],
  [5, 8, 11, 'f'],
  [6, 7, 12, 'f'],
  [7, 6, 13, 'f'],
  [8, 7, 12, 'f'],
  // 크림 가슴
  [12, 8, 11, 'f'],
  [13, 7, 12, 'f'], [14, 7, 12, 'f'], [15, 7, 12, 'f'],
  // 어깨/옆구리 그늘
  [10, 2, 3, 'e'], [10, 16, 17, 'e'],
  [11, 2, 3, 'e'], [11, 16, 17, 'e'],
  [12, 2, 2, 'e'], [12, 17, 17, 'e'],
  [13, 2, 2, 'e'], [13, 17, 17, 'e'],
  [14, 2, 2, 'e'], [14, 17, 17, 'e'],
  [15, 2, 2, 'e'], [15, 17, 17, 'e'],
];

/* ---------------- 토끼 (정면, 쫑긋 긴 귀) ---------------- */
const RABBIT_SIL = [
  [[5, 6], [13, 14]],           // 귀 끝
  [[4, 6], [13, 15]],
  [[4, 6], [13, 15]],
  [[4, 6], [13, 15]],
  [[4, 15]],                    // 귀 밑동, 머리 시작
  [[3, 16]],
  [[2, 17]],                    // 눈 높이
  [[2, 17]],                    // 볼
  [[3, 16]],                    // 턱
  [[3, 16]],                    // 목
  [[2, 17]],                    // 어깨
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],
  [[2, 17]],                    // 책상 뒤로
];

const RABBIT_PAINT = [
  // 귀 속 분홍
  [1, 5, 5, 'p'], [2, 5, 5, 'p'], [3, 5, 5, 'p'],
  [1, 14, 14, 'p'], [2, 14, 14, 'p'], [3, 14, 14, 'p'],
  // 볼/옆 그늘
  [6, 2, 3, 'u'], [6, 16, 17, 'u'],
  [7, 2, 3, 'u'], [7, 16, 17, 'u'],
  // 어깨/옆구리 그늘
  [10, 2, 3, 'u'], [10, 16, 17, 'u'],
  [11, 2, 3, 'u'], [11, 16, 17, 'u'],
  [12, 2, 2, 'u'], [12, 17, 17, 'u'],
  [13, 2, 2, 'u'], [13, 17, 17, 'u'],
  [14, 2, 2, 'u'], [14, 17, 17, 'u'],
  [15, 2, 2, 'u'], [15, 17, 17, 'u'],
  // 가슴 털 무늬
  [12, 9, 10, 'u'],
  [14, 6, 6, 'u'], [14, 13, 13, 'u'],
];

/* ---------------- 펫 정의 (🐾 버튼으로 교체) ---------------- */
const PET_DEFS = {
  cat: {
    sprite: buildSprite(CAT_SIL, CAT_PAINT, 'o'),
    paw: ['.kkk.', 'koook', 'kcook', '.kkk.'],
    eyes: { lx: 6, rx: 12, y: 5 },
    face(dy) {
      // 까만 코
      px(PET_X + 9, PET_Y + dy + 7, 'k');
      px(PET_X + 10, PET_Y + dy + 7, 'k');
    },
  },
  dog: {
    sprite: buildSprite(DOG_SIL, DOG_PAINT, 'b'),
    paw: ['.kkk.', 'kbbbk', 'kfbbk', '.kkk.'],
    eyes: { lx: 6, rx: 12, y: 4 },
    face(dy) {
      // 큼직한 코 + 내민 혀
      rect(PET_X + 9, PET_Y + dy + 6, 2, 1, 'k');
      px(PET_X + 9, PET_Y + dy + 8, 'p');
      px(PET_X + 10, PET_Y + dy + 8, 'p');
    },
  },
  rabbit: {
    sprite: buildSprite(RABBIT_SIL, RABBIT_PAINT, 'w'),
    paw: ['.kkk.', 'kwwwk', 'kpwwk', '.kkk.'],
    eyes: { lx: 6, rx: 12, y: 6 },
    face(dy) {
      // 분홍 코
      px(PET_X + 9, PET_Y + dy + 8, 'p');
      px(PET_X + 10, PET_Y + dy + 8, 'p');
    },
  },
};

const PET_ORDER = ['cat', 'dog', 'rabbit'];

// 점 눈 (2x2)
const EYE_OPEN = ['kk', 'kk'];
const EYE_BLINK = ['..', 'kk'];
const EYE_HAPPY = ['k.k'];
const EYE_SLEEP = EYE_BLINK;

// 마우스 (절반 픽셀, 버튼 2개)
const MOUSE_SPRITE = [
  '.kkkkkk.',
  'kmmkkmmk',
  'kmmkkmmk',
  'kmmmmmmk',
  'kmmmmmmk',
  '.kkkkkk.',
];

// 아이스 커피 (생크림 + 빨대 + 라떼층 + 진한 바닥)
const CUP = [
  '...kBk...',
  '...kBk...',
  '.kkkBkkk.',
  '.kWWBWWk.',
  '.kWWBWWk.',
  'kCCCCCCCk',
  'kLLLLLLLk',
  'kLDLLDLLk',
  'kLLDLLDLk',
  'kLLLLLLLk',
  'kEEEEEEEk',
  'kEEEEEEEk',
  '.kkkkkkk.',
];

// 화면 속 클로드 (절반 픽셀, 화면 위라 테두리 없이 플랫하게)
const CLAWD = [
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
  '.aakaaaakaa.',
  '.aakaaaakaa.',
  'aaaaaaaaaaaa',
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
  '..a.a..a.a..',
  '..a.a..a.a..',
];

const Z_SMALL = ['zzz', '.z.', 'zzz'];
const Z_BIG = ['zzzz', '..z.', '.z..', 'zzzz'];

/* ---------------- 장면 배치 (44 x 24) ---------------- */
const PET_X = 10;   // 실루엣 col0 위치 (몸통은 x12~29)
const PET_Y = 1;
const DESK_Y = 16;
// 소품 좌표는 절반 픽셀 단위 (장면 88 x 48)
const KB = { x: 26, y: 30, w: 28, h: 6 };
const MOUSE = { x: 56, y: 31 };
const PAW_L = 15;
const PAW_R = 21;
const PAW_MOUSE = 27;
const PAW_REST = 13;
const PAW_DOWN = 14;

function renderPet(eye, dy) {
  const P = PET_DEFS[petKind];
  sprite(P.sprite, PET_X - 1, PET_Y - 1 + dy);
  sprite(eye, PET_X + P.eyes.lx, PET_Y + dy + P.eyes.y);
  sprite(eye, PET_X + P.eyes.rx, PET_Y + dy + P.eyes.y);
  P.face(dy);
}

/* ---------------- 가구/소품 ---------------- */
function drawFloorShadow() {
  rect(2, 23, 40, 1, 'rgba(30,22,17,0.18)');
}

function drawDesk() {
  rect(1, DESK_Y, 42, 1, 'k');
  rect(1, DESK_Y + 1, 42, 1, 't');
  rect(1, DESK_Y + 2, 1, 1, 'k');
  rect(2, DESK_Y + 2, 40, 1, 'y');
  rect(42, DESK_Y + 2, 1, 1, 'k');
  rect(1, DESK_Y + 3, 42, 1, 'k');
  // 다리
  rect(2, 20, 1, 3, 'k');
  rect(3, 20, 2, 3, 'T');
  rect(5, 20, 1, 3, 'k');
  rect(38, 20, 1, 3, 'k');
  rect(39, 20, 2, 3, 'T');
  rect(41, 20, 1, 3, 'k');
}

function drawCup() {
  sprite4(CUP, 4, 20);
}

function drawMonitor(now, typing) {
  rect4(66, 9, 20, 17, 'k');   // 프레임
  rect4(67, 10, 18, 15, 'G');  // 베젤
  rect4(68, 11, 16, 13, 'v');  // 민트 화면
  rect4(73, 26, 6, 3, 'k');    // 스탠드
  rect4(70, 29, 12, 3, 'k');   // 받침
  // 화면 속 클로드 — 고양이가 타이핑하면 신나서 폴짝폴짝
  const hop = typing && Math.floor(now / 240) % 2 ? -1 : 0;
  sprite4(CLAWD, 70, 13 + hop);
}

function drawKeyboard() {
  rect4(KB.x, KB.y, KB.w, KB.h, 'k');
  rect4(KB.x + 1, KB.y + 1, KB.w - 2, KB.h - 2, 'g');
  for (let ky = KB.y + 2; ky < KB.y + KB.h - 1; ky += 2) {
    for (let kx = KB.x + 2; kx < KB.x + KB.w - 2; kx += 2) {
      px4(kx, ky, 'h');
    }
  }
}

function drawMouse(wiggle) {
  sprite4(MOUSE_SPRITE, MOUSE.x + wiggle, MOUSE.y);
}

/* ---------------- 상태 ---------------- */
const state = {
  lastKey: 0,
  lastMouse: 0,
  pawFlip: false,
  blinkUntil: 0,
  nextBlink: performance.now() + 2500,
  celebrateUntil: 0,
  nagging: false,
  mode: 'idle',
};

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo'); // typing | mousing | sleeping | celebrating

let petKind = params.get('pet') || localStorage.getItem('petKind') || 'cat';
if (!PET_DEFS[petKind]) petKind = 'cat';

const startTime = performance.now();

function currentMode(now) {
  if (DEMO) return DEMO;
  if (now < state.celebrateUntil) return 'celebrating';
  if (now - state.lastKey < 400) return 'typing';
  if (now - state.lastMouse < 450) return 'mousing';
  if (now - Math.max(state.lastKey, state.lastMouse, startTime) > 60000 &&
      !state.nagging) return 'sleeping'; // 잔소리 중엔 깨어 있는다
  return 'idle';
}

/* ---------------- 잔소리 말풍선 (키보드를 10분 이상 안 치면) ---------------- */
const NAG_AFTER = 10 * 60000;
const NAG_MESSAGES = [
  '일해라 냥!',
  '키보드가 식었다냥…',
  '10분째 놀고 있다냥',
  '슬슬 집중할 시간이다냥',
];
const nagEl = document.getElementById('nag');

function updateNag(now) {
  const idle = now - Math.max(state.lastKey, startTime);
  const timerBusy = timer.running || !bubble.classList.contains('hidden');
  const show = DEMO === 'nag' ||
    (!DEMO && !timerBusy && !game.away && idle >= NAG_AFTER);
  if (show && nagEl.classList.contains('hidden')) {
    nagEl.textContent = NAG_MESSAGES[Math.floor(Math.random() * NAG_MESSAGES.length)];
  }
  nagEl.classList.toggle('hidden', !show);
  state.nagging = show;
}

/* ================================================================
 * 레벨 / 일 세션 (다마고치처럼 키우기)
 *  - 일 시작 후 타이핑하면 +1/초, 잠들면 -1/초, 잔소리 뜨면 -2/초
 *  - 자리 비움 중엔 증감 없음, 일 끝 완주 보너스 / 뽀모도로 보너스
 * ================================================================ */
const XP_PER_LEVEL = (lv) => lv * 1000;
const WORK_BONUS = 50;
const WORK_BONUS_MIN_MS = 10 * 60000; // 10분 이상 일해야 완주 보너스 (시작/끝 반복 어뷰징 방지)
const POMODORO_BONUS = 100;

const game = {
  level: Math.max(1, +localStorage.getItem('petLevel') || 1),
  xp: Math.max(0, +localStorage.getItem('petXp') || 0),
  working: false,
  away: false,
  sessionXp: 0,
  sessionStart: 0,
};

const hudLevel = document.getElementById('hud-level');
const hudXp = document.getElementById('hud-xp');
const xpFill = document.getElementById('xpfill');
const toastEl = document.getElementById('toast');
let toastTimer = null;

function saveGame() {
  try {
    localStorage.setItem('petLevel', game.level);
    localStorage.setItem('petXp', game.xp);
  } catch (_) { /* 무시 */ }
}

function updateHud() {
  const need = XP_PER_LEVEL(game.level);
  hudLevel.textContent = `Lv.${game.level}`;
  if (game.working) {
    const net = game.sessionXp >= 0 ? `+${game.sessionXp}` : `${game.sessionXp}`;
    hudXp.textContent = game.away ? '☕ 자리 비움' : `💼 일하는 중 ${net}`;
  } else {
    hudXp.textContent = `${game.xp}/${need}`;
  }
  xpFill.style.width = `${Math.min(100, (game.xp / need) * 100)}%`;
}

function addXp(n) {
  game.xp = Math.max(0, game.xp + n);
  let leveled = false;
  while (game.xp >= XP_PER_LEVEL(game.level)) {
    game.xp -= XP_PER_LEVEL(game.level);
    game.level += 1;
    leveled = true;
  }
  if (leveled) {
    state.celebrateUntil = performance.now() + CELEBRATE_MS;
    if (window.pet) window.pet.notify('🎉 레벨 업!', `펫이 Lv.${game.level}이 되었어요!`);
    pushScore();
  }
  saveGame();
  updateHud();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 4000);
}

// 1초마다 세션 점수 정산
setInterval(() => {
  if (!game.working || game.away) return;
  const now = performance.now();
  let delta = 0;
  if (state.nagging) delta = -2;
  else if (state.mode === 'sleeping') delta = -1;
  else if (now - state.lastKey < 10000) delta = 1; // 최근 10초 안에 타이핑
  if (delta) {
    game.sessionXp += delta;
    addXp(delta);
  } else {
    updateHud();
  }
}, 1000);

/* ================================================================
 * 리더보드 (Supabase) — 친구들과 레벨 랭킹 경쟁
 * publishable(anon) 키는 공개용이고, 테이블 권한은 RLS로 제어
 * ================================================================ */
const SB_URL = 'https://qefrpkflpdpzxyrwyxvd.supabase.co';
const SB_KEY = 'sb_publishable_epIs7YckEJ8ETJkrrUHKfw_lhH6FEMA';
const SB_TABLE = 'leaderboard';
const PET_EMOJI = { cat: '🐱', dog: '🐶', rabbit: '🐰' };

// 기기별 고유 ID (내 점수 행을 구분하는 키)
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  try { localStorage.setItem('deviceId', deviceId); } catch (_) { /* 무시 */ }
}
let nickname = localStorage.getItem('nickname') || '';

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function pushScore() {
  if (!nickname) return;
  try {
    await sbFetch(`${SB_TABLE}?on_conflict=device_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        device_id: deviceId,
        nickname,
        level: game.level,
        xp: game.xp,
        pet: petKind,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('점수 업로드 실패:', err.message);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const rankList = document.getElementById('rank-list');

async function loadRanking() {
  rankList.innerHTML = '<li>불러오는 중…</li>';
  try {
    const rows = await sbFetch(
      `${SB_TABLE}?select=nickname,level,xp,pet&order=level.desc,xp.desc&limit=10`
    );
    if (!rows || !rows.length) {
      rankList.innerHTML = '<li>아직 아무도 없어요 — 닉네임을 저장해 보세요!</li>';
      return;
    }
    rankList.innerHTML = rows.map((r, i) => {
      const me = r.nickname === nickname ? ' ⭐' : '';
      return `<li>${i + 1}위 ${PET_EMOJI[r.pet] || '🐾'} ${escapeHtml(r.nickname)}` +
        ` — Lv.${r.level} (${r.xp})${me}</li>`;
    }).join('');
  } catch (err) {
    rankList.innerHTML = '<li>불러오기 실패 — 네트워크나 테이블을 확인해 주세요</li>';
  }
}

// 일하는 중엔 5분마다 점수 자동 업로드
setInterval(() => {
  if (game.working) pushScore();
}, 300000);

const CELEBRATE_MS = 4000;

/* ---------------- 렌더 루프 ----------------
 * 애니메이션 최소 단위가 90ms(축하 바운스)라 60fps는 낭비 —
 * 80ms(~12.5fps)로 제한해 CPU/GPU 사용량을 줄인다 */
const FRAME_MS = 80;
let lastFrame = 0;

function render(now) {
  requestAnimationFrame(render);
  if (now - lastFrame < FRAME_MS) return;
  lastFrame = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateNag(now);
  const mode = currentMode(now);
  state.mode = mode;

  let breathe = Math.sin(now / 1900) > 0 ? 1 : 0;
  let bounce = 0;
  if (mode === 'celebrating') {
    bounce = Math.sin(now / 90) > 0 ? -1 : 0;
    breathe = 0;
  }
  const dy = breathe + bounce;

  drawFloorShadow();

  let eye = EYE_OPEN;
  if (mode === 'sleeping') eye = EYE_SLEEP;
  else if (mode === 'celebrating') eye = EYE_HAPPY;
  else {
    if (now > state.nextBlink) {
      state.blinkUntil = now + 140;
      state.nextBlink = now + 2200 + Math.random() * 2600;
    }
    if (now < state.blinkUntil) eye = EYE_BLINK;
  }

  renderPet(eye, dy);

  const typing = mode === 'typing';
  // 키보드가 더 최근 입력이면 타이핑이 양발을 차지한다 —
  // 커서가 살짝만 떨려도 오른발이 마우스에 붙잡혀 있던 문제 방지
  const mousing = mode === 'mousing' ||
    (mode !== 'sleeping' && mode !== 'celebrating' &&
     now - state.lastMouse < 450 && state.lastMouse > state.lastKey);
  const wiggle = mousing ? (Math.sin(now / 120) > 0 ? 1 : 0) : 0;

  drawDesk();
  drawCup();
  drawMonitor(now, typing);
  drawKeyboard();
  drawMouse(wiggle);

  const paw = PET_DEFS[petKind].paw;
  if (mode === 'celebrating') {
    sprite(paw, PAW_L, PAW_REST - 2);
    sprite(paw, PAW_R, PAW_REST - 2);
  } else {
    // 타이핑 중엔 숨쉬기(dy)를 빼서 내려간 발과 쉬는 발이 항상 구분되게
    const restY = typing ? PAW_REST : PAW_REST + dy;
    const leftY = typing && state.pawFlip ? PAW_DOWN : restY;
    sprite(paw, PAW_L, leftY);
    if (mousing) {
      sprite(paw, PAW_MOUSE + wiggle / 2, PAW_DOWN); // 오른발이 마우스와 함께 움직임
    } else {
      const rightY = typing && !state.pawFlip ? PAW_DOWN : restY;
      sprite(paw, PAW_R, rightY);
    }
  }

  if (typing) {
    const ph = Math.floor(now / 160) % 3;
    if (ph !== 0) px(6, 9, 'y');
    if (ph !== 1) px(31, 8, 'y');
    if (ph !== 2) px(7, 5, 'y');
  }

  if (mode === 'sleeping') {
    const phase = Math.floor(now / 700) % 2;
    sprite(Z_SMALL, 31, 1 - phase);
    if (phase) sprite(Z_BIG, 35, 0);
  }

  if (mode === 'celebrating') {
    for (let i = 0; i < 8; i++) {
      const t = (now / 80 + i * 19) % 13;
      const cx2 = (i * 7 + Math.floor(now / 250) * 3) % SCENE_W;
      px(cx2, Math.floor(t), i % 2 ? 's' : 'S');
    }
  }
}
requestAnimationFrame(render);

/* ---------------- 입력 이벤트 ---------------- */
if (window.pet) {
  window.pet.onActivity((type) => {
    const now = performance.now();
    if (type === 'key') {
      state.lastKey = now;
      state.pawFlip = !state.pawFlip;
    } else {
      state.lastMouse = now;
    }
  });

  window.pet.status().then(({ accessibilityOK }) => {
    if (!accessibilityOK) document.getElementById('hint').classList.remove('hidden');
  });
}

/* ================================================================
 * 뽀모도로 타이머
 * ================================================================ */
const bubble = document.getElementById('bubble');
const bubbleLabel = document.getElementById('bubble-label');
const bubbleTime = document.getElementById('bubble-time');
const panel = document.getElementById('panel');
const btnPause = document.getElementById('btn-pause');

const timer = {
  left: 0,
  endAt: 0,
  running: false,
  label: '',
  tick: null,
};

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function updateBubble() {
  bubbleTime.textContent = fmt(timer.running ? timer.endAt - Date.now() : timer.left);
  bubbleLabel.textContent = timer.label;
  bubble.classList.toggle('break', timer.label === '휴식');
}

function startTimer(minutes, label) {
  clearInterval(timer.tick);
  timer.label = label;
  timer.left = minutes * 60000;
  timer.endAt = Date.now() + timer.left;
  timer.running = true;
  btnPause.textContent = '일시정지';
  bubble.classList.remove('hidden');
  panel.classList.add('hidden');
  timer.tick = setInterval(() => {
    if (!timer.running) return;
    const remain = timer.endAt - Date.now();
    if (remain <= 0) finishTimer();
    else updateBubble();
  }, 250);
  updateBubble();
}

function finishTimer() {
  clearInterval(timer.tick);
  timer.running = false;
  timer.left = 0;
  updateBubble();
  bubbleTime.textContent = '00:00';
  state.celebrateUntil = performance.now() + CELEBRATE_MS;

  const wasWork = timer.label !== '휴식';
  if (wasWork) addXp(POMODORO_BONUS); // 뽀모도로 완주 보너스
  if (window.pet) {
    window.pet.notify(
      wasWork ? '🍅 집중 시간 완료!' : '☕ 휴식 끝!',
      wasWork ? '수고했어요! 잠깐 쉬어 볼까요?' : '다시 집중할 시간이에요!'
    );
  }
  setTimeout(() => bubble.classList.add('hidden'), CELEBRATE_MS);
}

/* ---- UI 배선 ---- */
const rankPanel = document.getElementById('rank-panel');
const nicknameInput = document.getElementById('nickname');
nicknameInput.value = nickname;

document.getElementById('btn-timer').addEventListener('click', () => {
  rankPanel.classList.add('hidden');
  panel.classList.toggle('hidden');
});

document.getElementById('btn-rank').addEventListener('click', () => {
  panel.classList.add('hidden');
  rankPanel.classList.toggle('hidden');
  if (!rankPanel.classList.contains('hidden')) loadRanking();
});

document.getElementById('btn-nick').addEventListener('click', () => {
  const v = nicknameInput.value.trim().slice(0, 12);
  if (!v) return;
  nickname = v;
  try { localStorage.setItem('nickname', v); } catch (_) { /* 무시 */ }
  pushScore().then(loadRanking);
});

document.getElementById('btn-rank-refresh').addEventListener('click', loadRanking);

const btnWork = document.getElementById('btn-work');
const btnAway = document.getElementById('btn-away');

btnWork.addEventListener('click', () => {
  if (!game.working) {
    game.working = true;
    game.away = false;
    game.sessionXp = 0;
    game.sessionStart = Date.now();
    btnWork.innerHTML = '&#9209;';
    btnWork.title = '일 끝';
    btnAway.classList.remove('hidden');
    btnAway.classList.remove('on');
    showToast('일 시작! 열심히 하면 펫이 자라요 💪');
  } else {
    const sessionMs = Date.now() - game.sessionStart;
    const mins = Math.max(1, Math.round(sessionMs / 60000));
    const net = game.sessionXp >= 0 ? `+${game.sessionXp}` : `${game.sessionXp}`;
    game.working = false;
    game.away = false;
    btnWork.innerHTML = '&#128188;';
    btnWork.title = '일 시작';
    btnAway.classList.add('hidden');
    btnAway.classList.remove('on');
    // 보너스는 10분 이상 + 순증가 세션만 — 시작/끝 반복으로는 못 얻는다
    const bonusOk = sessionMs >= WORK_BONUS_MIN_MS && game.sessionXp > 0;
    if (bonusOk) {
      addXp(WORK_BONUS);
      state.celebrateUntil = performance.now() + CELEBRATE_MS;
      showToast(`일 끝! ${mins}분 · 세션 ${net}점 + 완주 보너스 ${WORK_BONUS}점`);
    } else {
      showToast(`일 끝! ${mins}분 · 세션 ${net}점 (보너스는 10분 이상 일해야 나와요)`);
    }
    pushScore();
  }
  updateHud();
});

btnAway.addEventListener('click', () => {
  if (!game.working) return;
  game.away = !game.away;
  btnAway.classList.toggle('on', game.away);
  updateHud();
});

document.getElementById('btn-pet').addEventListener('click', () => {
  petKind = PET_ORDER[(PET_ORDER.indexOf(petKind) + 1) % PET_ORDER.length];
  try { localStorage.setItem('petKind', petKind); } catch (_) { /* 무시 */ }
});

document.getElementById('btn-quit').addEventListener('click', () => {
  if (window.pet) window.pet.quit();
  else window.close();
});

document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => startTimer(+btn.dataset.min, btn.dataset.label));
});

document.getElementById('btn-custom').addEventListener('click', () => {
  const v = +document.getElementById('custom-min').value;
  if (v >= 1 && v <= 180) startTimer(v, '집중');
});

btnPause.addEventListener('click', () => {
  if (!timer.endAt) return;
  if (timer.running) {
    timer.running = false;
    timer.left = timer.endAt - Date.now();
    btnPause.textContent = '재개';
  } else if (timer.left > 0) {
    timer.endAt = Date.now() + timer.left;
    timer.running = true;
    btnPause.textContent = '일시정지';
  }
  updateBubble();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  clearInterval(timer.tick);
  timer.running = false;
  timer.left = 0;
  timer.endAt = 0;
  bubble.classList.add('hidden');
  btnPause.textContent = '일시정지';
});

updateHud();

// ?timer=25 로 실행하면 바로 타이머 시작 (테스트/스크린샷용)
const DEMO_TIMER = params.get('timer');
if (DEMO_TIMER) startTimer(+DEMO_TIMER, '집중');
