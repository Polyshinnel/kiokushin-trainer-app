export interface ElectronAPI {
  db: {
    query: <T>(channel: string, ...args: unknown[]) => Promise<T>
  }
  sync: {
    start: () => Promise<void>
    getStatus: () => Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

