import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type {
  Course,
  ExportNotesPayload,
  ImportConfirmPayload,
  PlaymachineDB,
} from '../shared/types';
import { convertSrtToVtt } from '../shared/subtitles';
import { LocalStore } from './store';
import { scanDirectoryAsCourse, scanFolderForPreview, stableId } from './scanner';
import { probeDurationsBatch } from './ffprobe';

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'course-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let store: LocalStore;

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.vtt': 'text/vtt; charset=utf-8',
};

function registerMediaProtocol(): void {
  protocol.handle('course-media', async (request) => {
    try {
      const url = new URL(request.url);
      const encoded = url.pathname.replace(/^\/+/, '');
      const filePath = Buffer.from(encoded, 'base64url').toString('utf8');

      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Media file not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return new Response('Not a file', { status: 400 });
      }

      const fileSize = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (!match) {
          return new Response('Invalid Range', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;

        if (start >= fileSize || start > end) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store',
          },
        });
      }

      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('[course-media] Error streaming local media:', err);
      return new Response('Internal Media Error', { status: 500 });
    }
  });
}

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send('menu:action', action);
}

function buildMacMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'Cmd+,',
                click: () => sendMenuAction('open-settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Course Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('import-folder'),
        },
        {
          label: 'Quick Jump…',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendMenuAction('open-command-palette'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Course Library',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenuAction('nav-library'),
        },
        {
          label: 'Notes & Bookmarks Hub',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenuAction('nav-notes'),
        },
        {
          label: 'Study Activity',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendMenuAction('nav-activity'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Focus / Theater Mode',
          accelerator: 'CmdOrCtrl+\\',
          click: () => sendMenuAction('toggle-focus'),
        },
        {
          label: 'Toggle Ivory / Ink Theme',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => sendMenuAction('toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const db = store.load();
  const isInk = db.settings.theme === 'ink';

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: isInk ? '#022435' : '#fcf8eb',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 12 } : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('db:get', () => store.load());

  ipcMain.handle('db:save', (_event, db: PlaymachineDB) => {
    store.save(db);
    return { ok: true };
  });

  ipcMain.handle('dialog:pickFolder', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'Select Course or Video Collection Folder',
      buttonLabel: 'Scan Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('course:scanFolder', (_event, folderPath: string) => {
    return scanFolderForPreview(folderPath);
  });

  ipcMain.handle('course:import', (_event, payload: ImportConfirmPayload) => {
    const db = store.load();
    const now = new Date().toISOString();

    for (const item of payload.courses) {
      const existingIdx = db.courses.findIndex((c) => c.folderPath === item.folderPath);
      const existing = existingIdx >= 0 ? db.courses[existingIdx] : undefined;
      const scanned = scanDirectoryAsCourse(item.folderPath, existing);
      if (!scanned) continue;

      const course: Course = existing
        ? {
            ...existing,
            title: item.title.trim() || scanned.title,
            generatedTitle: scanned.generatedTitle,
            accent: item.accent,
            coverPath: scanned.coverPath ?? existing.coverPath,
            tags: item.tags.length > 0 ? item.tags : existing.tags,
            sections: scanned.sections,
            resources: scanned.resources,
          }
        : {
            id: stableId('crs', item.folderPath),
            title: item.title.trim() || scanned.title,
            generatedTitle: scanned.generatedTitle,
            folderPath: item.folderPath,
            accent: item.accent,
            coverPath: scanned.coverPath,
            description: '',
            tags: item.tags,
            pinned: false,
            createdAt: now,
            lastLessonId: scanned.sections[0]?.lessons[0]?.id,
            sections: scanned.sections,
            resources: scanned.resources,
            goals: [],
          };

      if (existingIdx >= 0) {
        db.courses[existingIdx] = course;
      } else {
        db.courses.unshift(course);
      }
    }

    store.save(db);
    return db;
  });

  ipcMain.handle('course:rescan', (_event, courseId: string) => {
    const db = store.load();
    const idx = db.courses.findIndex((c) => c.id === courseId);
    if (idx < 0) return db;

    const existing = db.courses[idx];
    const scanned = scanDirectoryAsCourse(existing.folderPath, existing);
    if (!scanned) return db;

    db.courses[idx] = {
      ...existing,
      generatedTitle: scanned.generatedTitle,
      coverPath: scanned.coverPath ?? existing.coverPath,
      sections: scanned.sections,
      resources: scanned.resources,
    };

    store.save(db);
    return db;
  });

  ipcMain.handle(
    'media:probeDurations',
    async (_event, courseId: string, filePaths: string[]) => {
      const durations = await probeDurationsBatch(filePaths, 4);
      if (Object.keys(durations).length > 0) {
        const db = store.load();
        const course = db.courses.find((c) => c.id === courseId);
        if (course) {
          let dirty = false;
          for (const sec of course.sections) {
            for (const les of sec.lessons) {
              const d = durations[les.filePath];
              if (d && d > 0 && les.duration !== d) {
                les.duration = d;
                dirty = true;
              }
            }
          }
          if (dirty) {
            store.save(db);
          }
        }
      }
      return durations;
    },
  );

  ipcMain.handle('media:getSubtitleVtt', (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf8');
    if (filePath.toLowerCase().endsWith('.vtt')) {
      return raw;
    }
    return convertSrtToVtt(raw);
  });

  ipcMain.handle('shell:reveal', (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    }
  });

  ipcMain.handle('export:markdown', async (_event, payload: ExportNotesPayload) => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win ?? undefined!, {
      title: 'Export Course Notes',
      defaultPath: payload.defaultFileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (res.canceled || !res.filePath) return { savedPath: null };
    fs.writeFileSync(res.filePath, payload.markdown, 'utf8');
    return { savedPath: res.filePath };
  });

  ipcMain.handle('backup:export', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog(win ?? undefined!, {
      title: 'Export Playmachine Library Backup',
      defaultPath: `playmachine-backup-${dateStamp}.json`,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return { savedPath: null };
    fs.writeFileSync(res.filePath, JSON.stringify(store.load(), null, 2), 'utf8');
    return { savedPath: res.filePath };
  });

  ipcMain.handle('backup:import', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'Import Playmachine Library Backup',
      properties: ['openFile'],
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const raw = fs.readFileSync(res.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw) as PlaymachineDB;
    if (!parsed || !Array.isArray(parsed.courses)) {
      throw new Error('Invalid Playmachine backup file.');
    }
    store.save(parsed);
    return store.load();
  });
}

app.setName('Playmachine');

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../build/icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock?.setIcon(iconPath);
    }
  }
  store = new LocalStore(app.getPath('userData'));
  registerMediaProtocol();
  registerIpcHandlers();
  buildMacMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
