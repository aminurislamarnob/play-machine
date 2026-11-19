import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const viteUrl = 'http://localhost:5173';

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

// 1. Initial electron build
await new Promise((resolve, reject) => {
  const buildProc = spawn(process.execPath, ['scripts/build-electron.mjs'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  buildProc.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`build-electron failed with ${code}`)),
  );
});

// 2. Start Vite dev server
const viteProc = spawn('npx', ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

// 3. Watch Electron files
const watchProc = spawn(process.execPath, ['scripts/build-electron.mjs', '--watch'], {
  cwd: rootDir,
  stdio: 'inherit',
});

await waitForServer(viteUrl);

// 4. Launch Electron
const electronBin = path.join(rootDir, 'node_modules/.bin/electron');
const electronProc = spawn(electronBin, ['.'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: viteUrl,
  },
});

const cleanup = () => {
  viteProc.kill();
  watchProc.kill();
  electronProc.kill();
};

electronProc.on('exit', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
