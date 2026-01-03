export interface ElectronAPI {
  db: {
    query: <T>(channel: string, ...args: unknown[]) => Promise<T>
  }
  auth: {
    login: (login: string, password: string) => Promise<any>
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

