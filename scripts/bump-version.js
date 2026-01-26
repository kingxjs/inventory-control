#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function usage() {
  console.log('Usage: node scripts/bump-version.js <version>');
  console.log('       node scripts/bump-version.js --patch|--minor|--major');
  process.exit(1);
}

function bumpSemver(version, part) {
  const m = version.split('.').map(Number);
  if (m.length !== 3 || m.some(isNaN)) throw new Error('invalid semver: ' + version);
  if (part === 'patch') m[2]++;
  if (part === 'minor') { m[1]++; m[2] = 0; }
  if (part === 'major') { m[0]++; m[1] = 0; m[2] = 0; }
  return m.join('.');
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

let newVersion = null;
if (args[0] === '--patch' || args[0] === '--minor' || args[0] === '--major') {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  newVersion = bumpSemver(pkg.version, args[0].replace('--', ''));
} else if (/^\d+\.\d+\.\d+$/.test(args[0])) {
  newVersion = args[0];
} else {
  usage();
}

console.log('Bumping version to', newVersion);

// 1) package.json
const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Updated package.json');

// 2) src-tauri/tauri.conf.json
const tauriPath = path.resolve('src-tauri/tauri.conf.json');
if (fs.existsSync(tauriPath)) {
  const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
  tauri.version = newVersion;
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n', 'utf8');
  console.log('Updated src-tauri/tauri.conf.json');
} else {
  console.warn('src-tauri/tauri.conf.json not found, skipped');
}

// 3) src-tauri/Cargo.toml
const cargoPath = path.resolve('src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
  const content = fs.readFileSync(cargoPath, 'utf8');
  const lines = content.split(/\r?\n/);
  let inPackage = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '[package]') inPackage = true;
    else if (line.startsWith('[') && line !== '[package]') inPackage = false;
    if (inPackage && /^version\s*=/.test(lines[i])) {
      lines[i] = `version = "${newVersion}"`;
      break;
    }
  }
  fs.writeFileSync(cargoPath, lines.join('\n') + '\n', 'utf8');
  console.log('Updated src-tauri/Cargo.toml');
} else {
  console.warn('src-tauri/Cargo.toml not found, skipped');
}

console.log('Done.');
