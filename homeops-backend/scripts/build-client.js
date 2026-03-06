#!/usr/bin/env node
/**
 * Builds the frontend and copies its output to backend/public.
 * Run from backend root: node scripts/build-client.js
 *
 * Expects homeops-frontend as a sibling directory (../homeops-frontend).
 * For Railway: set FRONTEND_PATH or ensure frontend is available at ../homeops-frontend.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const frontendPath = process.env.FRONTEND_PATH || path.resolve(backendRoot, '../homeops-frontend');
const publicPath = path.join(backendRoot, 'public');

if (!fs.existsSync(frontendPath)) {
  console.error('Frontend not found at:', frontendPath);
  console.error('Set FRONTEND_PATH if the frontend is elsewhere.');
  process.exit(1);
}

console.log('Building frontend from', frontendPath);

// Ensure pnpm is available (Railway/Nixpacks may not have it pre-installed)
const pnpmCheck = spawnSync('pnpm', ['--version'], { shell: true, stdio: 'pipe' });
if (pnpmCheck.status !== 0) {
  console.log('pnpm not found, enabling via corepack...');
  const corepack = spawnSync('corepack', ['enable'], { stdio: 'inherit', shell: true });
  if (corepack.status !== 0) {
    console.log('corepack failed, installing pnpm via npm...');
    const npmInstall = spawnSync('npm', ['install', '-g', 'pnpm'], { stdio: 'inherit', shell: true });
    if (npmInstall.status !== 0) {
      console.error('Could not install pnpm');
      process.exit(1);
    }
  }
}

const install = spawnSync('pnpm', ['install'], {
  cwd: frontendPath,
  stdio: 'inherit',
  shell: true,
});
if (install.status !== 0) {
  console.error('Frontend install failed');
  process.exit(1);
}

// Build frontend (Vite outputs to dist/)
// Pass VITE_* vars so they're baked into the bundle at build time
const build = spawnSync('pnpm', ['run', 'build'], {
  cwd: frontendPath,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_BASE_URL: process.env.VITE_BASE_URL || '',
    VITE_GOOGLE_PLACES_API_KEY: process.env.VITE_GOOGLE_PLACES_API_KEY || '',
  },
});
if (build.status !== 0) {
  console.error('Frontend build failed');
  process.exit(1);
}

const distPath = path.join(frontendPath, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('Frontend build output not found at', distPath);
  process.exit(1);
}

// Remove existing public, then copy dist to public
if (fs.existsSync(publicPath)) {
  fs.rmSync(publicPath, { recursive: true });
}
fs.cpSync(distPath, publicPath, { recursive: true });

console.log('Frontend built and copied to backend/public');
console.log('Start the backend to serve the app from a single origin.');
