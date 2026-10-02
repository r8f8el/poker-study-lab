/// <reference types="vite/client" />

export interface ElectronCaptureSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnail: string;
  appIcon?: string | null;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      getCaptureSources: () => Promise<ElectronCaptureSource[]>;
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
      toggleOverlayMode: (enable: boolean) => Promise<boolean>;
      minimize: () => Promise<void>;
      close: () => Promise<void>;
    };
  }
}

