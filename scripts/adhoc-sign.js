// 패키징 후 처리 (electron-builder afterPack)
//  1) 포장 검사 — package.json의 dependencies가 app.asar 안에 전부 들어 있는지.
//     electron-builder는 node_modules에 없는 의존성을 에러 없이 그냥 빼고 포장한다.
//     v1.10.0이 그렇게 electron-updater 없이 나가서 모든 사용자의 자동 업데이트가
//     막혔다 ("Cannot find module 'electron-updater'"). 빌드 단계에서 잡아 실패시킨다.
//  2) macOS 서명 — 키체인의 "Desktop Pet Signing" 인증서로 서명한다. 없으면 빌드를
//     멈춘다 (ADHOC_SIGN=1이면 ad-hoc으로 — 서명이 아예 없으면 macOS가 "손상되어
//     열 수 없다"며 실행을 거부한다).
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/* asar 안에 dependencies가 모두 있는지 — 하나라도 없으면 throw로 빌드를 멈춘다 */
function assertDepsPacked(context) {
  const asar = require('@electron/asar'); // electron-builder(app-builder-lib)의 의존성
  const isMac = context.electronPlatformName === 'darwin';
  const asarPath = isMac
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`,
                'Contents', 'Resources', 'app.asar')
    : path.join(context.appOutDir, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) throw new Error(`app.asar가 없다: ${asarPath}`);

  const deps = Object.keys(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).dependencies || {}
  );
  const packed = new Set(asar.listPackage(asarPath).map((p) => p.replace(/\\/g, '/')));
  const missing = deps.filter((d) => !packed.has(`/node_modules/${d}/package.json`));
  if (missing.length) {
    throw new Error(
      `app.asar에 의존성이 빠졌다: ${missing.join(', ')} — ` +
      `node_modules에 설치돼 있지 않았을 가능성이 크다. npm install 후 다시 빌드할 것 (${asarPath})`
    );
  }
  console.log(`  • 포장 검사 통과: ${deps.join(', ')} 모두 app.asar에 있음`);
}

const SIGNING_IDENTITY = 'Desktop Pet Signing';
function findSigningIdentity() {
  if (process.env.ADHOC_SIGN) return null; // 강제로 ad-hoc 서명하고 싶을 때
  try {
    const out = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    return out.includes(`"${SIGNING_IDENTITY}"`) ? SIGNING_IDENTITY : null;
  } catch {
    return null;
  }
}

exports.default = async function afterPack(context) {
  assertDepsPacked(context);
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  // 키체인에 "Desktop Pet Signing" 자체 서명 인증서가 있으면 그걸로 서명한다.
  // ad-hoc(-)은 신원이 빌드마다 바뀌는 cdhash라 업데이트마다 손쉬운 사용 권한이
  // 풀린다. 인증서로 서명하면 신원이 "번들 ID + 인증서"로 고정돼 권한이 유지된다.
  const identity = findSigningIdentity();
  // 인증서 없는 PC에서 조용히 ad-hoc으로 넘어가면 그대로 릴리즈돼 모든 사용자의 권한이
  // 풀린다 (v2.1.3~v2.2.1이 그렇게 나갔다). 일부러 ad-hoc으로 만들 때만 ADHOC_SIGN=1
  if (!identity && !process.env.ADHOC_SIGN) {
    throw new Error(
      `키체인에 "${SIGNING_IDENTITY}" 인증서가 없다 — 이대로 릴리즈하면 업데이트마다 손쉬운 사용 ` +
      '권한이 풀린다. 원래 PC에서 .p12로 내보내 로그인 키체인에 가져오고 코드 서명을 "항상 신뢰"로 ' +
      '둘 것. 배포하지 않을 빌드라면 ADHOC_SIGN=1로 실행'
    );
  }
  console.log(identity
    ? `  • 서명: ${identity} (업데이트해도 권한 유지)`
    : '  • 서명: ad-hoc — 업데이트마다 손쉬운 사용 권한이 풀린다 (README 개발자 가이드 참고)');
  execSync(`codesign --force --deep --sign "${identity || '-'}" "${appPath}"`, { stdio: 'inherit' });
  execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
};

exports.assertDepsPacked = assertDepsPacked;
