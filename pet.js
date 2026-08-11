/* ================================================================
 * 픽셀 데스크탑 펫 — 컴퓨터 하는 회색 고양이
 *  - 청키 픽셀 + 굵은 검정 테두리 (어떤 배경에서도 또렷하게)
 *  - 정면으로 앉아 책상 위 키보드를 두드림, 오른쪽엔 모니터
 *  - 키보드를 치면 앞발을 교대로 콩콩, 마우스를 쓰면 오른발이 마우스로
 *  - 뽀모도로 타이머 내장
 * ================================================================ */

const SCENE_W = 44;
const SCENE_H = 24;

/* 픽셀 한 칸의 크기. 메뉴바에서 4/6/8로 바꾼다 —
 * 페이지를 줌으로 줄이면 글씨까지 작아지므로 도트 크기만 건드린다.
 * 짝수만 쓰는 이유: 소품이 절반 칸(HALF)을 쓰기 때문 */
let SCALE = 8;
let HALF = 4;

const canvas = document.getElementById('pet-canvas');
// 랭킹의 "친구 책상 구경" 미리보기가 잠깐 자기 캔버스로 바꿔 그린다
let ctx = canvas.getContext('2d');

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
  n: '#e3a55c', // 햄스터 골든 탄
  N: '#b87a35', // 햄스터 진한 금색 (정수리 / 옆구리)
  j: '#8a5c36', // 해달 몸통 브라운 (따뜻한 초콜릿 — 회갈색이면 원숭이 같다)
  J: '#5c3a22', // 해달 진한 브라운 (귀 / 발 / 그늘)
  i: '#efe2c8', // 해달 크림 (얼굴 / 가슴)
  q: '#8d4a63', // 군고구마 껍질 자주
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
  F: '#3f9d4e', // 잎 진한 초록 (화분 / 토마토 꼭지)
  A: '#7bc86c', // 잎 밝은 초록
  V: '#8fd0e8', // 어항 물
  X: '#f2913d', // 불꽃 / 물고기 주황
  R: '#d9534f', // 토마토 빨강 / 목도리 / 왕관 보석
};

/* ---------------- 그리기 헬퍼 ---------------- */
/* 스킨 색 치환표 — 펫을 그리는 동안만 세팅된다 (가구는 원래 색 유지) */
let skinMap = null;

function px(x, y, color) {
  ctx.fillStyle = (skinMap && skinMap[color]) || PAL[color] || color;
  ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = (skinMap && skinMap[color]) || PAL[color] || color;
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

/* 스프라이트 실루엣을 여덟 방향으로 반 칸씩 밀어 그린다 — 위에 본체를 겹치면
 * 가장자리에 반 칸짜리 얇은 림 라이트(테두리 빛)만 남는다.
 * 흑요석처럼 어두운 스킨이 어두운 배경에 묻히지 않게 하는 용도 */
const RIM_OFFSETS = [
  [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5],
  [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5],
];

function spriteRim(grid, ox, oy, color) {
  ctx.fillStyle = color;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      for (const [dx, dy] of RIM_OFFSETS) {
        ctx.fillRect((ox + x + dx) * SCALE, (oy + y + dy) * SCALE, SCALE, SCALE);
      }
    }
  }
}

/* 소품용 절반 픽셀 (고양이는 큼직하게, 소품은 알아볼 수 있게 잘게) */
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
function buildSprite(sil, paint, base, W = 22) {
  const H = sil.length + 2;
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

/* ---------------- 햄스터 (정면, 동글납작 + 작은 귀) ----------------
 * 좁은 정수리 → 통통한 볼따구 → 살짝 잘록 → 다시 차오르는 배.
 * 옆선이 일자가 되면 햄스터답지 않다 — 곡선이 생명 */
const HAMSTER_SIL = [
  [[3, 4], [15, 16]],           // 귀 끝 — 밑동보다 좁게, 둥근 반원으로
  [[2, 5], [14, 17]],           // 귀 밑동 — 정수리보다 위라 사이가 파인다
  [[3, 16]],                    // 정수리
  [[2, 17]],
  [[2, 17]],                    // 눈 높이 (금색 위)
  [[1, 18]],                    // 볼따구 시작
  [[0, 19]],                    // 볼따구 최대
  [[0, 19]],
  [[1, 18]],                    // 볼 아래로 살짝 들어가고
  [[2, 17]],                    // 잘록 — 얼굴과 배의 경계
  [[1, 18]],                    // 배가 다시 차오른다
  [[0, 19]],
  [[0, 19]],                    // 배 최대
  [[0, 19]],
  [[1, 18]],
  [[2, 17]],                    // 책상 뒤로
];

const HAMSTER_PAINT = [
  // 귀 — 안쪽 아래 한 칸만 하얗게 (더 크면 귀가 뚫려 보인다)
  [1, 4, 4, 'w'], [1, 15, 15, 'w'],
  // 정수리 무늬 — 아래가 둥근 돔. 눈(6~7, 12~13열) 위를 덮지 않게
  // 좁게 — 넓으면 눈과 붙어 일자 눈썹처럼 보인다
  [2, 7, 12, 'N'],
  [3, 8, 11, 'N'],
  // 흰 얼굴 — 눈 바로 아래에서 시작, 볼따구는 테두리까지 순백
  // (눈은 금색 위에 남는다 — 참고 이미지의 핵심)
  [5, 3, 16, 'w'],
  [6, 0, 19, 'w'],
  [7, 0, 19, 'w'],
  [8, 1, 18, 'w'],
  [9, 4, 15, 'w'],
  [10, 4, 15, 'w'],
  [11, 4, 15, 'w'],
  [12, 4, 15, 'w'],
  [13, 5, 14, 'w'],
  // 분홍 볼 (볼따구 위)
  [6, 2, 3, 'p'], [6, 16, 17, 'p'],
  // 분홍 앞발 — 배 아래 동그란 발바닥 두 개 (참고 이미지의 분홍 발)
  [12, 6, 7, 'p'], [12, 12, 13, 'p'],
  [13, 6, 7, 'p'], [13, 12, 13, 'p'],
];

/* ---------------- 해달 (정면, 크림 얼굴 + 갈색 몸) ----------------
 * 바다에 누운 해달처럼 얼굴 전체가 밝은 크림색.
 * 상반신은 책상 뒤에서 타이핑, 하반신(OTTER_LOWER)은 책상 다리
 * 사이로 길게 누워 보인다 — 긴 몸통이 해달의 핵심 */
/* 비스듬한 자세 — 머리는 1칸 왼쪽, 몸은 내려갈수록 오른쪽으로 흘러
 * 오른쪽으로 누운 하반신과 하나의 사선 축을 이룬다 (곧게 앉으면 뻣뻣하다) */
const OTTER_SIL = [
  [[1, 2], [13, 14]],           // 귀 끝 — 머리 모서리에 둥글게
  [[0, 3], [12, 15]],           // 귀 밑동 — 정수리보다 위라 사이가 파인다
  [[1, 14]],                    // 넓적한 정수리
  [[0, 15]],
  [[0, 15]],                    // 눈 높이
  [[0, 15]],
  [[0, 15]],                    // 볼
  [[1, 14]],                    // 주둥이
  [[1, 14]],                    // 턱
  [[3, 14]],                    // 목
  [[1, 16]],                    // 어깨 — 상반신은 왼쪽에
  [[1, 17]],                    // 오른쪽 옆선은 한 칸씩만 완만하게
  [[2, 18]],                    //   (급하게 벌리면 등이 혹처럼 튀어나온다)
  [[2, 18]],
  [[4, 19]],
  [[4, 19]],                    // 책상 뒤로 — 엉덩이는 오른쪽에
];

const OTTER_PAINT = [
  // 귀 속 그늘
  [1, 2, 2, 'J'], [1, 13, 13, 'J'],
  // 크림 아랫얼굴 — 눈 바로 아래에서 수평으로 갈라져 볼 끝까지
  // (참고 이미지의 핵심: 윗머리 갈색 / 아랫얼굴 크림의 깔끔한 이등분)
  [6, 0, 15, 'i'],
  [7, 1, 14, 'i'],
  [8, 1, 14, 'i'],
  // 분홍 볼
  [7, 1, 2, 'p'], [7, 13, 14, 'p'],
  // 크림 목~가슴 — 턱에서 끊기지 않고 그대로 흘러내린다
  // (목을 갈색으로 두면 머리가 뚝 잘려 보인다)
  [9, 6, 11, 'i'],
  [10, 5, 12, 'i'],
  [11, 6, 13, 'i'],
  [12, 7, 14, 'i'],
  [13, 7, 14, 'i'],
  // 옆구리 그늘
  [10, 1, 2, 'J'], [10, 15, 16, 'J'],
  [11, 1, 2, 'J'], [11, 16, 17, 'J'],
  [12, 2, 3, 'J'], [12, 17, 18, 'J'],
  [13, 2, 3, 'J'], [13, 17, 18, 'J'],
  [14, 4, 5, 'J'], [14, 18, 19, 'J'],
  [15, 4, 5, 'J'], [15, 18, 19, 'J'],
];

/* 해달 하반신 — 책상 다리 사이 바닥(y20~23)에 비스듬히 눕는다.
 * 몸통 바로 아래에서 크림색 배가 볼록 이어지고, 긴 몸이 오른쪽으로
 * 낮게 뻗다가 물갈퀴 발 두 개가 위로 쏙, 그 너머로 납작한 꼬리 끝이
 * 오른쪽 책상다리 앞까지 빠진다 */
const OTTER_LOWER_PAINT = [
  // 하늘 보고 누웠으니 배는 크림색 — 상반신 가슴에서 그대로 이어진다
  [0, 3, 12, 'i'],
  [1, 3, 13, 'i'],
  [2, 4, 14, 'i'],
  // 물갈퀴 발만 진한 갈색 — 몸통은 밝게 둬야 발이 또렷하다.
  // 범위를 넉넉히 잡아 살랑 변형(1칸 왼쪽)까지 한 번에 칠한다
  [0, 16, 19, 'J'], [0, 22, 25, 'J'],
  [1, 16, 19, 'J'], [1, 22, 25, 'J'],
  [2, 16, 19, 'J'], [2, 22, 25, 'J'],
  // 배 밑 그늘
  [3, 5, 13, 'J'],
];

/* 발 위치만 다른 변형 — 두 발이 같이 왼쪽으로 1칸 갔다 돌아온다.
 * 높이를 바꾸면 발 크기가 변하는 것처럼 보여서 좌우로만 살랑 */
function otterLowerSprite(shift) {
  const f1 = [17 - shift, 19 - shift];
  const f2 = [23 - shift, 25 - shift];
  return buildSprite([
    [[2, 13], f1, f2],                  // 배 윗면 (발 사이 3칸 — 2칸이면 테두리로 붙어 보인다)
    [[2, 14], f1, f2],                  // 하반신은 오른쪽으로 —
    [[3, 15], f1, f2],                  //   왼쪽 끝도 내려갈수록 오른쪽으로 깎이는 사선
    [[4, 25]],                          // 바닥 — 발끝이 오른쪽 책상다리에 닿는다
  ], OTTER_LOWER_PAINT, 'j', 28);
}

const OTTER_LOWER = otterLowerSprite(0);
const OTTER_LOWER_SWING = otterLowerSprite(1);

/* ---------------- 펫 정의 (🐾 버튼으로 교체) ---------------- */
const PET_DEFS = {
  cat: {
    sprite: buildSprite(CAT_SIL, CAT_PAINT, 'o'),
    paw: ['.kkk.', 'koook', 'kcook', '.kkk.'],
    eyes: { lx: 6, rx: 12, y: 5 },
    acc: { l: 2, r: 17, top: 3 },
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
    acc: { l: 1, r: 18, top: 0 },
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
    acc: { l: 2, r: 17, top: 4 },
    face(dy) {
      // 분홍 코
      px(PET_X + 9, PET_Y + dy + 8, 'p');
      px(PET_X + 10, PET_Y + dy + 8, 'p');
    },
  },
  hamster: {
    sprite: buildSprite(HAMSTER_SIL, HAMSTER_PAINT, 'n'),
    paw: ['.kkk.', 'knnnk', 'kpnnk', '.kkk.'],
    eyes: { lx: 6, rx: 12, y: 4 },
    acc: { l: 2, r: 17, top: 2 },
    face(dy) {
      // 아주 작은 코 — 눈 바로 아래, 금색/흰색 경계에
      rect(PET_X + 9, PET_Y + dy + 6, 2, 1, 'k');
    },
  },
  otter: {
    sprite: buildSprite(OTTER_SIL, OTTER_PAINT, 'j'),
    paw: ['.kkk.', 'kjjjk', 'kJjjk', '.kkk.'],
    eyes: { lx: 4, rx: 10, y: 4 },
    acc: { l: 0, r: 15, top: 2 },
    face(dy) {
      // 작은 코 + ω 미소 (양쪽 입꼬리 점) — 머리가 2칸 왼쪽이라 같이 이동
      rect(PET_X + 7, PET_Y + dy + 6, 2, 1, 'k');
      px(PET_X + 6, PET_Y + dy + 7, 'k');
      px(PET_X + 9, PET_Y + dy + 7, 'k');
    },
    below(now) {
      // 하반신 — 테두리 첫 줄(y19)이 책상 밑선의 검정과 겹쳐
      // 몸통이 책상 뒤에서 바닥으로 자연스럽게 이어진다.
      // 발은 마우스를 움직이는 동안만 좌우로 살랑살랑
      const mousing = state.mode === 'mousing' || now - state.lastMouse < 450;
      const spr = mousing && Math.floor(now / 240) % 2
        ? OTTER_LOWER_SWING : OTTER_LOWER;
      const rim = SKINS[petSkin] && SKINS[petSkin].rim;
      if (rim) spriteRim(spr, 11, 19, rim);
      sprite(spr, 11, 19);
    },
  },
};

const PET_ORDER = ['cat', 'dog', 'rabbit', 'hamster', 'otter'];

// 점 눈 (2x2)
const EYE_OPEN = ['kk', 'kk'];
const EYE_BLINK = ['..', 'kk'];
const EYE_HAPPY = ['k.k'];
const EYE_SLEEP = EYE_BLINK;
const EYE_SAD = ['kkk', '.k.', '.z.']; // TㅁT — T자 눈 + 눈물

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

/* ---------------- 책상 소품 (절반 픽셀, 컵 자리에 그린다) ----------------
 * 레벨을 올리면 하나씩 열리는 데스크 꾸미기 아이템들 */

// 해바라기씨 — 뾰족한 끝이 위로 선 두 개, 둘째는 낮게 비스듬히
const SEEDS = [
  '....k.............',
  '...kCk............',
  '..kCkCk......k....',
  '.kCkmkCk....kCk...',
  'kCkkmkkCk..kCkCk..',
  'kCkkmkkCk.kCkmkCk.',
  'kCkkmkkCk.kCkmkCk.',
  '.kCCCCCk.kCkkmkkCk',
  '..kkkkk..kCkkmkkCk',
  '..........kCCCCCk.',
  '...........kkkkk..',
];

// 은빛 가리비 조개 (해달 취향) — 부챗살이 꼭지로 모인다
const CLAM = [
  '....kkkkk....',
  '..kkmmmmmkk..',
  '.kmmmGmGmmmk.',
  'kmmmGmmmGmmmk',
  'kmmGmmmmmGmmk',
  'kmmGmmmmmGmmk',
  '.kmGmmmmmGmk.',
  '..kmGmmmGmk..',
  '...kkGGGkk...',
  '..kGGGGGGGk..',
  '..kkkkkkkkk..',
];
// 가끔 입을 살짝 벌리면 진주가 보인다
const CLAM_OPEN = [
  '....kkkkk....',
  '..kkmmmmmkk..',
  '.kmmmGmGmmmk.',
  'kmmmGmmmGmmmk',
  'kmmGmmmmmGmmk',
  'kmmGmmmmmGmmk',
  '.kmGmmmmmGmk.',
  '..kmGmmmGmk..',
  '..k..WW...k..',
  '..kGGGGGGGk..',
  '..kkkkkkkkk..',
];

// 해바라기씨 더미 옆에서 폴짝폴짝 튀는 씨 한 알
const MINI_SEED = [
  '.k.',
  'kCk',
  'kmk',
  '.k.',
];

// 껍질을 반쯤 깐 군고구마 — 비스듬한 고구마, 위쪽만 노란 속
const GOGUMA = [
  '....kkk..',
  '...kyyyk.',
  '..kyyyyk.',
  '.kqyyyyk.',
  '.kqqyyk..',
  'kqqqqqk..',
  'kqqqqk...',
  '.kkkk....',
];

// 군고구마 김 — 뜨거움 표시, 세로 두 줄기가 번갈아 굽이친다
const STEAM_A = [
  '.aa..aa',
  'aa..aa.',
  'aa..aa.',
  '.aa..aa',
];
const STEAM_B = [
  'aa..aa.',
  '.aa..aa',
  '.aa..aa',
  'aa..aa.',
];

// 미니 탁상선풍기 — 참고 이미지처럼 격자 케이지 + 파란 날개 + 주황 받침.
// 케이지 안은 투명이라 진짜 철망처럼 뒤가 비쳐 보인다
const FAN_A = [
  '...kkkkk...',
  '..k..z..k..',
  '.k...z...k.',
  '.k.k.z.k.k.',
  'k....z....k',
  'kzzzzGzzzzk',
  'k....z....k',
  '.k.k.z.k.k.',
  '.k...z...k.',
  '..k..z..k..',
  '...kkkkk...',
  '....ktk....',
  '...kttttk..',
  '..kTTTTTTk.',
  '..kkkkkkkk.',
];
const FAN_B = [
  '...kkkkk...',
  '..k.....k..',
  '.k.z...z.k.',
  '.k.zz.zz.k.',
  'k...z.z...k',
  'k..k.G.k..k',
  'k...z.z...k',
  '.k.zz.zz.k.',
  '.k.z...z.k.',
  '..k.....k..',
  '...kkkkk...',
  '....ktk....',
  '...kttttk..',
  '..kTTTTTTk.',
  '..kkkkkkkk.',
];

/* ---------------- 고레벨 책상 소품 스프라이트 ---------------- */

// 화분 — 식물이 펫 레벨에 따라 새싹 → 수풀 → 꽃으로 자란다
const POT = [
  'kkkkkkkkk',
  'kaaaaaaak',
  '.kaaaaak.',
  '.kaaaaak.',
  '.kTTTTTk.',
  '..kkkkk..',
];
const PLANT_SPROUT = [
  '.AA.AA.',
  'AAF.FAA',
  '.AF.FA.',
  '..FFF..',
  '...F...',
];
const PLANT_BUSH = [
  '..AFA..',
  '.AAFAA.',
  'AFAAAFA',
  'AAAFAAA',
  '.AAAAA.',
  '...F...',
];
const PLANT_FLOWER = [
  '...p...',
  '..pyp..',
  '.A.p.A.',
  'AAAFAAA',
  'AFAAAFA',
  '.AAAAA.',
  '...F...',
];

/* 화분 식물 단계 — 미리보기에서는 그 사람의 레벨로 그린다 */
let previewLevel = null;

/* 새싹(18) → 수풀(30) → 꽃(42). 꽃이 펴야 나비가 찾아온다.
 * 잎은 살랑살랑, 꽃이 피면 가끔 반짝 */
function drawPot(now = 0) {
  const lv = previewLevel ?? game.level;
  const plant = lv >= 42 ? PLANT_FLOWER : lv >= 30 ? PLANT_BUSH : PLANT_SPROUT;
  const sway = Math.floor(now / 900) % 2;
  sprite4(plant, 5 + sway, 27 - plant.length);
  sprite4(POT, 4, 27);
  if (lv >= 42 && Math.floor(now / 1300) % 4 === 0) px4(9 + sway, 21, 'W');
}

// 어항 — 물고기가 좌우로 헤엄치고 공기방울이 올라온다
const BOWL = [
  '..kkkkkkkk..',
  '.kWVVVVVVWk.',
  'kVVVVVVVVVVk',
  'kVVVVVVVVVVk',
  'kVVVVVVVVVVk',
  'kVVVVVVVVVVk',
  'kVVVVVVVVVVk',
  '.kVVVVVVVVk.',
  '..kkkkkkkk..',
  '...kGGGGk...',
  '...kkkkkk...',
];
const FISH_R = [
  'X..XX',
  'XXXXW',
  'X..XX',
];
const FISH_L = [
  'XX..X',
  'WXXXX',
  'XX..X',
];

function drawBowl(now) {
  sprite4(BOWL, 3, 22);
  const ph = now / 1100;
  const fx = 3.5 + Math.sin(ph) * 2.5;
  sprite4(Math.cos(ph) >= 0 ? FISH_R : FISH_L,
    3 + Math.round(fx), 26 + (Math.floor(now / 700) % 2));
  // 공기방울 — 물 안에서만 올라온다
  const rise = Math.floor(now / 350) % 4;
  px4(3 + 5 + Math.round(Math.sin(ph)), 27 - rise, 'W');
}

// 무드등(캔들) — 불꽃이 흔들리고, 밤에는 은은한 빛무리가 커진다
const CANDLE_A = [
  '...X...',
  '..XyX..',
  '...y...',
  '...k...',
  '.kkkkk.',
  'kWWWWWk',
  'kWWpWWk',
  'kWWWWWk',
  'kkkkkkk',
];
const CANDLE_B = [
  '..X....',
  '..XyX..',
  '...y...',
  '...k...',
  '.kkkkk.',
  'kWWWWWk',
  'kWWpWWk',
  'kWWWWWk',
  'kkkkkkk',
];

function drawCandleGlow(now, night) {
  // 불꽃 위치(절반 픽셀 8.5, 25.5)를 중심으로 한 원형 그라데이션 빛
  const cx = 8.5 * HALF;
  const cy = 25.5 * HALF;
  const r = (night ? 15 : 10) * HALF;
  const a = (night ? 0.30 : 0.12) + 0.05 * Math.sin(now / 420);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,214,90,${a.toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// 토마토 — 뽀모도로 100회 완주 기념
const TOMATO = [
  '..F..F..',
  '...FF...',
  '.kkFFkk.',
  'kRRFFRRk',
  'kRWRRRRk',
  'kRRRRRRk',
  '.kRRRRk.',
  '..kkkk..',
];

// 미니 모닥불 — 30일 연속 잔디 기념, 불꽃이 일렁인다
const FIRE_A = [
  '....y...',
  '...yy...',
  '..yXXy..',
  '..XyyX..',
  '.XXyyXX.',
  'kBBkkBBk',
  'kBBBBBBk',
  '.kkkkkk.',
];
const FIRE_B = [
  '...y....',
  '...yy...',
  '..yXy...',
  '..XyyX..',
  '.XXyXX..',
  'kBBkkBBk',
  'kBBBBBBk',
  '.kkkkkk.',
];

// 아침 해 — 새벽 5시 세션 기념 장식. 광선이 번갈아 깜빡인다
const SUN = [
  'y...y...y',
  '..kkkkk..',
  '.kyyyyyk.',
  'ykyyXyyky',
  '.kyyyyyk.',
  '..kkkkk..',
  'y...y...y',
  '....k....',
  '..kTTTk..',
  '..kkkkk..',
];
const SUN_B = [
  '....y....',
  '..kkkkk..',
  '.kyyyyyk.',
  '.kyyXyyk.',
  '.kyyyyyk.',
  '..kkkkk..',
  '....y....',
  '....k....',
  '..kTTTk..',
  '..kkkkk..',
];

// 크리스마스 트리 — 겨울 이벤트 보상. 별 + 3단 가지 + 오너먼트
const TREE = [
  '.....y.....',
  '....yyy....',
  '....kFk....',
  '...kFAFk...',
  '..kFRFAFk..',
  '...kFAFk...',
  '..kFAFAFk..',
  '.kFAFsFAFk.',
  '..kFAFAFk..',
  '.kFAFAFRFk.',
  'kFRFAFAFsFk',
  '.kkkkkkkkk.',
  '....kBk....',
  '....kBk....',
];

// 할로윈 펌킨 조명 — 눈코입이 빛나는 잭오랜턴
const PUMPKIN = [
  '....kF....',
  '....kFk...',
  '..kkXXkk..',
  '.kXXaXXXk.',
  'kXyyXXyyXk',
  'kXXXaXXXXk',
  'kXyXyyXyXk',
  '.kXXXXXXk.',
  '..kkkkkk..',
];

function drawPumpkinGlow(now, night) {
  // 눈코입 위치(절반 픽셀 9, 29)를 중심으로 한 주황 불빛
  const cx = 9 * HALF;
  const cy = 29 * HALF;
  const r = (night ? 14 : 9) * HALF;
  const a = (night ? 0.28 : 0.10) + 0.05 * Math.sin(now / 380);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,170,60,${a.toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// 트로피 — 리더보드 1위 기념
const TROPHY = [
  '.kkkkkkkkk.',
  '.kyyyyyyyk.',
  'kykyyWyykyk',
  'kkkyyyyykkk',
  '...kyyyk...',
  '....kyk....',
  '...kkkkk...',
  '...kDDDk...',
  '..kkkkkkk..',
];

/* ---------------- 꾸미기 아이템 목록 ----------------
 * lv 있는 것은 레벨로, ach 있는 것은 업적으로 잠금 해제 */
const DESK_ITEMS = {
  coffee: {
    label: '아이스 커피', emoji: '☕', lv: 1,
    draw: (now) => {
      sprite4(CUP, 4, 20);
      // 유리잔 물방울 반짝 — 두 지점이 번갈아 빛난다
      const ph = Math.floor(now / 700) % 4;
      if (ph === 0) px4(6, 26, 'W');
      else if (ph === 2) px4(10, 29, 'W');
    },
  },
  seeds: {
    label: '해바라기씨', emoji: '🌻', lv: 3,
    draw: (now) => {
      sprite4(SEEDS, 2, 22);
      // 옆에서 폴짝폴짝 튀는 씨 한 알
      const hop = Math.floor(now / 300) % 4 === 1 ? 1 : 0;
      sprite4(MINI_SEED, 20, 28 - hop);
    },
  },
  clam: {
    label: '조개', emoji: '🐚', lv: 5,
    // 가끔 입을 살짝 벌리면 진주가 빼꼼
    draw: (now) => sprite4(Math.floor(now / 1100) % 6 === 0 ? CLAM_OPEN : CLAM, 3, 22),
  },
  goguma: {
    label: '군고구마', emoji: '🍠', lv: 8,
    draw: (now) => {
      sprite4(GOGUMA, 4, 25);
      sprite4(Math.floor(now / 400) % 2 ? STEAM_A : STEAM_B, 6, 19); // 김 모락모락
    },
  },
  fan: {
    label: '탁상 선풍기', emoji: '🌀', lv: 12,
    draw: (now) => sprite4(Math.floor(now / 120) % 2 ? FAN_A : FAN_B, 3, 18),
  },
  pot: { label: '화분', emoji: '🪴', lv: 18, draw: drawPot },
  bowl: { label: '어항', emoji: '🐠', lv: 27, draw: drawBowl },
  candle: {
    label: '무드등', emoji: '🕯️', lv: 36,
    draw: (now) => sprite4(Math.floor(now / 500) % 2 ? CANDLE_A : CANDLE_B, 5, 24),
    glow: drawCandleGlow, // 밤 오버레이 위에 다시 그려 빛이 살아 있게
  },
  tomato: {
    label: '토마토', emoji: '🍅', lv: 1, ach: 'pomo100',
    draw: (now) => {
      sprite4(TOMATO, 4, 25);
      // 반들반들 광택이 자리를 옮겨 가며 반짝
      const ph = Math.floor(now / 800) % 4;
      if (ph === 1) px4(9, 28, 'W');
      else if (ph === 3) px4(7, 30, 'W');
    },
  },
  campfire: {
    label: '미니 모닥불', emoji: '🔥', lv: 1, ach: 'streak30',
    draw: (now) => sprite4(Math.floor(now / 180) % 2 ? FIRE_A : FIRE_B, 4, 25),
  },
  sun: {
    label: '아침 해', emoji: '☀️', lv: 1, ach: 'early5',
    // 광선이 대각선 ↔ 십자로 번갈아 깜빡인다
    draw: (now) => sprite4(Math.floor(now / 650) % 2 ? SUN_B : SUN, 4, 23),
  },
  trophy: {
    label: '트로피', emoji: '🏆', lv: 1, ach: 'top1',
    draw: (now) => {
      sprite4(TROPHY, 3, 24);
      // 컵을 스치는 빛 — 세 지점을 차례로 훑는다
      const spots = [[6, 25], [8, 26], [5, 27]];
      const s = Math.floor(now / 300) % 6;
      if (s < 3) px4(spots[s][0], spots[s][1], 'W');
    },
  },
  pumpkin: {
    label: '펌킨 조명', emoji: '🎃', lv: 1, ach: 'eventGhost',
    draw: (now) => {
      sprite4(PUMPKIN, 4, 24);
      // 촛불이 일렁이듯 눈코입이 가끔 어두워진다
      if (Math.floor(now / 300) % 5 === 0) {
        for (const [x, y] of [[6, 28], [7, 28], [10, 28], [11, 28], [6, 30], [8, 30], [9, 30], [11, 30]]) {
          px4(x, y, 'X');
        }
      }
    },
    glow: drawPumpkinGlow, // 밤 오버레이 위에 다시 그려 빛이 살아 있게
  },
  tree: {
    label: '크리스마스 트리', emoji: '🎄', lv: 1, ach: 'eventIce',
    draw: (now) => {
      sprite4(TREE, 3, 19);
      // 전구처럼 오너먼트 두 그룹이 번갈아 켜지고 별도 반짝인다
      const ph = Math.floor(now / 600) % 2;
      const on = ph ? [[7, 23], [10, 28], [11, 29]] : [[8, 26], [5, 29]];
      for (const [x, y] of on) px4(x, y, 'y');
      if (Math.floor(now / 900) % 3 === 0) px4(8, 19, 'W');
    },
  },
};

/* 안경 — 눈 위치(P.eyes)에 맞춰 그려서 어느 펫이든 쓸 수 있다.
 * 테라코타 뿔테 — 회색이면 고양이 털색에 묻힌다 */
function drawGlasses(P, dy) {
  const y = PET_Y + dy + P.eyes.y;
  for (const ex of [PET_X + P.eyes.lx, PET_X + P.eyes.rx]) {
    rect(ex - 1, y - 1, 4, 1, 'a'); // 2x2 눈을 감싸는 4x4 링
    rect(ex - 1, y + 2, 4, 1, 'a');
    rect(ex - 1, y, 1, 2, 'a');
    rect(ex + 2, y, 1, 2, 'a');
  }
  // 브릿지 + 바깥으로 나가는 안경 다리
  rect(PET_X + P.eyes.lx + 3, y, P.eyes.rx - P.eyes.lx - 4, 1, 'a');
  px(PET_X + P.eyes.lx - 2, y, 'a');
  px(PET_X + P.eyes.rx + 3, y, 'a');
}

/* 헤드셋 — 머리 폭(P.acc)이 펫마다 달라서 앵커를 펫 정의에 둔다.
 * 정수리를 가로지르는 두툼한 검정 아치(안감 회색) + 큼직한 이어컵 */
function drawHeadset(P, dy) {
  const a = P.acc;
  const ey = PET_Y + dy + P.eyes.y;
  const yt = PET_Y + dy + a.top;   // 아치 윗줄
  const lx = PET_X + a.l;
  const rx = PET_X + a.r;
  const w = a.r - a.l;
  // 아치 밴드 — 검정 테에 테라코타 안감 (회색이면 경계선처럼 보인다)
  rect(lx + 2, yt, w - 3, 1, 'k');
  rect(lx + 2, yt + 1, w - 3, 1, 'a');
  // 어깨처럼 내려가는 스텝
  px(lx + 1, yt + 1, 'k'); px(rx - 1, yt + 1, 'k');
  px(lx + 1, yt + 2, 'k'); px(rx - 1, yt + 2, 'k');
  // 밴드 → 컵 연결 기둥 (머리가 길어 아치와 컵이 떨어진 펫만)
  const cupTop = ey - 1;
  if (cupTop > yt + 3) {
    rect(lx, yt + 3, 1, cupTop - yt - 3, 'k');
    rect(rx, yt + 3, 1, cupTop - yt - 3, 'k');
  }
  // 큼직한 이어컵 — 속에 테라코타 쿠션
  rect(lx - 2, cupTop, 3, 4, 'k');
  rect(rx, cupTop, 3, 4, 'k');
  rect(lx - 1, cupTop + 1, 1, 2, 'a');
  rect(rx + 1, cupTop + 1, 1, 2, 'a');
}

/* 목도리 — 어깨선을 두 줄로 감고 오른쪽에 꼬리가 늘어진다.
 * 얼굴이 커서 턱 바로 밑에 두르면 입처럼 보인다 — 어깨까지 내린다 */
function drawScarf(P, dy, now = 0) {
  const y = PET_Y + dy + P.eyes.y + 5;
  const l = PET_X + P.acc.l + 2;
  const r = PET_X + P.acc.r - 2;
  const sway = Math.floor(now / 900) % 2; // 꼬리가 살랑살랑
  rect(l, y, r - l + 1, 1, 'R');
  rect(l, y + 1, r - l + 1, 1, '#b23e3a');
  rect(r - 3 - sway, y + 2, 2, 2, 'R');       // 늘어진 꼬리
  rect(r - 3 - sway, y + 4, 2, 1, '#b23e3a'); // 술
}

/* 선글라스 — 안경과 같은 앵커, 렌즈를 까맣게 채운다 */
function drawSunglasses(P, dy) {
  const y = PET_Y + dy + P.eyes.y;
  for (const ex of [PET_X + P.eyes.lx, PET_X + P.eyes.rx]) {
    rect(ex - 1, y - 1, 4, 4, 'k');
    px(ex, y, 'G'); // 렌즈 반사광
  }
  rect(PET_X + P.eyes.lx + 3, y, P.eyes.rx - P.eyes.lx - 4, 1, 'k');
  px(PET_X + P.eyes.lx - 2, y, 'k');
  px(PET_X + P.eyes.rx + 3, y, 'k');
}

/* 산타 모자 — 흰 털 브림 + 빨간 크라운, 끝이 오른쪽으로 처지고 방울이 달린다.
 * 머리 위 여백이 1칸뿐이라 정수리에 눌러쓴 실루엣로 그린다 */
function drawHat(P, dy) {
  const y = PET_Y + dy + P.eyes.y;
  const l = PET_X + P.eyes.lx - 3;
  const w = P.eyes.rx - P.eyes.lx + 7;
  const r = l + w - 1;
  const mid = l + (w >> 1);
  const s = y - 6 < 0 ? 1 : 0;             // 머리가 캔버스 끝에 닿는 펫은 한 칸 눌러쓴다
  rect(mid, y - 6 + s, r - 1 - mid, 1, 'R');   // 오른쪽으로 처진 끝
  rect(l + 2, y - 5 + s, w - 4, 1, 'R');       // 좁아지는 크라운
  rect(l + 1, y - 4 + s, w - 2, 1, 'R');
  rect(r - 1, y - 6 + s, 2, 2, 'W');           // 하얀 털 방울
  px(r + 1, y - 5 + s, 'W');
  rect(l, y - 3 + s, w, 1, 'W');               // 흰 털 브림
  rect(l, y - 2 + s, w, 1, 'k');               // 브림 밑 테두리
  px(l - 1, y - 3 + s, 'k');                   // 브림 양끝 테두리 (흰 토끼 위에서도 또렷하게)
  px(r + 1, y - 3 + s, 'k');
}

/* 왕관 — 금색 밴드 + 보석 + 뾰족 3개, 고레벨의 상징.
 * 검정 테두리를 둘러야 골드 스킨 위에서도 묻히지 않는다 */
function drawCrown(P, dy, now = 0) {
  const y = PET_Y + dy + P.eyes.y - 4;
  const l = PET_X + P.eyes.lx - 1;
  const r = PET_X + P.eyes.rx + 2;
  const w = r - l + 1;
  const mid = l + (w >> 1);
  rect(l - 1, y - 1, 1, 3, 'k');      // 왼쪽 테두리
  rect(r + 1, y - 1, 1, 3, 'k');      // 오른쪽 테두리
  rect(l, y + 2, w, 1, 'k');          // 밴드 아래 테두리
  rect(l, y, w, 2, 'y');
  // 가운데 보석 — 은은하게 빛났다 꺼졌다
  px(mid, y + 1, Math.floor(now / 800) % 3 ? 'R' : '#ff9db4');
  px(l, y - 1, 'y');
  px(r, y - 1, 'y');
  px(mid, y - 1, 'y');
  px(mid, y - 2, 'y');
  px(mid - 1, y - 2, 'k');            // 가운데 뾰족 테두리
  px(mid + 1, y - 2, 'k');
  if (Math.floor(now / 800) % 5 === 0) px(r, y - 2, 'W'); // 가끔 반짝
}

const ACC_ITEMS = {
  none: { label: '없음', emoji: '✕', lv: 1, draw: null },
  glasses: { label: '안경', emoji: '👓', lv: 6, draw: drawGlasses },
  headset: { label: '헤드셋', emoji: '🎧', lv: 10, draw: drawHeadset },
  scarf: { label: '목도리', emoji: '🧣', lv: 13, draw: drawScarf },
  sunglasses: { label: '선글라스', emoji: '🕶️', lv: 16, draw: drawSunglasses },
  hat: { label: '산타 모자', emoji: '🎅', lv: 18, draw: drawHat },
  crown: { label: '왕관', emoji: '👑', lv: 20, draw: drawCrown },
};

/* ---------------- 스킨 (팔레트 교체) ----------------
 * 실루엣은 그대로 두고 몸통 색만 갈아 끼운다. 홀로그램은 매 프레임
 * 색상환을 돌며 반짝인다 */
const PET_BODY_CHARS = {
  cat: { base: 'o', shade: 'O', light: 'c' },
  dog: { base: 'b', shade: 'e', light: 'f' },
  rabbit: { base: 'w', shade: 'u' },
  hamster: { base: 'n', shade: 'N', light: 'w' },
  otter: { base: 'j', shade: 'J', light: 'i' },
};

const SKINS = {
  none: { label: '기본', emoji: '🐾', lv: 1 },
  gold: {
    label: '골드', emoji: '✨', lv: 25,
    // 대비를 크게 — 밝은 곳은 거의 흰 금, 그늘은 진한 황동이어야 금속처럼 보인다
    colors: { base: '#f2c14e', shade: '#c07f1c', light: '#ffedb3' },
    // 토끼는 몸 전체가 단색이라 진한 금을 통째로 칠하면 황달처럼 보인다 —
    // 크림빛 샴페인 골드로 살짝만 물들인다
    perPet: { rabbit: { base: '#f7dc8f', shade: '#cf9c2e' } },
    sparkle: '#fff7d6',
  },
  strawberry: {
    label: '딸기우유', emoji: '🍓', lv: 30,
    colors: { base: '#f5b8c9', shade: '#d9849e', light: '#fde3ea' },
  },
  obsidian: {
    label: '흑요석', emoji: '🌑', lv: 50, // 최상위 과시템 — 오래 키운 사람의 상징
    // 보라 기운이 도는 유리질 검정 — 회색이면 그냥 때 탄 고양이다
    colors: { base: '#322e3c', shade: '#201d28', light: '#5a5470' },
    // 눈은 연보라 — 노란 눈은 어둠 속 맹수처럼 보여서 무섭다.
    // 보라 글린트와 같은 계열이라 밤하늘처럼 몽글해진다
    eye: '#cbb7f0',
    sparkle: '#b9a7e8', // 보라 광택 글린트
    rim: '#a89ec4',     // 림 라이트 — 어두운 바탕화면에서도 실루엣이 살아 있게
  },
  // ---- 계절 이벤트 스킨 — 레벨이 아니라 이벤트 업적으로 해제 ----
  ghost: {
    label: '유령', emoji: '👻', lv: 1, ach: 'eventGhost',
    // 반투명 — 뒤의 바탕화면이 비쳐 보인다
    colors: {
      base: 'rgba(235,238,250,0.55)',
      shade: 'rgba(185,192,220,0.55)',
      light: 'rgba(250,252,255,0.6)',
    },
  },
  ice: {
    label: '아이스', emoji: '❄️', lv: 1, ach: 'eventIce',
    colors: { base: '#cfe8f2', shade: '#8fc3d9', light: '#f0fafd' },
    sparkle: '#ffffff',
  },
};

function petSkinMap() {
  const sk = SKINS[petSkin];
  if (!sk || !sk.colors) return null;
  const ch = PET_BODY_CHARS[petKind];
  const c = (sk.perPet && sk.perPet[petKind]) || sk.colors;
  const m = { [ch.base]: c.base, [ch.shade]: c.shade };
  if (ch.light) m[ch.light] = c.light;
  if (sk.eye) m.__eye = sk.eye; // renderPet이 눈 스프라이트에만 적용
  return m;
}

/* 스킨 반짝이 — 몸통 위 세 점이 번갈아 반짝인다. 금속/보석 느낌의 핵심 */
function drawSkinSparkle(now, dy) {
  const sk = SKINS[petSkin];
  if (!sk || !sk.sparkle) return;
  const a = PET_DEFS[petKind].acc;
  const spots = [
    [a.l + 3, 9],
    [a.r - 3, 12],
    [a.l + ((a.r - a.l) >> 1), 4],
  ];
  spots.forEach(([sx, sy], i) => {
    if (Math.floor(now / 400 + i * 1.4) % 4 === 0) {
      px(PET_X + sx, PET_Y + dy + sy, sk.sparkle);
    }
  });
}

/* ---------------- 책상 스타일 (상판/다리 색 교체) ---------------- */
const DESK_STYLES = {
  basic: { label: '기본 책상', emoji: '🟧', lv: 1, top: 't', stripe: 'y', leg: 'T' },
  wood: { label: '원목 책상', emoji: '🪵', lv: 15, top: '#8f6136', stripe: '#c99961', leg: '#6e4826' },
  marble: {
    label: '대리석 책상', emoji: '🏛️', lv: 25,
    top: '#e8e6ef', stripe: '#cbc8da', leg: '#b9b6c8', vein: '#aaa7bd',
  },
};

/* ---------------- 키보드 스타일 ---------------- */
const KB_ITEMS = {
  basic: { label: '기본 키보드', emoji: '⌨️', lv: 1 },
  mech: { label: '기계식 키보드', emoji: '🎹', lv: 22 },
};

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

function renderPet(eye, dy, now = 0) {
  const P = PET_DEFS[petKind];
  const rim = SKINS[petSkin] && SKINS[petSkin].rim;
  if (rim) spriteRim(P.sprite, PET_X - 1, PET_Y - 1 + dy, rim);
  sprite(P.sprite, PET_X - 1, PET_Y - 1 + dy);
  // 흑요석 같은 어두운 스킨은 눈 색을 따로 지정한다 — 눈에만 잠깐 적용
  const m = skinMap;
  if (m && m.__eye) skinMap = { ...m, k: m.__eye };
  sprite(eye, PET_X + P.eyes.lx, PET_Y + dy + P.eyes.y);
  sprite(eye, PET_X + P.eyes.rx, PET_Y + dy + P.eyes.y);
  skinMap = m;
  P.face(dy);
  const acc = ACC_ITEMS[petAcc];
  if (acc && acc.draw) acc.draw(P, dy, now);
}

/* ---------------- 가구/소품 ---------------- */
function drawFloorShadow() {
  rect(2, 23, 40, 1, 'rgba(30,22,17,0.18)');
}

function drawDesk() {
  const st = DESK_STYLES[deskStyle] || DESK_STYLES.basic;
  rect(1, DESK_Y, 42, 1, 'k');
  rect(1, DESK_Y + 1, 42, 1, st.top);
  rect(1, DESK_Y + 2, 1, 1, 'k');
  rect(2, DESK_Y + 2, 40, 1, st.stripe);
  rect(42, DESK_Y + 2, 1, 1, 'k');
  rect(1, DESK_Y + 3, 42, 1, 'k');
  // 대리석 결
  if (st.vein) {
    for (const vx of [6, 14, 23, 31, 38]) px(vx, DESK_Y + 1, st.vein);
    for (const vx of [10, 27, 35]) px(vx, DESK_Y + 2, st.vein);
  }
  // 다리
  rect(2, 20, 1, 3, 'k');
  rect(3, 20, 2, 3, st.leg);
  rect(5, 20, 1, 3, 'k');
  rect(38, 20, 1, 3, 'k');
  rect(39, 20, 2, 3, st.leg);
  rect(41, 20, 1, 3, 'k');
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

// 기계식 키보드의 파스텔 키캡 색 (열마다 순환)
const MECH_CAPS = ['#e8c8f0', '#a7e0b8', '#a9c1dd', '#f7c948', '#e79aa8'];

function drawKeyboard(now, typing) {
  const mech = kbStyle === 'mech';
  rect4(KB.x, KB.y, KB.w, KB.h, 'k');
  rect4(KB.x + 1, KB.y + 1, KB.w - 2, KB.h - 2, mech ? '#2f2b38' : 'g');
  // 타이핑 중엔 키가 하나씩 눌린다 — 빠르게 옮겨 다니며 콩콩
  const pressedIdx = mech && typing ? (Math.floor(now / 140) * 7) % 24 : -1;
  let i = 0;
  for (let ky = KB.y + 2; ky < KB.y + KB.h - 1; ky += 2) {
    for (let kx = KB.x + 2; kx < KB.x + KB.w - 2; kx += 2) {
      if (mech) {
        const pressed = i === pressedIdx;
        px4(kx, ky + (pressed ? 1 : 0), pressed ? '#8f8f98' : MECH_CAPS[i % 5]);
      } else {
        px4(kx, ky, 'h');
      }
      i++;
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
  sadUntil: 0,
  nagging: false,
  mode: 'idle',
};

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo'); // typing | mousing | sleeping | celebrating | sad

/* ---- 펫 크기 (메뉴바에서 변경) ----
 * 캔버스 자체를 도트 크기에 맞춰 다시 잡아 준다. CSS로 줄이면 도트가
 * 뭉개지지만, 칸 크기를 줄이면 어느 크기에서도 픽셀이 또렷하다. */
function setPetSize(px) {
  SCALE = [4, 6, 8].includes(px) ? px : 8;
  HALF = SCALE / 2;
  canvas.width = SCENE_W * SCALE;
  canvas.height = SCENE_H * SCALE;
  ctx.imageSmoothingEnabled = false; // 캔버스 크기를 바꾸면 초기화된다
  // 말풍선 꼬리가 펫 머리 위에 오도록 CSS에서 쓰는 폭
  document.documentElement.style.setProperty('--pet-w', `${canvas.width}px`);
}

setPetSize(+params.get('pet_px') || 8);
if (window.pet) window.pet.onPetSize(setPetSize);

let petKind = params.get('pet') || localStorage.getItem('petKind') || 'cat';
if (!PET_DEFS[petKind]) petKind = 'cat';

/* 꾸미기 선택 (책상 소품 / 액세서리 / 스킨 / 책상 / 키보드) — 레벨·업적으로 잠금 해제 */
let deskItem = params.get('desk') || localStorage.getItem('deskItem') || 'coffee';
if (!DESK_ITEMS[deskItem]) deskItem = 'coffee';
let petAcc = params.get('acc') || localStorage.getItem('petAcc') || 'none';
if (!ACC_ITEMS[petAcc]) petAcc = 'none';
let petSkin = params.get('skin') || localStorage.getItem('petSkin') || 'none';
if (!SKINS[petSkin]) petSkin = 'none';
let deskStyle = params.get('deskstyle') || localStorage.getItem('deskStyle') || 'basic';
if (!DESK_STYLES[deskStyle]) deskStyle = 'basic';
let kbStyle = params.get('kb') || localStorage.getItem('kbStyle') || 'basic';
if (!KB_ITEMS[kbStyle]) kbStyle = 'basic';

const startTime = performance.now();

function currentMode(now) {
  if (DEMO) return DEMO;
  if (now < state.celebrateUntil) return 'celebrating';
  if (now < state.sadUntil) return 'sad';
  if (now - state.lastKey < 400) return 'typing';
  if (now - state.lastMouse < 450) return 'mousing';
  if (now - Math.max(state.lastKey, state.lastMouse, startTime) > 60000 &&
      !state.nagging) return 'sleeping'; // 잔소리 중엔 깨어 있는다
  return 'idle';
}

/* ---------------- 잔소리 말풍선 (키보드를 10분 이상 안 치면) ---------------- */
const NAG_AFTER = 10 * 60000;
const NAG_MESSAGES = [
  '일해라!',
  '키보드가 식었다',
  '10분째 멈춤',
  '집중.',
];
const nagEl = document.getElementById('nag');

function updateNag(now) {
  const idle = now - Math.max(state.lastKey, startTime);
  const timerBusy = timer.running ||
    !bubble.classList.contains('hidden') || !bragEl.classList.contains('hidden');
  const show = DEMO === 'nag' ||
    (!DEMO && !timerBusy && !game.away && idle >= NAG_AFTER);
  if (show && nagEl.classList.contains('hidden')) {
    nagEl.textContent = NAG_MESSAGES[Math.floor(Math.random() * NAG_MESSAGES.length)];
  }
  nagEl.classList.toggle('hidden', !show);
  state.nagging = show;
}

/* ================================================================
 * 잔디밭 — 완주한 집중 시간(분)을 날짜별로 쌓는다
 *  { '2026-07-31': 75 } 형태. 여러 PC를 오가도 하루치가 합산되도록
 *  기기별로 나눠 저장하고 서버가 더한다 (깃허브 잔디처럼)
 * ================================================================ */
const GRASS_WEEKS = 16;                // 패널에 보여줄 주 수
const GRASS_KEEP_DAYS = GRASS_WEEKS * 7 + 14;
const POMO_MIN_MINUTES = 10;           // 1분 타이머로 잔디를 심는 어뷰징 방지
const POMO_UNIT = 25;                  // 색 한 단계 = 25분 (기본 뽀모도로 길이)
const DAY_MS = 86400000;

function dayKey(d) {
  // 로컬 날짜 기준 (UTC로 하면 자정 전후로 하루가 밀린다)
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function loadDays(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (_) {
    return {};
  }
}

/* 이 PC가 심은 집중 시간(분)과, 서버가 알려 준 "다른 PC들의 합"을 따로 둔다.
 * 이렇게 해야 같은 날 데스크탑 50분 + 노트북 25분 = 75분으로 합산되고,
 * 오프라인일 때도 내 몫을 바로 더해서 보여줄 수 있다 */
let pomoMine = loadDays('pomoMine');
let pomoOthers = loadDays('pomoOthers');

// 기기 구분용 — 서버는 기기별로 나눠 담았다가 날짜별로 더한다
let deviceId = localStorage.getItem('deviceId') || '';
if (!deviceId) {
  deviceId = [...crypto.getRandomValues(new Uint32Array(4))]
    .map((n) => n.toString(36)).join('');
  try { localStorage.setItem('deviceId', deviceId); } catch (_) { /* 무시 */ }
}

function pruneDays(days) {
  const cutoff = dayKey(new Date(Date.now() - GRASS_KEEP_DAYS * DAY_MS));
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k]; // 'YYYY-MM-DD'는 문자열 비교로 충분
  return days;
}

function savePomoMine() {
  try { localStorage.setItem('pomoMine', JSON.stringify(pruneDays(pomoMine))); } catch (_) { /* 무시 */ }
}

function savePomoOthers() {
  try { localStorage.setItem('pomoOthers', JSON.stringify(pruneDays(pomoOthers))); } catch (_) { /* 무시 */ }
}

// v1.3.0은 "하루에 완주한 개수"를 셌다 — 한 개를 기본 뽀모도로 길이로 환산해 옮긴다
(function migrateCounts() {
  const old = localStorage.getItem('pomoDays');
  if (!old || localStorage.getItem('pomoMine')) return;
  try {
    for (const [k, v] of Object.entries(JSON.parse(old))) {
      pomoMine[k] = (Math.max(0, +v) || 0) * POMO_UNIT;
    }
    savePomoMine();
    localStorage.removeItem('pomoDays');
  } catch (_) { /* 무시 */ }
})();

// 정오 기준으로 날짜를 옮긴다 — 밀리초를 더하면 서머타임에서 하루가 밀린다
function addDays(base, n) {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n) {
  return addDays(new Date(), -n);
}

/* 그날의 집중 시간(분) — 이 PC + 다른 PC들 */
function dayMinutes(d) {
  const k = dayKey(d);
  return (pomoMine[k] || 0) + (pomoOthers[k] || 0);
}

/* 잔디 색 단계: 25분마다 한 단계씩 진해지고 100분부터는 제일 진하다 */
function grassLevel(minutes) {
  return minutes <= 0 ? 0 : Math.min(4, Math.ceil(minutes / POMO_UNIT));
}

/* 오늘(오늘이 비었으면 어제)부터 거꾸로 이어진 날 수 */
function currentStreak() {
  const start = dayMinutes(new Date()) ? 0 : 1;
  let n = 0;
  for (let i = start; i < GRASS_KEEP_DAYS; i++) {
    if (!dayMinutes(daysAgo(i))) break;
    n++;
  }
  return n;
}

/* 이번 주(일요일 시작)에 하나라도 채운 날 수 */
function thisWeekDays() {
  let n = 0;
  for (let i = 0; i <= new Date().getDay(); i++) if (dayMinutes(daysAgo(i))) n++;
  return n;
}

/* ================================================================
 * 레벨 / 일 세션 (다마고치처럼 키우기)
 *  - 일 시작 후 타이핑하면 +1/초, 잠들면 -1/초, 잔소리 뜨면 -2/초
 *  - 자리 비움 중엔 증감 없음, 일 끝 완주 보너스 / 뽀모도로 보너스
 * ================================================================ */
const XP_PER_LEVEL = (lv) => lv * 2000; // 1000이었더니 레벨이 너무 빨리 올랐다
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
  demoted: false, // 이번 세션에서 강등됐는가 — 세션당 한 번만 떨어진다
};

/* ?lv=30 — 테스트 모드: 레벨을 잠깐 올려 잠금 해제를 눈으로 확인한다.
 * 저장·업로드·동기화가 전부 꺼져 실제 진행과 리더보드에 아무 흔적도 안 남는다 */
const SANDBOX_LEVEL = Math.max(0, Math.floor(+params.get('lv')) || 0);
const SANDBOX = SANDBOX_LEVEL > 0;
if (SANDBOX) {
  game.level = SANDBOX_LEVEL;
  game.xp = 0;
}

const hudLevel = document.getElementById('hud-level');
const hudXp = document.getElementById('hud-xp');
const xpFill = document.getElementById('xpfill');
const toastEl = document.getElementById('toast');
let toastTimer = null;

function saveGame() {
  if (SANDBOX) return;
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
  game.xp += n;
  let leveled = false;
  const prevLevel = game.level;
  while (game.xp >= XP_PER_LEVEL(game.level)) {
    game.xp -= XP_PER_LEVEL(game.level);
    game.level += 1;
    leveled = true;
  }
  // 강등 — 세션당 한 번, Lv.1이 바닥. 그 밖엔 0에서 버틴다
  let dropped = false;
  if (game.xp < 0) {
    if (game.level > 1 && !game.demoted) {
      game.level -= 1;
      game.xp += XP_PER_LEVEL(game.level);
      game.demoted = true;
      dropped = true;
    } else {
      game.xp = 0;
    }
  }
  if (leveled) {
    state.celebrateUntil = performance.now() + CELEBRATE_MS;
    if (window.pet) window.pet.notify('🎉 레벨 업!', `펫이 Lv.${game.level}이 되었어요!`);
    // 이번 레벨 업으로 새로 열린 꾸미기 아이템 알림 (업적 아이템은 레벨과 무관)
    const news = [
      ...Object.values(DESK_ITEMS), ...Object.values(ACC_ITEMS),
      ...Object.values(SKINS), ...Object.values(DESK_STYLES), ...Object.values(KB_ITEMS),
    ].filter((it) => !it.ach && it.lv > prevLevel && it.lv <= game.level);
    if (news.length) showToast(`🔓 해제: ${news.map((it) => `${it.emoji} ${it.label}`).join(', ')}`);
    pushScore();
  }
  if (dropped) {
    state.sadUntil = performance.now() + SAD_MS;
    showToast('레벨 떨어졌다 TㅁT');
    if (window.pet) window.pet.notify('레벨 떨어졌다 TㅁT', `지금 Lv.${game.level}.`);
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

/* ================================================================
 * 업적 / 통계 — 레벨이 아닌 "행동"으로 열리는 히든 콘텐츠
 * ================================================================ */
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('petStats') || '{}');
    return {
      pomos: Math.max(0, Math.floor(+s.pomos) || 0),
      keys: Math.max(0, Math.floor(+s.keys) || 0),
      early: !!s.early,
      top1: !!s.top1,
      bestStreak: Math.max(0, Math.floor(+s.bestStreak) || 0),
      visitors: s.visitors && typeof s.visitors === 'object' ? s.visitors : {},
      pomoMonths: s.pomoMonths && typeof s.pomoMonths === 'object' ? s.pomoMonths : {},
      done: Array.isArray(s.done) ? s.done : [],
    };
  } catch (_) {
    return {
      pomos: 0, keys: 0, early: false, top1: false, bestStreak: 0,
      visitors: {}, pomoMonths: {}, done: [],
    };
  }
}

const stats = loadStats();

function saveStats() {
  if (SANDBOX) return;
  try { localStorage.setItem('petStats', JSON.stringify(stats)); } catch (_) { /* 무시 */ }
}

const ACHIEVEMENTS = {
  pomo100: {
    emoji: '🍅', label: '토마토 농장주', desc: '뽀모도로 100회 완주',
    goal: 100, val: () => stats.pomos, reward: 'tomato',
  },
  streak30: {
    emoji: '🔥', label: '불타는 연속', desc: '30일 연속 잔디 심기',
    goal: 30, val: () => Math.max(stats.bestStreak, currentStreak()), reward: 'campfire',
  },
  early5: {
    emoji: '☀️', label: '얼리버드', desc: '새벽 5시에 일하기',
    goal: 1, val: () => (stats.early ? 1 : 0), reward: 'sun',
  },
  top1: {
    emoji: '🏆', label: '정상 정복', desc: '리더보드 1위 달성',
    goal: 1, val: () => (stats.top1 ? 1 : 0), reward: 'trophy',
  },
  keys100k: {
    emoji: '⌨️', label: '타이핑 마스터', desc: '누적 10만 타 입력',
    goal: 100000, val: () => stats.keys,
  },
  collector: {
    emoji: '🦋', label: '방문객 친구', desc: '방문객 5종 모두 만나기',
    goal: 5, val: () => Object.keys(stats.visitors).length,
  },
  // ---- 계절 이벤트 — 매년 그 달에 뽀모도로 20회 완주하면 스킨+소품 세트를 준다 ----
  eventGhost: {
    emoji: '🎃', label: '할로윈 준비', desc: '9월 한 달간 뽀모도로 20회 완주',
    goal: 20, val: () => monthPomos('09'), reward: ['ghost', 'pumpkin'],
  },
  eventIce: {
    emoji: '🎄', label: '겨울 준비', desc: '11월 한 달간 뽀모도로 20회 완주',
    goal: 20, val: () => monthPomos('11'), reward: ['ice', 'tree'],
  },
};

/* 보상은 하나(문자열)일 수도, 세트(배열)일 수도 있다 — 소품/스킨 어느 쪽이든 */
function rewardItems(a) {
  if (!a.reward) return [];
  const keys = Array.isArray(a.reward) ? a.reward : [a.reward];
  return keys.map((k) => DESK_ITEMS[k] || SKINS[k]).filter(Boolean);
}

/* 그 달(어느 해든)에 완주한 뽀모도로 최고 기록 — 이벤트는 매년 돌아온다 */
function monthPomos(mm) {
  let best = 0;
  for (const [k, v] of Object.entries(stats.pomoMonths)) {
    if (k.endsWith(`-${mm}`)) best = Math.max(best, +v || 0);
  }
  return best;
}

// 테스트 모드에서 ?ach=1 이면 업적도 전부 열어 본다 (저장 안 됨)
if (SANDBOX && params.get('ach') === '1') {
  stats.done = Object.keys(ACHIEVEMENTS);
}

function achUnlocked(id) {
  return stats.done.includes(id);
}

/* 잠긴 아이템이 장착된 채로 시작하면(테스트 모드에서 골랐거나 데이터가 꼬였거나)
 * 기본값으로 되돌린다. 데모 URL 파라미터로 지정한 경우는 그대로 둔다 */
(function sanitizeEquipped() {
  if (SANDBOX || params.get('desk') || params.get('acc') || params.get('skin') ||
      params.get('deskstyle') || params.get('kb')) return;
  const locked = (it) => (it.ach ? !achUnlocked(it.ach) : it.lv > game.level);
  const fix = [
    ['deskItem', DESK_ITEMS[deskItem], 'coffee', (v) => { deskItem = v; }],
    ['petAcc', ACC_ITEMS[petAcc], 'none', (v) => { petAcc = v; }],
    ['petSkin', SKINS[petSkin], 'none', (v) => { petSkin = v; }],
    ['deskStyle', DESK_STYLES[deskStyle], 'basic', (v) => { deskStyle = v; }],
    ['kbStyle', KB_ITEMS[kbStyle], 'basic', (v) => { kbStyle = v; }],
  ];
  for (const [key, it, def, set] of fix) {
    if (!locked(it)) continue;
    set(def);
    try { localStorage.setItem(key, def); } catch (_) { /* 무시 */ }
  }
})();

function checkAchievements() {
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
    if (stats.done.includes(id) || a.val() < a.goal) continue;
    stats.done.push(id);
    saveStats();
    state.celebrateUntil = performance.now() + CELEBRATE_MS;
    const rewards = rewardItems(a);
    const rewardMsg = rewards.map((r) => `${r.emoji} ${r.label}`).join(', ');
    showToast(`🏅 업적 달성: ${a.label}!${rewardMsg ? ` — ${rewardMsg} 해제` : ''}`);
    if (window.pet) window.pet.notify('🏅 업적 달성!', `${a.label} — ${a.desc}`);
  }
  if (typeof achPanel !== 'undefined' && !achPanel.classList.contains('hidden')) renderAch();
}

/* ================================================================
 * 방문객 — 일하는 중에 가끔 책상에 놀러 온다 (도감에 기록)
 * ================================================================ */
const VISITORS = {
  // 나비는 화분에 꽃이 핀 뒤(Lv.42)에야 찾아온다
  butterfly: { emoji: '🦋', label: '나비', weight: 4, dur: 18000, minLv: 42 },
  bird: { emoji: '🐦', label: '참새', weight: 3, dur: 15000 },
  ladybug: { emoji: '🐞', label: '무당벌레', weight: 3, dur: 20000 },
  snail: { emoji: '🐌', label: '달팽이', weight: 2, dur: 28000 },
  firefly: { emoji: '✨', label: '반딧불이', weight: 2, dur: 20000, night: true },
};

const visitor = { kind: null, start: 0, until: 0 };

function spawnVisitor(kind, { record = true } = {}) {
  const v = VISITORS[kind];
  if (!v) return;
  const now = performance.now();
  visitor.kind = kind;
  visitor.start = now;
  visitor.until = now + v.dur;
  showToast(`${v.emoji} ${v.label}가 놀러 왔어요!`);
  if (!record) return; // 데모/스크린샷 소환은 도감에 남기지 않는다
  stats.visitors[kind] = (stats.visitors[kind] || 0) + 1;
  saveStats();
  checkAchievements();
}

/* 평균 15분에 한 번쯤 — 오래 일할수록 많이 만난다 */
function maybeSpawnVisitor() {
  if (visitor.kind || Math.random() > 1 / 900) return;
  const night = isNight();
  const pool = Object.entries(VISITORS).filter(([, v]) =>
    (!v.night || night) && (!v.minLv || game.level >= v.minLv));
  const total = pool.reduce((s, [, v]) => s + v.weight, 0);
  let roll = Math.random() * total;
  for (const [k, v] of pool) {
    roll -= v.weight;
    if (roll <= 0) return spawnVisitor(k);
  }
}

// 1초마다 세션 점수 정산 + 업적 체크
setInterval(() => {
  // 얼리버드 — 새벽 5시대에 일 세션이나 집중 타이머가 돌고 있으면
  if (!stats.early && new Date().getHours() === 5 &&
      ((game.working && !game.away) || (timer.running && timer.label !== '휴식'))) {
    stats.early = true;
    saveStats();
    checkAchievements();
  }
  if (!game.working || game.away) return;
  maybeSpawnVisitor();
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
 * 리더보드 & 동기화 (Supabase) — 닉네임 + 동기화 코드가 계정
 * publishable(anon) 키는 공개용이고, 쓰기는 코드를 검증하는 RPC로만 가능
 * 리더보드 행이 곧 클라우드 세이브 — 다른 PC에서 이어 키울 수 있다
 * ================================================================ */
const SB_URL = 'https://qefrpkflpdpzxyrwyxvd.supabase.co';
const SB_KEY = 'sb_publishable_epIs7YckEJ8ETJkrrUHKfw_lhH6FEMA';
const SB_TABLE = 'leaderboard';
const PET_EMOJI = { cat: '🐱', dog: '🐶', rabbit: '🐰', hamster: '🐹', otter: '🦦' };

let nickname = localStorage.getItem('nickname') || '';
let syncCode = localStorage.getItem('syncCode') || '';

// 동기화 코드: 사람이 옮겨 적기 쉽게 8자 (O/0, I/1처럼 헷갈리는 문자 제외)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genSyncCode() {
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  const chars = [...buf].map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function normalizeCode(raw) {
  const s = raw.toUpperCase().replace(/[^A-Z2-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : raw.trim().toUpperCase();
}

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

function sbRpc(fn, args) {
  return sbFetch(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
}

// 서버가 아직 잔디/꾸미기 칼럼을 모르는 경우(스키마 미적용) 점수까지 막히지 않게 한 번만 물러선다
let pomoSyncOff = false;
let decoSyncOff = false;

/* 지금 착용 중인 꾸미기 한 벌 — 서버에 올려 두면 친구들이 책상 구경을 할 수 있다 */
function currentDeco() {
  return { desk: deskItem, acc: petAcc, skin: petSkin, deskStyle, kb: kbStyle };
}

/* 점수 업로드. interactive는 "사용자가 방금 저장을 눌렀다"는 뜻 —
 * 펫 교체나 자동 저장 같은 배경 업로드가 뜬금없이 말풍선을 띄우면 안 된다 */
async function pushScore({ interactive = false } = {}) {
  if (SANDBOX) return false; // 테스트 레벨을 리더보드에 올리면 안 된다
  if (!nickname || !syncCode) return false;
  const args = {
    p_nickname: nickname,
    p_secret: syncCode,
    p_level: game.level,
    p_xp: game.xp,
    p_pet: petKind,
  };
  const withPomo = { ...args, p_device: deviceId, p_pomo: pomoMine };
  const withDeco = { ...withPomo, p_deco: currentDeco() };
  try {
    let res;
    try {
      res = await sbRpc('upsert_score',
        decoSyncOff ? (pomoSyncOff ? args : withPomo) : withDeco);
    } catch (err) {
      if (!`${err.message}`.includes('404')) throw err;
      // 스키마가 낡은 순서대로 한 단계씩 물러선다: deco 빼고 → 잔디도 빼고
      if (!decoSyncOff) {
        decoSyncOff = true;
        try {
          res = await sbRpc('upsert_score', pomoSyncOff ? args : withPomo);
        } catch (err2) {
          if (pomoSyncOff || !`${err2.message}`.includes('404')) throw err2;
          pomoSyncOff = true;
          res = await sbRpc('upsert_score', args);
        }
      } else if (!pomoSyncOff) {
        pomoSyncOff = true;
        res = await sbRpc('upsert_score', args);
      } else {
        throw err;
      }
    }
    if (res && res.error) {
      if (res.error === 'nickname_taken') {
        setNickTaken(true);
        if (interactive) {
          showToast('이미 다른 사람이 쓰는 닉네임이에요 — 다른 닉네임으로 저장해 주세요');
        }
      }
      return false;
    }
    setNickTaken(false);
    if (res && res.updated_at) {
      try { localStorage.setItem('lastPushAt', res.updated_at); } catch (_) { /* 무시 */ }
    }
    if (res) adoptOthers(res.pomo_others);
    return true;
  } catch (err) {
    console.error('점수 업로드 실패:', err.message);
    return false;
  }
}

/* 저장된 상태 조회. 기기를 알려 주면 서버가 "나를 뺀 나머지 합"을 돌려준다 */
async function fetchState(nick, code) {
  const args = { p_nickname: nick, p_secret: code };
  try {
    return await sbRpc('get_state', pomoSyncOff ? args : { ...args, p_device: deviceId });
  } catch (err) {
    if (pomoSyncOff || !`${err.message}`.includes('404')) throw err;
    pomoSyncOff = true; // 옛 스키마 — 잔디 없이
    return sbRpc('get_state', args);
  }
}

/* 서버가 알려 준 "다른 PC들의 합"을 통째로 갈아 끼운다 —
 * 내 몫은 따로 들고 있으므로 합치지 않고 교체하는 게 맞다 */
function adoptOthers(remote) {
  if (!remote || typeof remote !== 'object') return;
  const next = {};
  for (const [k, v] of Object.entries(remote)) {
    const n = Math.max(0, Math.floor(+v) || 0);
    if (n > 0) next[k] = n;
  }
  pomoOthers = next;
  savePomoOthers();
  if (!grassPanel.classList.contains('hidden')) renderGrass();
}

// 서버에 저장된 상태를 이 PC에 반영
function adoptState(s) {
  game.level = Math.max(1, +s.level || 1);
  game.xp = Math.max(0, +s.xp || 0);
  if (PET_DEFS[s.pet]) {
    petKind = s.pet;
    try { localStorage.setItem('petKind', petKind); } catch (_) { /* 무시 */ }
  }
  // 다른 PC에서 고른 꾸미기 한 벌도 그대로 입는다
  if (s.deco && typeof s.deco === 'object') {
    const d = s.deco;
    try {
      if (DESK_ITEMS[d.desk]) { deskItem = d.desk; localStorage.setItem('deskItem', d.desk); }
      if (ACC_ITEMS[d.acc]) { petAcc = d.acc; localStorage.setItem('petAcc', d.acc); }
      if (SKINS[d.skin]) { petSkin = d.skin; localStorage.setItem('petSkin', d.skin); }
      if (DESK_STYLES[d.deskStyle]) { deskStyle = d.deskStyle; localStorage.setItem('deskStyle', d.deskStyle); }
      if (KB_ITEMS[d.kb]) { kbStyle = d.kb; localStorage.setItem('kbStyle', d.kb); }
    } catch (_) { /* 무시 */ }
  }
  adoptOthers(s.pomo_others);
  saveGame();
  try { localStorage.setItem('lastPushAt', s.updated_at || ''); } catch (_) { /* 무시 */ }
  updateHud();
}

/* 리더보드 1위인지 확인 — 업적 "정상 정복" 판정 */
async function checkTop1(rows) {
  try {
    const top = rows ||
      await sbFetch(`${SB_TABLE}?select=nickname&order=level.desc,xp.desc&limit=1`);
    if (!stats.top1 && nickname && top && top[0] &&
        top[0].nickname.toLowerCase() === nickname.toLowerCase()) {
      stats.top1 = true;
      saveStats();
      checkAchievements();
    }
  } catch (_) { /* 오프라인 — 다음에 */ }
}

// 시작 시 동기화: 다른 PC가 더 최근에 저장했으면 서버 상태를 가져온다
async function syncOnStart() {
  if (SANDBOX) return; // 테스트 모드 — 서버 상태로 되돌리지도, 덮지도 않는다
  if (!nickname) return;
  if (!syncCode) {
    // v1 사용자: 코드를 만들어 기존 랭킹 행을 선점한다.
    // 서버가 받아 준 뒤에 저장한다 — 거절당한 코드를 들고 있으면
    // 그 뒤로 업로드가 조용히 계속 실패한다
    syncCode = genSyncCode();
    if (await pushScore()) {
      try { localStorage.setItem('syncCode', syncCode); } catch (_) { /* 무시 */ }
      showToast('동기화 코드가 생겼어요 — 랭킹 패널에서 확인하세요 🔑');
    } else {
      syncCode = '';
    }
    updateCodeRow();
    return;
  }
  try {
    const res = await fetchState(nickname, syncCode);
    if (!res || res.error) return;
    // 잔디는 레벨보다 먼저 받는다 — 이 PC가 최신이어도 다른 PC가 심어 둔 날이 있을 수 있다
    adoptOthers(res.pomo_others);
    const lastPush = localStorage.getItem('lastPushAt') || '';
    // 같은 서버가 찍은 ISO 타임스탬프라 문자열 비교로 충분
    if (lastPush && res.updated_at <= lastPush) return; // 이 PC가 최신
    adoptState(res);
    showToast('다른 PC의 진행 상황을 불러왔어요 ✨');
  } catch (_) { /* 오프라인 등 — 로컬 유지 */ }
  checkTop1();
}

const rankList = document.getElementById('rank-list');

/* 레벨 배지 — 리더보드에서 고레벨이 한눈에 보인다 */
function lvBadge(lv) {
  return lv >= 30 ? ' 💎' : lv >= 20 ? ' 🌟' : lv >= 10 ? ' ⭐' : '';
}

async function loadRanking() {
  rankList.innerHTML = '<li>불러오는 중…</li>';
  hideRankPreview();
  try {
    let rows;
    try {
      rows = await sbFetch(
        `${SB_TABLE}?select=nickname,level,xp,pet,deco&order=level.desc,xp.desc&limit=10`
      );
    } catch (err) {
      // 옛 스키마 — deco 칼럼이 없으면 빼고 다시
      if (!/40[04]/.test(`${err.message}`)) throw err;
      rows = await sbFetch(
        `${SB_TABLE}?select=nickname,level,xp,pet&order=level.desc,xp.desc&limit=10`
      );
    }
    if (!rows || !rows.length) {
      rankList.innerHTML = '<li>아직 아무도 없어요 — 닉네임을 저장해 보세요!</li>';
      return;
    }
    rankList.replaceChildren(...rows.map((r, i) => {
      const li = document.createElement('li');
      li.textContent =
        `${i + 1}위 ${PET_EMOJI[r.pet] || '🐾'} ${r.nickname}${lvBadge(r.level)}` +
        ` — Lv.${r.level} (${r.xp})`;
      if (nickname && r.nickname.toLowerCase() === nickname.toLowerCase()) {
        li.classList.add('me');
      }
      li.title = `클릭하면 펫이 이 책상을 상상해요 💭 (경험치 ${IMAGINE_COST.toLocaleString()} 소모)`;
      li.addEventListener('click', () => toggleRankPreview(r));
      return li;
    }));
    checkTop1(rows);
  } catch (err) {
    rankList.innerHTML = '<li>불러오기 실패 — 네트워크나 테이블을 확인해 주세요</li>';
  }
}

/* ---- 친구 책상 구경 — 랭킹 줄을 클릭하면 펫이 그 사람의 책상을 "상상"한다.
 * 머리 위 구름 생각 풍선 안에 친구의 펫+꾸미기 장면이 그려진다.
 * 상상력은 레벨로 자란다: Lv.35부터 조금씩, Lv.60이 되면 전부 선명하게 ---- */
const THINK_MS = 9000;
const IMAGINE_MIN_LV = 35;
const IMAGINE_FULL_LV = 60;
const IMAGINE_COST = 3000;            // 상상 한 번에 쓰는 경험치
const IMAGINE_FREE_MS = 5 * 60000;    // 값을 치른 친구는 5분 동안 무료로 다시 본다
const thinkEl = document.getElementById('think');
const previewCanvas = document.getElementById('preview-canvas');
const previewName = document.getElementById('preview-name');
let previewNick = '';
let thinkTimer = null;

/* 내 레벨만큼만 친구의 꾸미기를 상상할 수 있다 — 상상 못 하는 부분은
 * 기본값으로 채우지 않고 구멍이 숭숭 뚫린 채로 남는다 */
function imagineVis() {
  const lv = game.level;
  return {
    acc: lv >= 42,                 // 42부터 액세서리
    desk: lv >= 50,                // 50부터 책상 소품
    full: lv >= IMAGINE_FULL_LV,   // 60부터 책상·키보드까지 전부
  };
}

/* 상상이 안 나는 자리에 뚫는 구멍 — 가장자리가 지저분한 흰 얼룩(구름 속살) */
function punchHole(cx, cy, rw, rh, seed) {
  ctx.fillStyle = '#ffffff';
  for (let y = Math.floor(cy - rh); y <= Math.ceil(cy + rh); y++) {
    for (let x = Math.floor(cx - rw); x <= Math.ceil(cx + rw); x++) {
      const d = ((x - cx) / rw) ** 2 + ((y - cy) / rh) ** 2;
      // 좌표 해시 노이즈 — 매번 같은 자리가 뜯긴 것처럼 고정된 너덜너덜함
      const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453) % 1;
      if (d <= 0.72 || (d <= 1.15 && n > 0.45)) {
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
}

function hideRankPreview() {
  thinkEl.classList.add('hidden');
  previewNick = '';
  clearTimeout(thinkTimer);
}

let imaginePaid = { nick: '', at: 0 };

function toggleRankPreview(r) {
  if (game.level < IMAGINE_MIN_LV) {
    showToast(`💭 친구 책상을 상상하는 건 Lv.${IMAGINE_MIN_LV}부터 조금씩 열려요`);
    return;
  }
  if (previewNick === r.nickname) {
    hideRankPreview();
    return;
  }
  // 상상은 공짜가 아니다 — 모아 둔 경험치를 태워서 떠올린다 (테스트 모드는 무료)
  const freePass = imaginePaid.nick === r.nickname &&
    Date.now() - imaginePaid.at < IMAGINE_FREE_MS;
  if (!SANDBOX && !freePass) {
    if (game.xp < IMAGINE_COST) {
      showToast(`💭 상상하려면 경험치 ${IMAGINE_COST.toLocaleString()}이 필요해요 (지금 ${game.xp.toLocaleString()})`);
      return;
    }
    game.xp -= IMAGINE_COST;
    imaginePaid = { nick: r.nickname, at: Date.now() };
    saveGame();
    updateHud();
    showToast(`💭 경험치 ${IMAGINE_COST.toLocaleString()}을 상상에 사용했어요`);
  }
  previewNick = r.nickname;
  const vis = imagineVis();
  renderDeskPreview(r, vis);
  previewName.textContent =
    `${PET_EMOJI[r.pet] || '🐾'} ${r.nickname}의 책상…${vis.full ? '' : ' 군데군데 안 보인다'}`;
  thinkEl.classList.remove('hidden');
  clearTimeout(thinkTimer);
  thinkTimer = setTimeout(hideRankPreview, THINK_MS);
}

/* ---- 구름 모양 — 사각 몸통 + 가장자리 원 혹들의 합집합을 픽셀로 굽는다 ---- */
const CLOUD_W = 56;
const CLOUD_H = 38;
const CLOUD_BUMPS = [
  [10, 6, 5], [20, 4, 6], [31, 5, 6], [42, 6, 5],   // 윗변 혹
  [5, 14, 5], [5, 24, 5], [50, 14, 5], [50, 24, 5], // 옆면 혹
  [13, 31, 4], [25, 32, 4], [38, 31, 4],            // 아랫변 혹
];

function inCloud(x, y) {
  if (x >= 5 && x <= 50 && y >= 6 && y <= 31) return true;
  return CLOUD_BUMPS.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
}

function drawCloud() {
  for (let y = 0; y < CLOUD_H; y++) {
    for (let x = 0; x < CLOUD_W; x++) {
      if (!inCloud(x, y)) continue;
      const edge = !inCloud(x - 1, y) || !inCloud(x + 1, y) ||
        !inCloud(x, y - 1) || !inCloud(x, y + 1);
      ctx.fillStyle = edge ? PAL.k : '#ffffff';
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }
  // 생각 방울 — 오른쪽 아래 펫 머리를 향해 점점 작아진다
  ctx.fillStyle = PAL.k;
  ctx.fillRect(44 * SCALE, 39 * SCALE, 2 * SCALE, 2 * SCALE);
  ctx.fillRect(48 * SCALE, 43 * SCALE, 1 * SCALE, 1 * SCALE);
}

/* 그리기 헬퍼가 전부 전역 ctx/SCALE을 쓰므로, 잠깐 미니 캔버스로 바꿔
 * 정지 화면 한 장을 그리고 원래대로 되돌린다 (동기라 렌더 루프와 안 겹친다) */
function renderDeskPreview(r, vis = { acc: true, desk: true, full: true }) {
  const saved = { ctx, SCALE, HALF, petKind, petAcc, deskItem, petSkin, deskStyle, kbStyle };
  const d = (r.deco && typeof r.deco === 'object') ? r.deco : {};
  ctx = previewCanvas.getContext('2d');
  SCALE = 4;
  HALF = 2;
  previewCanvas.width = CLOUD_W * SCALE;
  previewCanvas.height = 46 * SCALE; // 구름 38칸 + 생각 방울 자리
  ctx.imageSmoothingEnabled = false;
  petKind = PET_DEFS[r.pet] ? r.pet : 'cat';
  deskItem = DESK_ITEMS[d.desk] ? d.desk : 'coffee';
  petAcc = vis.acc && ACC_ITEMS[d.acc] ? d.acc : 'none';
  petSkin = SKINS[d.skin] ? d.skin : 'none';
  deskStyle = vis.full && DESK_STYLES[d.deskStyle] ? d.deskStyle : 'basic';
  kbStyle = vis.full && KB_ITEMS[d.kb] ? d.kb : 'basic';
  previewLevel = Math.max(1, +r.level || 1); // 화분은 그 사람 레벨만큼 자라 있다

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  drawCloud();
  // 구름 안쪽에 장면을 그린다 — 그리기 헬퍼가 전부 셀 좌표라 translate로 밀면 된다
  ctx.save();
  ctx.translate(6 * SCALE, 7 * SCALE);
  drawFloorShadow();
  skinMap = petSkinMap(0);
  renderPet(EYE_OPEN, 0);
  skinMap = null;
  drawSkinSparkle(0, 0);
  drawDesk();
  const below = PET_DEFS[petKind].below;
  if (below) {
    skinMap = petSkinMap(0);
    below(0);
    skinMap = null;
  }
  if (vis.desk) DESK_ITEMS[deskItem].draw(0); // 소품을 상상 못 하면 아예 안 그린다
  drawMonitor(0, false);
  drawKeyboard(0, false);
  drawMouse(0);
  skinMap = petSkinMap(0);
  const paw = PET_DEFS[petKind].paw;
  sprite(paw, PAW_L, PAW_REST);
  sprite(paw, PAW_R, PAW_REST);
  skinMap = null;

  // 상상이 안 나는 자리는 구멍이 숭숭 — 레벨이 오를수록 구멍이 메워진다
  if (!vis.desk) punchHole(5, 12, 5, 4, 1);              // 소품 자리
  if (!vis.acc) punchHole(20, 4, 5, 2.4, 2);             // 머리(액세서리) 자리
  if (!vis.full) {
    punchHole(11, 17.5, 5, 1.8, 3);                      // 책상 왼쪽
    punchHole(31, 18, 4, 1.6, 4);                        // 책상 오른쪽
    punchHole(20, 15.5, 4.5, 1.6, 5);                    // 키보드 자리
  }
  if (!vis.acc && !vis.desk) {
    punchHole(36, 9, 3, 2, 6);                           // 초반엔 더 숭숭 — 모니터
    punchHole(15, 12, 2.5, 1.5, 7);                      //   몸통에도 하나
  }
  ctx.restore();

  ({ ctx, SCALE, HALF, petKind, petAcc, deskItem, petSkin, deskStyle, kbStyle } = saved);
  previewLevel = null;
}

// 일하는 중엔 5분마다 점수 자동 업로드
setInterval(() => {
  if (game.working) pushScore();
}, 300000);

const CELEBRATE_MS = 4000;
const SAD_MS = 4000;

/* ---------------- 밤 연출 ----------------
 * 저녁 8시~새벽 6시엔 장면이 어두워지고 달이 뜬다.
 * 무드등은 밤에 빛무리가 커진다 (?night=1 로 강제) */
const DEMO_NIGHT = params.get('night');

function isNight() {
  if (DEMO_NIGHT) return DEMO_NIGHT === '1';
  const h = new Date().getHours();
  return h >= 20 || h < 6;
}

const MOON = [
  '..WW',
  '.WW.',
  '.WW.',
  '..WW',
];

/* ---------------- 방문객 스프라이트 ---------------- */
const BFLY_A = [
  'ss.k.ss',
  'sssksss',
  '.spkps.',
];
const BFLY_B = [
  '.s.k.s.',
  '.sskss.',
  '..pkp..',
];
const BIRD_A = [
  '...kkk...',
  '..keeek..',
  '.Xkekeek.',
  '..kfffek.',
  '..kffeek.',
  '...kkkk..',
  '...k..k..',
];
const BIRD_B = [
  '...kkk...',
  '..keeek..',
  '.Xkekeek.',
  '..keeeek.',
  '..kffeek.',
  '...kkkk..',
  '....kk...',
];
const SNAIL_A = [
  '..kkkk..k.',
  '.kLDDLk.C.',
  'kLDLLDLkC.',
  'kLDDDDLkCC',
  'kCCCCCCCCC',
  '.kkkkkkkkk',
];
const SNAIL_B = [
  '..kkkk.k..',
  '.kLDDLk.C.',
  'kLDLLDLkC.',
  'kLDDDDLkCC',
  'kCCCCCCCCC',
  '.kkkkkkkkk',
];
const LADYBUG = [
  '.kkkk.',
  'kRkkRk',
  'kRRRRk',
  'kRkkRk',
  '.kkkk.',
];

function drawVisitor(now) {
  if (!visitor.kind) return;
  if (now > visitor.until) {
    visitor.kind = null;
    return;
  }
  const t = now - visitor.start;
  const flap = Math.floor(now / 220) % 2;
  switch (visitor.kind) {
    case 'butterfly': {
      // 커피 위쪽 하늘을 팔랑팔랑
      const ox = 10 + Math.round(Math.sin(now / 800) * 7);
      const oy = 13 + Math.round(Math.sin(now / 470) * 4);
      sprite4(flap ? BFLY_A : BFLY_B, ox, oy);
      break;
    }
    case 'bird':
      // 모니터 위에 앉아 쉰다
      sprite4(flap ? BIRD_A : BIRD_B, 71, 2);
      break;
    case 'snail': {
      // 바닥을 왼쪽에서 오른쪽으로 느릿느릿
      const ox = Math.round(-10 + (t / VISITORS.snail.dur) * 100);
      sprite4(Math.floor(now / 600) % 2 ? SNAIL_A : SNAIL_B, ox, 41);
      break;
    }
    case 'ladybug': {
      // 책상 앞면(커피 왼쪽)을 종종종
      const ph = (now / 1400) % 2;
      const ox = 3 + Math.round((ph < 1 ? ph : 2 - ph) * 16);
      sprite4(LADYBUG, ox, 33);
      break;
    }
    case 'firefly': {
      // 밤하늘을 떠다니는 불빛 (전체 픽셀 좌표)
      const fx = 20 + Math.sin(now / 1300) * 16;
      const fy = 9 + Math.sin(now / 900 + 1.7) * 5;
      const a = 0.25 + 0.15 * Math.sin(now / 300);
      const g = ctx.createRadialGradient(
        (fx + 0.5) * SCALE, (fy + 0.5) * SCALE, 0,
        (fx + 0.5) * SCALE, (fy + 0.5) * SCALE, 4 * SCALE);
      g.addColorStop(0, `rgba(247,238,120,${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(247,238,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect((fx - 4) * SCALE, (fy - 4) * SCALE, 8 * SCALE, 8 * SCALE);
      px(Math.round(fx), Math.round(fy), 'y');
      break;
    }
  }
}

/* ---------------- 렌더 루프 ----------------
 * 가만히 있을 땐 80ms(~12.5fps)로 제한해 CPU/GPU를 아끼고,
 * 타이핑/마우스/축하/시무룩 중엔 33ms(~30fps)로 올린다 —
 * 발 콩콩이 키 입력마다 토글이라 낮은 fps에선 프레임 사이에 뭉개진다 */
const FRAME_MS = 80;
const FRAME_ACTIVE_MS = 33;
let lastFrame = 0;

function render(now) {
  requestAnimationFrame(render);
  const active = now - state.lastKey < 600 || now - state.lastMouse < 600 ||
    now < state.celebrateUntil || now < state.sadUntil || !!visitor.kind;
  if (now - lastFrame < (active ? FRAME_ACTIVE_MS : FRAME_MS)) return;
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
  if (mode === 'sad') breathe = 1; // 축 처진 자세
  const dy = breathe + bounce;

  drawFloorShadow();

  let eye = EYE_OPEN;
  if (mode === 'sleeping') eye = EYE_SLEEP;
  else if (mode === 'celebrating') eye = EYE_HAPPY;
  else if (mode === 'sad') eye = EYE_SAD;
  else {
    if (now > state.nextBlink) {
      state.blinkUntil = now + 140;
      state.nextBlink = now + 2200 + Math.random() * 2600;
    }
    if (now < state.blinkUntil) eye = EYE_BLINK;
  }

  skinMap = petSkinMap(now);
  renderPet(eye, dy, now);
  skinMap = null;
  drawSkinSparkle(now, dy);

  const typing = mode === 'typing';
  // 키보드가 더 최근 입력이면 타이핑이 양발을 차지한다 —
  // 커서가 살짝만 떨려도 오른발이 마우스에 붙잡혀 있던 문제 방지
  const mousing = mode === 'mousing' ||
    (mode !== 'sleeping' && mode !== 'celebrating' && mode !== 'sad' &&
     now - state.lastMouse < 450 && state.lastMouse > state.lastKey);
  const wiggle = mousing ? (Math.sin(now / 120) > 0 ? 1 : 0) : 0;

  drawDesk();
  const below = PET_DEFS[petKind].below;
  if (below) {
    skinMap = petSkinMap(now);
    below(now);
    skinMap = null;
  }
  DESK_ITEMS[deskItem].draw(now);
  drawMonitor(now, typing);
  drawKeyboard(now, typing);
  drawMouse(wiggle);

  const paw = PET_DEFS[petKind].paw;
  skinMap = petSkinMap(now);
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
  skinMap = null;

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

  if (mode === 'sad') {
    // 볼을 타고 떨어지는 눈물
    const P = PET_DEFS[petKind];
    const drop = Math.floor(now / 350) % 2;
    px(PET_X + P.eyes.lx + 1, PET_Y + dy + P.eyes.y + 3 + drop, 'z');
    px(PET_X + P.eyes.rx + 1, PET_Y + dy + P.eyes.y + 3 + drop, 'z');
  }

  if (mode === 'celebrating') {
    for (let i = 0; i < 8; i++) {
      const t = (now / 80 + i * 19) % 13;
      const cx2 = (i * 7 + Math.floor(now / 250) * 3) % SCENE_W;
      px(cx2, Math.floor(t), i % 2 ? 's' : 'S');
    }
  }

  // 밤 — 장면을 살짝 어둡게 하고 달과 별을 띄운다.
  // source-atop: 이미 그려진 픽셀에만 어둠을 입힌다 — 투명 배경(바탕화면)까지
  // 칠하면 창 전체에 어두운 상자가 보인다
  const night = isNight();
  if (night) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(24,28,58,0.28)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    sprite(MOON, 38, 0);
    if (Math.floor(now / 900) % 2) px(35, 2, 'y');
    if (Math.floor(now / 1300) % 2) px(42, 3, 'W');
  }

  drawVisitor(now);

  // 무드등 빛무리 — 밤 오버레이 위에 그려야 어둠을 뚫고 빛난다
  const di = DESK_ITEMS[deskItem];
  if (di.glow) di.glow(now, night);
}
requestAnimationFrame(render);

/* ---------------- 입력 이벤트 ---------------- */
if (window.pet) {
  window.pet.onActivity((type) => {
    const now = performance.now();
    if (type === 'key') {
      state.lastKey = now;
      state.pawFlip = !state.pawFlip;
      // 누적 타이핑 통계 — 저장은 100타마다 한 번만
      stats.keys += 1;
      if (stats.keys % 100 === 0) {
        saveStats();
        checkAchievements();
      }
    } else {
      state.lastMouse = now;
    }
  });

  // 업데이트 다운로드 진행률 — 완료 창이 뜰 때까지 토스트로 보여 준다
  if (window.pet.onUpdateProgress) {
    window.pet.onUpdateProgress((p) => {
      if (p.done) {
        toastEl.classList.add('hidden');
        return;
      }
      clearTimeout(toastTimer); // 4초 자동 숨김을 막고 계속 띄워 둔다
      toastEl.textContent = `⬇️ 업데이트 다운로드 중 … ${p.percent}%`;
      toastEl.classList.remove('hidden');
    });
  }

  window.pet.status().then(({ accessibilityOK, platform }) => {
    if (accessibilityOK) return;
    const hint = document.getElementById('hint');
    // 기본 문구는 macOS 손쉬운 사용 안내 — 다른 OS에선 권한 문제가 아니다
    if (platform && platform !== 'darwin') {
      hint.innerHTML = '&#9888; 키보드 감지를 시작하지 못했어요.<br/>' +
        '앱을 재설치해 보고, 그래도 안 되면<br/>' +
        '%APPDATA%\\Desktop Pet\\hook-error.log<br/>파일을 개발자에게 보내주세요.';
    }
    hint.classList.remove('hidden');
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
  timer.minutes = minutes;
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

  // 잔디 한 칸 — 짧은 타이머로 심는 건 치지 않는다
  const planted = wasWork && timer.minutes >= POMO_MIN_MINUTES;
  if (planted) {
    const k = dayKey(new Date());
    pomoMine[k] = (pomoMine[k] || 0) + timer.minutes;
    savePomoMine();
    if (!grassPanel.classList.contains('hidden')) renderGrass();
    pushScore(); // 다른 PC에서도 보이게 바로 올린다
    // 업적 통계 — 완주 횟수, 이벤트용 월별 횟수, 최고 연속 기록
    stats.pomos += 1;
    const mk = k.slice(0, 7); // 'YYYY-MM'
    stats.pomoMonths[mk] = (stats.pomoMonths[mk] || 0) + 1;
    stats.bestStreak = Math.max(stats.bestStreak, currentStreak());
    saveStats();
    checkAchievements();
  }

  if (window.pet) {
    window.pet.notify(
      wasWork ? '🍅 집중 완료' : '☕ 휴식 끝',
      wasWork ? '잠깐 쉬어라' : '다시 집중'
    );
  }
  setTimeout(() => {
    bubble.classList.add('hidden');
    if (planted) showBrag(); // 축하가 끝나면 자랑
  }, CELEBRATE_MS);
}

/* ---- 잔디밭 그리기 ---- */
const grassGrid = document.getElementById('grass-grid');
const grassMonths = document.getElementById('grass-months');
const grassSum = document.getElementById('grass-sum');
const grassStreak = document.getElementById('grass-streak');
const grassToday = document.getElementById('grass-today');
const bragEl = document.getElementById('brag');
const bragText = document.getElementById('brag-text');
const bragGrass = document.getElementById('brag-grass');

function grassCell(d, todayKey) {
  const k = dayKey(d);
  const min = dayMinutes(d);
  const el = document.createElement('i');
  el.className = `g g${grassLevel(min)}`;
  if (k === todayKey) el.classList.add('today');
  else if (k > todayKey) el.classList.add('future'); // 이번 주 남은 날은 빈자리로
  el.title = `${k} · ${min}분`;
  return el;
}

/* 달이 바뀌는 주 위에 '8월'을 얹는다 (깃허브와 같은 방식).
 * 마지막 한 주에 걸치는 라벨은 자리가 없어 넣지 않는다 */
function renderMonths(firstSunday) {
  const frag = document.createDocumentFragment();
  let prev = -1;
  for (let w = 0; w < GRASS_WEEKS; w++) {
    const month = addDays(firstSunday, w * 7).getMonth();
    if (month !== prev && w < GRASS_WEEKS - 1) {
      const el = document.createElement('span');
      el.textContent = `${month + 1}월`;
      el.style.gridColumn = `${w + 1}`;
      frag.appendChild(el);
    }
    prev = month;
  }
  grassMonths.replaceChildren(frag);
}

function renderGrass() {
  const today = new Date();
  const todayKey = dayKey(today);
  // 왼쪽 위 칸 = 16주 전 그 주의 일요일
  const first = addDays(today, -(today.getDay() + (GRASS_WEEKS - 1) * 7));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < GRASS_WEEKS * 7; i++) frag.appendChild(grassCell(addDays(first, i), todayKey));
  grassGrid.replaceChildren(frag);
  renderMonths(first);

  const streak = currentStreak();
  grassStreak.textContent = streak >= 2 ? `${streak}일 연속 🔥` : '';
  grassSum.textContent = `이번 주 ${thisWeekDays()}일`;
  grassToday.textContent = `오늘 ${dayMinutes(today)}분`;
}

/* ---- 안 물어봤는데 자랑하는 말풍선 ---- */
const BRAG_MS = 6000;
let bragTimer = null;

function bragLine() {
  const streak = currentStreak();
  if (streak >= 2) return `${streak}일 연속! 🔥`;
  const today = dayMinutes(new Date());
  if (today) return `오늘 ${today}분`;
  const week = thisWeekDays();
  return week >= 2 ? `이번 주 ${week}일` : '';
}

function showBrag() {
  const line = bragLine();
  // 타이머 말풍선이 떠 있으면 자리를 비켜 준다
  if (!line || !bubble.classList.contains('hidden')) return;
  bragText.textContent = line;
  const todayKey = dayKey(new Date());
  const frag = document.createDocumentFragment();
  for (let i = 6; i >= 0; i--) frag.appendChild(grassCell(daysAgo(i), todayKey));
  bragGrass.replaceChildren(frag);

  bragEl.classList.remove('hidden');
  clearTimeout(bragTimer);
  bragTimer = setTimeout(() => bragEl.classList.add('hidden'), BRAG_MS);
}

/* ---- UI 배선 ---- */
const rankPanel = document.getElementById('rank-panel');
const nicknameInput = document.getElementById('nickname');
const rankNote = document.getElementById('rank-note');
nicknameInput.value = nickname;

/* 업로드가 닉네임 충돌로 막혔음을 랭킹 패널에서 알려 준다 —
 * 배경 업로드는 말풍선을 띄우지 않으니 여기가 유일한 단서다 */
function setNickTaken(taken) {
  rankNote.classList.toggle('hidden', !taken);
}

const grassPanel = document.getElementById('grass-panel');

/* 패널은 한 번에 하나만 */
const decoPanel = document.getElementById('deco-panel');

function openPanel(target) {
  for (const p of [panel, rankPanel, grassPanel, decoPanel, achPanel]) {
    if (p !== target) p.classList.add('hidden');
  }
  return !target.classList.toggle('hidden');
}

document.getElementById('btn-timer').addEventListener('click', () => openPanel(panel));

document.getElementById('btn-rank').addEventListener('click', () => {
  if (openPanel(rankPanel)) loadRanking();
});

document.getElementById('btn-grass').addEventListener('click', () => {
  if (openPanel(grassPanel)) renderGrass();
});

document.getElementById('btn-nick').addEventListener('click', async () => {
  const v = nicknameInput.value.trim().slice(0, 12);
  if (!v) return;
  // 서버가 받아 준 뒤에 저장한다 — 남의 닉네임을 로컬에 남겨두면
  // 이후 업로드가 계속 거절당한다
  const prevNick = nickname;
  const firstTime = !syncCode;
  nickname = v;
  if (firstTime) syncCode = genSyncCode();

  const ok = await pushScore({ interactive: true });
  if (ok) {
    try {
      localStorage.setItem('nickname', nickname);
      if (firstTime) localStorage.setItem('syncCode', syncCode);
    } catch (_) { /* 무시 */ }
    showToast(firstTime
      ? `등록 완료! 동기화 코드 ${syncCode} — 다른 PC에서 이어 키울 때 필요해요`
      : '저장 완료!');
  } else {
    nickname = prevNick;
    if (firstTime) syncCode = '';
  }
  updateCodeRow();
  loadRanking();
});

document.getElementById('btn-rank-refresh').addEventListener('click', loadRanking);

/* ---- 동기화 코드 표시 / 다른 PC에서 이어하기 ---- */
const codeRow = document.getElementById('code-row');
const codeText = document.getElementById('code-text');
const btnCodeShow = document.getElementById('btn-code-show');
let codeVisible = false;

function updateCodeRow() {
  codeRow.classList.toggle('hidden', !syncCode);
  codeText.textContent = codeVisible ? syncCode : '••••-••••';
  btnCodeShow.textContent = codeVisible ? '가리기' : '보기';
}

btnCodeShow.addEventListener('click', () => {
  codeVisible = !codeVisible;
  updateCodeRow();
});

document.getElementById('btn-code-copy').addEventListener('click', async () => {
  if (!syncCode) return;
  try {
    await navigator.clipboard.writeText(syncCode);
    showToast('동기화 코드를 복사했어요');
  } catch (_) {
    codeVisible = true;
    updateCodeRow();
  }
});

const linkBox = document.getElementById('link-box');

document.getElementById('btn-link-toggle').addEventListener('click', () => {
  linkBox.classList.toggle('hidden');
});

document.getElementById('btn-link').addEventListener('click', async () => {
  const nick = document.getElementById('link-nick').value.trim();
  const code = normalizeCode(document.getElementById('link-code').value);
  if (!nick || !code) return;
  try {
    const res = await fetchState(nick, code);
    if (!res || res.error) {
      showToast('닉네임 또는 코드가 맞지 않아요');
      return;
    }
    nickname = res.nickname || nick;
    syncCode = code;
    try {
      localStorage.setItem('nickname', nickname);
      localStorage.setItem('syncCode', syncCode);
    } catch (_) { /* 무시 */ }
    nicknameInput.value = nickname;
    adoptState(res);
    linkBox.classList.add('hidden');
    updateCodeRow();
    showToast(`${nickname}의 펫을 불러왔어요! 🎉`);
    loadRanking();
  } catch (_) {
    showToast('불러오기 실패 — 네트워크를 확인해 주세요');
  }
});

const btnWork = document.getElementById('btn-work');
const btnAway = document.getElementById('btn-away');

btnWork.addEventListener('click', () => {
  if (!game.working) {
    game.working = true;
    game.away = false;
    game.sessionXp = 0;
    game.sessionStart = Date.now();
    game.demoted = false;
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

/* ---- 꾸미기 패널 (펫 / 스킨 / 책상 소품 / 액세서리 / 책상 / 키보드) ---- */
let petPushTimer = null;

/* 무엇을 고르든 서버에도 반영 — 연타하며 고를 수 있으니 멈춘 뒤 한 번만 */
function queueDecoPush() {
  clearTimeout(petPushTimer);
  petPushTimer = setTimeout(pushScore, 2000);
}

function decoButton(emoji, label, selected, it, pick) {
  const btn = document.createElement('button');
  const byAch = !!(it && it.ach);
  const locked = byAch ? !achUnlocked(it.ach) : (it ? it.lv : 1) > game.level;
  const hint = byAch
    ? `업적 「${ACHIEVEMENTS[it.ach].label}」(${ACHIEVEMENTS[it.ach].desc})을 달성하면 열려요`
    : `Lv.${it && it.lv}이 되면 열려요`;
  btn.textContent = locked ? (byAch ? '❓' : `🔒${it.lv}`) : emoji;
  btn.title = locked ? `${label} — ${hint}` : label;
  btn.classList.toggle('sel', selected);
  btn.classList.toggle('lock', locked);
  btn.addEventListener('click', () => {
    if (locked) {
      showToast(byAch ? `❓ ${hint}` : `🔒 ${label}은(는) Lv.${it.lv}이 되면 열려요`);
      return;
    }
    pick();
    queueDecoPush();
    renderDeco();
  });
  return btn;
}

/* 무엇으로 바뀌었는지 말풍선으로 알려 준다 — 아이콘만으로는 뭔지 모른다 */
function decoRow(elId, items, getSel, setSel, storeKey, say) {
  document.getElementById(elId).replaceChildren(
    ...Object.entries(items).map(([k, it]) =>
      decoButton(it.emoji, it.label, getSel() === k, it, () => {
        if (getSel() === k) return; // 이미 고른 것 — 말풍선까지 띄울 일은 아니다
        setSel(k);
        try { localStorage.setItem(storeKey, k); } catch (_) { /* 무시 */ }
        showToast(say(it, k));
      })));
}

const PET_LABELS = { cat: '고양이', dog: '강아지', rabbit: '토끼', hamster: '햄스터', otter: '해달' };

function renderDeco() {
  const pets = document.getElementById('deco-pets');
  pets.replaceChildren(...PET_ORDER.map((k) =>
    decoButton(PET_EMOJI[k], PET_LABELS[k], petKind === k, null, () => {
      if (petKind === k) return;
      petKind = k;
      try { localStorage.setItem('petKind', petKind); } catch (_) { /* 무시 */ }
      showToast(`${PET_EMOJI[k]} ${PET_LABELS[k]}로 변신!`);
    })));

  decoRow('deco-skin', SKINS, () => petSkin, (k) => { petSkin = k; }, 'petSkin',
    (it, k) => (k === 'none' ? '🐾 기본 스킨으로 돌아왔어요' : `${it.emoji} ${it.label} 스킨 적용!`));
  decoRow('deco-desk', DESK_ITEMS, () => deskItem, (k) => { deskItem = k; }, 'deskItem',
    (it) => `${it.emoji} ${it.label} 놓았어요!`);
  decoRow('deco-acc', ACC_ITEMS, () => petAcc, (k) => { petAcc = k; }, 'petAcc',
    (it, k) => (k === 'none' ? '액세서리를 벗었어요' : `${it.emoji} ${it.label} 착용!`));
  decoRow('deco-deskstyle', DESK_STYLES, () => deskStyle, (k) => { deskStyle = k; }, 'deskStyle',
    (it) => `${it.emoji} ${it.label}으로 교체!`);
  decoRow('deco-kb', KB_ITEMS, () => kbStyle, (k) => { kbStyle = k; }, 'kbStyle',
    (it) => `${it.emoji} ${it.label}로 교체!`);
}

document.getElementById('btn-pet').addEventListener('click', () => {
  if (openPanel(decoPanel)) renderDeco();
});

/* ---- 업적 패널 + 방문객 도감 ---- */
const achPanel = document.getElementById('ach-panel');
const achList = document.getElementById('ach-list');
const dexEl = document.getElementById('visitor-dex');

function fmtGoal(v, goal) {
  return goal >= 1000
    ? `${v.toLocaleString()}/${goal.toLocaleString()}`
    : `${v}/${goal}`;
}

function renderAch() {
  achList.replaceChildren(...Object.entries(ACHIEVEMENTS).map(([id, a]) => {
    const v = Math.min(a.goal, a.val());
    const done = achUnlocked(id) || v >= a.goal;
    const li = document.createElement('li');
    li.classList.toggle('done', done);

    const emoji = document.createElement('span');
    emoji.className = 'ach-emoji';
    emoji.textContent = done ? a.emoji : '❓';

    const body = document.createElement('div');
    body.className = 'ach-body';
    const name = document.createElement('b');
    name.textContent = a.label;
    const desc = document.createElement('small');
    const rewards = rewardItems(a);
    desc.textContent = a.desc +
      (rewards.length ? ` → ${rewards.map((r) => `${r.emoji} ${r.label}`).join(', ')}` : '');
    const bar = document.createElement('div');
    bar.className = 'ach-bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.round((v / a.goal) * 100)}%`;
    bar.appendChild(fill);
    body.append(name, desc, bar);

    const val = document.createElement('span');
    val.className = 'ach-val';
    val.textContent = done ? '✓' : fmtGoal(v, a.goal);

    li.append(emoji, body, val);
    return li;
  }));

  dexEl.replaceChildren(...Object.entries(VISITORS).map(([k, v]) => {
    const seen = stats.visitors[k];
    const d = document.createElement('div');
    d.className = seen ? 'dex' : 'dex unseen';
    d.textContent = seen ? v.emoji : '?';
    d.title = seen ? `${v.label} · ${seen}번 만남` : '???';
    return d;
  }));
}

document.getElementById('btn-ach').addEventListener('click', () => {
  if (openPanel(achPanel)) renderAch();
});

document.getElementById('btn-quit').addEventListener('click', async () => {
  saveStats(); // 타이핑 카운트는 100타 단위로만 저장하니 마지막 자투리를 남긴다
  // 마지막 상태를 서버에 남기고 종료 (오프라인이어도 1.5초 뒤엔 그냥 종료)
  await Promise.race([pushScore(), new Promise((r) => setTimeout(r, 1500))]);
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
updateCodeRow();
syncOnStart();

// 시작할 때 한 번 — 연속 기록을 갱신하고, 이미 채운 업적이 있으면 열어 준다
stats.bestStreak = Math.max(stats.bestStreak, currentStreak());
saveStats();
setTimeout(checkAchievements, 1200);

if (SANDBOX) showToast(`🧪 테스트 모드 Lv.${SANDBOX_LEVEL} — 저장·업로드 꺼짐`);

// 이벤트 달이면 그 달에 한 번만 알려 준다 (이미 받은 스킨이면 조용히)
(function eventNotice() {
  if (DEMO || SANDBOX) return;
  const mm = dayKey(new Date()).slice(5, 7);
  const ev = mm === '09' && !achUnlocked('eventGhost')
    ? '🎃 이벤트! 9월에 뽀모도로 20회 완주하면 👻 유령 스킨을 받아요'
    : mm === '11' && !achUnlocked('eventIce')
      ? '🎄 이벤트! 11월에 뽀모도로 20회 완주하면 ❄️ 아이스 스킨을 받아요'
      : '';
  const key = `eventNotice-${dayKey(new Date()).slice(0, 7)}`;
  if (!ev || localStorage.getItem(key) === '1') return;
  try { localStorage.setItem(key, '1'); } catch (_) { /* 무시 */ }
  setTimeout(() => showToast(ev), 6000);
})();

// 하루에 한 번, 앱을 처음 켤 때 잔디 자랑
const bragDay = dayKey(new Date());
if (!DEMO && localStorage.getItem('lastBragDay') !== bragDay) {
  try { localStorage.setItem('lastBragDay', bragDay); } catch (_) { /* 무시 */ }
  setTimeout(showBrag, 2500);
}

// ?timer=25 로 실행하면 바로 타이머 시작 (테스트/스크린샷용)
const DEMO_TIMER = params.get('timer');
if (DEMO_TIMER) startTimer(+DEMO_TIMER, '집중');

// ?panel=rank|timer 로 실행하면 패널이 열린 상태로 시작 (테스트/스크린샷용)
const DEMO_PANEL = params.get('panel');
if (DEMO_PANEL === 'rank') {
  rankPanel.classList.remove('hidden');
  linkBox.classList.remove('hidden');
  loadRanking();
} else if (DEMO_PANEL === 'timer') {
  panel.classList.remove('hidden');
} else if (DEMO_PANEL === 'grass') {
  grassPanel.classList.remove('hidden');
  renderGrass();
} else if (DEMO_PANEL === 'brag') {
  showBrag();
} else if (DEMO_PANEL === 'deco') {
  decoPanel.classList.remove('hidden');
  renderDeco();
} else if (DEMO_PANEL === 'ach') {
  achPanel.classList.remove('hidden');
  renderAch();
}

// ?preview=1 로 실행하면 책상 구경 미리보기가 열린 상태로 시작 (테스트/스크린샷용)
if (params.get('preview')) {
  rankPanel.classList.remove('hidden');
  toggleRankPreview({
    nickname: '테스트', pet: 'otter', level: 26,
    deco: { desk: 'pot', acc: 'crown', skin: 'gold', deskStyle: 'marble', kb: 'mech' },
  });
}

// ?visitor=butterfly 로 실행하면 방문객이 바로 나타난다 (테스트/스크린샷용)
const DEMO_VISITOR = params.get('visitor');
if (DEMO_VISITOR && VISITORS[DEMO_VISITOR]) {
  spawnVisitor(DEMO_VISITOR, { record: false });
}

/* ---- 창을 내용 높이에 맞추기 ----
 * 창이 내용보다 크면 남는 투명 영역이 그 자리의 다른 앱 클릭을 가로챈다.
 * 패널을 열고 닫을 때마다 실제 높이를 재서 메인에 알려 준다 */
const appEl = document.getElementById('app');
let lastFitH = 0;

function reportFit() {
  const h = Math.ceil(appEl.getBoundingClientRect().height);
  if (h === lastFitH || !window.pet) return;
  lastFitH = h;
  window.pet.fit(h);
}

new ResizeObserver(reportFit).observe(appEl);
reportFit();
