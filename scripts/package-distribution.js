/**
 * KeyFlip Distribution Packager
 * Packages:
 * 1. KeyFlip-Portable.exe (Standalone Windows executable)
 * 2. KeyFlip-Setup.exe (NSIS Installer)
 * 3. keyflip-chrome-v1.1.1.zip (Chrome Web Store package)
 * 4. keyflip-firefox-v1.1.1.zip (Firefox Add-ons package)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DESKTOP_DIR = path.join(process.env.USERPROFILE || 'C:\\Users\\UserA', 'Desktop');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getFileSizeMB(filePath) {
  const bytes = fs.statSync(filePath).size;
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB (' + bytes.toLocaleString() + ' bytes)';
}

console.log('==============================================');
console.log('        KEYFLIP DISTRIBUTION PACKAGER        ');
console.log('==============================================\n');

const artifacts = [];

// 1. Portable Binary
const releaseExe = path.join(ROOT_DIR, 'desktop', 'src-tauri', 'target', 'release', 'keyflip.exe');
const portableTarget = path.join(DIST_DIR, 'KeyFlip-Portable.exe');
const userDesktopPortable = path.join(DESKTOP_DIR, 'KeyFlip-Portable.exe');

if (fs.existsSync(releaseExe)) {
  fs.copyFileSync(releaseExe, portableTarget);
  fs.copyFileSync(releaseExe, userDesktopPortable);
  artifacts.push({
    name: 'KeyFlip-Portable.exe',
    path: portableTarget,
    desktopCopy: userDesktopPortable,
    size: getFileSizeMB(portableTarget),
    sha256: sha256File(portableTarget),
    desc: 'Standalone Windows executable (Zero install, no admin rights required)'
  });
  console.log(`[OK] Portable binary copied to dist/ and Desktop`);
} else {
  console.warn(`[WARN] Release binary not found at ${releaseExe}`);
}

// 2. Setup Installer
const setupCandidates = [
  path.join(ROOT_DIR, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'nsis', 'KeyFlip_1.1.1_x64-setup.exe'),
  path.join(ROOT_DIR, 'KeyFlip-Setup.exe'),
  path.join(DESKTOP_DIR, 'KeyFlip-Setup.exe')
];

let foundSetup = null;
for (const cand of setupCandidates) {
  if (fs.existsSync(cand)) {
    foundSetup = cand;
    break;
  }
}

if (foundSetup) {
  const setupTarget = path.join(DIST_DIR, 'KeyFlip-Setup.exe');
  fs.copyFileSync(foundSetup, setupTarget);
  // Ensure it's on the desktop too
  const userDesktopSetup = path.join(DESKTOP_DIR, 'KeyFlip-Setup.exe');
  if (!fs.existsSync(userDesktopSetup) || fs.statSync(foundSetup).size !== fs.statSync(userDesktopSetup).size) {
    fs.copyFileSync(foundSetup, userDesktopSetup);
  }
  artifacts.push({
    name: 'KeyFlip-Setup.exe',
    path: setupTarget,
    desktopCopy: userDesktopSetup,
    size: getFileSizeMB(setupTarget),
    sha256: sha256File(setupTarget),
    desc: 'NSIS Windows Installer (Per-user install, optional auto-start, uninstaller)'
  });
  console.log(`[OK] Setup installer copied to dist/ and Desktop`);
} else {
  console.warn(`[WARN] Setup installer not found.`);
}

function createZipArchive(sourceDir, destinationZip) {
  if (fs.existsSync(destinationZip)) fs.unlinkSync(destinationZip);
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${destinationZip}' -Force"`);
  } else {
    execSync(`cd "${sourceDir}" && zip -r -q "${destinationZip}" .`);
  }
}

// 3. Chrome Extension Zip
const chromeZip = path.join(DIST_DIR, 'keyflip-chrome-v1.1.1.zip');
try {
  const chromeTempDir = path.join(DIST_DIR, '_temp_chrome');
  if (fs.existsSync(chromeTempDir)) fs.rmSync(chromeTempDir, { recursive: true, force: true });
  fs.mkdirSync(chromeTempDir, { recursive: true });

  const chromeExtDir = path.join(ROOT_DIR, 'extensions', 'chrome');
  if (fs.existsSync(chromeExtDir)) {
    fs.cpSync(chromeExtDir, chromeTempDir, { recursive: true });
  }

  const licenseSrc = path.join(ROOT_DIR, 'LICENSE');
  if (fs.existsSync(licenseSrc)) {
    fs.copyFileSync(licenseSrc, path.join(chromeTempDir, 'LICENSE'));
  }

  createZipArchive(chromeTempDir, chromeZip);
  fs.rmSync(chromeTempDir, { recursive: true, force: true });

  artifacts.push({
    name: 'keyflip-chrome-v1.1.1.zip',
    path: chromeZip,
    size: getFileSizeMB(chromeZip),
    sha256: sha256File(chromeZip),
    desc: 'Chrome / Chromium Extension bundle (Manifest V3)'
  });
  console.log(`[OK] Chrome extension packaged to ${chromeZip}`);
} catch (err) {
  console.error(`[ERROR] Failed to package Chrome extension: ${err.message}`);
}

// 4. Firefox Extension Zip
const firefoxZip = path.join(DIST_DIR, 'keyflip-firefox-v1.1.1.zip');
try {
  const firefoxTempDir = path.join(DIST_DIR, '_temp_firefox');
  if (fs.existsSync(firefoxTempDir)) fs.rmSync(firefoxTempDir, { recursive: true, force: true });
  fs.mkdirSync(firefoxTempDir, { recursive: true });

  const firefoxExtDir = path.join(ROOT_DIR, 'extensions', 'firefox');
  if (fs.existsSync(firefoxExtDir)) {
    fs.cpSync(firefoxExtDir, firefoxTempDir, { recursive: true });
  }

  const licenseSrc = path.join(ROOT_DIR, 'LICENSE');
  if (fs.existsSync(licenseSrc)) {
    fs.copyFileSync(licenseSrc, path.join(firefoxTempDir, 'LICENSE'));
  }

  createZipArchive(firefoxTempDir, firefoxZip);
  fs.rmSync(firefoxTempDir, { recursive: true, force: true });

  artifacts.push({
    name: 'keyflip-firefox-v1.1.1.zip',
    path: firefoxZip,
    size: getFileSizeMB(firefoxZip),
    sha256: sha256File(firefoxZip),
    desc: 'Firefox Add-on bundle'
  });
  console.log(`[OK] Firefox extension packaged to ${firefoxZip}`);
} catch (err) {
  console.error(`[ERROR] Failed to package Firefox extension: ${err.message}`);
}

console.log('\n==============================================');
console.log('             DISTRIBUTION SUMMARY            ');
console.log('==============================================\n');

for (const a of artifacts) {
  console.log(`Artifact: ${a.name}`);
  console.log(`  Description: ${a.desc}`);
  console.log(`  Path:        ${a.path}`);
  if (a.desktopCopy) console.log(`  Desktop:     ${a.desktopCopy}`);
  console.log(`  Size:        ${a.size}`);
  console.log(`  SHA-256:     ${a.sha256}\n`);
}
