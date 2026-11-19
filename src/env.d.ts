/// <reference types="vite/client" />
import type { PlaymachineAPI } from '@shared/types';

declare global {
  interface Window {
    playmachine: PlaymachineAPI;
  }
}

export {};
