import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ExportNotesPayload,
  ImportConfirmPayload,
  PlaymachineAPI,
  PlaymachineDB,
} from '../shared/types';

function encodeMediaUrl(filePath: string): string {
  const encoded = Buffer.from(filePath, 'utf8').toString('base64url');
  return `course-media://local/${encoded}`;
}

const api: PlaymachineAPI = {
  getDB: () => ipcRenderer.invoke('db:get'),
  saveDB: (db: PlaymachineDB) => ipcRenderer.invoke('db:save', db),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('course:scanFolder', folderPath),
  importCourses: (payload: ImportConfirmPayload) =>
    ipcRenderer.invoke('course:import', payload),
  rescanCourse: (courseId: string) => ipcRenderer.invoke('course:rescan', courseId),
  probeDurations: (courseId: string, filePaths: string[]) =>
    ipcRenderer.invoke('media:probeDurations', courseId, filePaths),
  getSubtitleVtt: (filePath: string) => ipcRenderer.invoke('media:getSubtitleVtt', filePath),
  getMediaUrl: encodeMediaUrl,
  revealInFinder: (filePath: string) => ipcRenderer.invoke('shell:reveal', filePath),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
  exportMarkdown: (payload: ExportNotesPayload) =>
    ipcRenderer.invoke('export:markdown', payload),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return (file as unknown as { path?: string }).path ?? '';
    }
  },
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('menu:action', handler);
    return () => ipcRenderer.removeListener('menu:action', handler);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('playmachine', api);
