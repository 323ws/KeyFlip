/**
 * KeyFlip Extensions Builder
 * Assembles standalone unpacked Chrome and Firefox extensions from extensions/chrome
 * and extensions/firefox to dist/extensions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const chromeSrcDir = path.join(rootDir, 'extensions', 'chrome');
const firefoxSrcDir = path.join(rootDir, 'extensions', 'firefox');
const distDir = path.join(rootDir, 'dist', 'extensions');
const chromeOutDir = path.join(distDir, 'chrome');
const firefoxOutDir = path.join(distDir, 'firefox');

// 1. Ensure layouts bundles are compiled
console.log('[build-extensions] Ensuring layouts.js bundles are up-to-date...');
execSync(`node "${path.join(rootDir, 'scripts', 'build-layouts.js')}"`, { stdio: 'inherit' });

// 2. Prepare output directories
[chromeOutDir, firefoxOutDir].forEach(d => {
  if (fs.existsSync(d)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  fs.mkdirSync(d, { recursive: true });
});

// 3. Assemble Chrome extension
if (fs.existsSync(chromeSrcDir)) {
  fs.cpSync(chromeSrcDir, chromeOutDir, { recursive: true });
}
const licenseFile = path.join(rootDir, 'LICENSE');
if (fs.existsSync(licenseFile)) {
  fs.copyFileSync(licenseFile, path.join(chromeOutDir, 'LICENSE'));
}
console.log(`✅ [Chrome Unpacked]  -> ${chromeOutDir}`);

// 4. Assemble Firefox extension
if (fs.existsSync(firefoxSrcDir)) {
  fs.cpSync(firefoxSrcDir, firefoxOutDir, { recursive: true });
  if (fs.existsSync(licenseFile)) {
    fs.copyFileSync(licenseFile, path.join(firefoxOutDir, 'LICENSE'));
  }
}
console.log(`✅ [Firefox Unpacked] -> ${firefoxOutDir}`);

console.log('\nExtensions built successfully! Ready for "Load unpacked" in chrome://extensions or about:debugging.');
