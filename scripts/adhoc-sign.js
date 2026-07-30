// 패키징 후 ad-hoc 서명 — 서명이 아예 깨진 채 배포되면 macOS가
// "손상되어 열 수 없다"며 실행을 거부한다. ad-hoc이라도 일관된 서명을 입힌다.
const { execSync } = require('child_process');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
};
