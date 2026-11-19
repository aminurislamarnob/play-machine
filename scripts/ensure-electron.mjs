import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.resolve(__dirname, '../node_modules/electron');
const pathTxt = path.join(electronDir, 'path.txt');

if (!fs.existsSync(electronDir) || fs.existsSync(pathTxt)) {
  process.exit(0);
}

const platformPath =
  process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : process.platform === 'win32'
      ? 'electron.exe'
      : 'electron';

const binaryPath = path.join(electronDir, 'dist', platformPath);
if (fs.existsSync(binaryPath)) {
  fs.writeFileSync(pathTxt, platformPath, 'utf8');
  console.log('[postinstall] Repaired node_modules/electron/path.txt');
}
