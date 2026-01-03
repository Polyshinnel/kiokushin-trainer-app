# Этап 1: Инициализация проекта

**Срок: 1-2 дня**

---

## Цель этапа

Создать базовую структуру Electron-приложения с React, TypeScript, Vite и настроить все необходимые инструменты.

---

## Шаги выполнения

### 1.1 Создание проекта

```bash
# Создание проекта с помощью Vite
npm create vite@latest . -- --template react-ts


# Установка зависимостей
npm install
```

### 1.2 Установка Electron

```bash
# Основные пакеты Electron
npm install -D electron electron-builder

# Плагин для интеграции Vite и Electron
npm install -D vite-plugin-electron vite-plugin-electron-renderer
```

### 1.3 Установка Tailwind CSS

```bash
# Tailwind и его зависимости
npm install -D tailwindcss postcss autoprefixer

# Инициализация конфигурации
npx tailwindcss init -p
```

**Файл `tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

**Добавить в `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 1.4 Установка и настройка ShadCN/UI

```bash
# Установка CLI
npx shadcn@latest init

# Установка базовых компонентов
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add form
npx shadcn@latest add toast
npx shadcn@latest add alert-dialog
npx shadcn@latest add popover
npx shadcn@latest add calendar
npx shadcn@latest add badge
```

### 1.5 Установка better-sqlite3

```bash
# SQLite для Electron
npm install better-sqlite3
npm install -D @types/better-sqlite3

# Пересборка нативного модуля для Electron
npm install -D electron-rebuild
npx electron-rebuild
```

### 1.6 Дополнительные зависимости

```bash
# Zustand для стейт-менеджмента
npm install zustand

# React Router для навигации
npm install react-router-dom

# Утилиты для работы с датами
npm install date-fns

# Дополнительные утилиты
npm install clsx tailwind-merge class-variance-authority lucide-react
npm install tailwindcss-animate
npm install @radix-ui/react-icons
```

### 1.7 Создание структуры папок

```
train-schedule/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── database/
│       ├── index.ts
│       ├── migrations.ts
│       └── queries/
│           ├── employees.ts
│           ├── clients.ts
│           ├── groups.ts
│           ├── lessons.ts
│           └── attendance.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── groups/
│   │   ├── lessons/
│   │   └── employees/
│   ├── pages/
│   ├── stores/
│   ├── hooks/
│   ├── lib/
│   │   ├── utils.ts
│   │   └── sync.ts
│   └── types/
│       └── index.ts
├── package.json
├── vite.config.ts
├── electron-builder.json
├── tailwind.config.js
├── tsconfig.json
└── tsconfig.node.json
```

### 1.8 Настройка Vite для Electron

**Файл `vite.config.ts`:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### 1.9 Создание main.ts для Electron

**Файл `electron/main.ts`:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

### 1.10 Создание preload.ts

**Файл `electron/preload.ts`:**
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    query: (channel: string, ...args: unknown[]) => 
      ipcRenderer.invoke(`db:${channel}`, ...args),
  },
  
  // Sync operations
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    getStatus: () => ipcRenderer.invoke('sync:status'),
  }
})
```

### 1.11 Настройка electron-builder

**Файл `electron-builder.json`:**
```json
{
  "appId": "com.trainschedule.app",
  "productName": "Train Schedule",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  "win": {
    "target": ["nsis"],
    "icon": "public/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "public/icon.ico",
    "uninstallerIcon": "public/icon.ico",
    "installerHeaderIcon": "public/icon.ico"
  }
}
```

### 1.12 Обновление package.json

```json
{
  "name": "train-schedule",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "vite",
    "electron:build": "npm run build && electron-builder",
    "rebuild": "electron-rebuild"
  }
}
```

### 1.13 Создание типов для Electron API

**Файл `src/types/electron.d.ts`:**
```typescript
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
```

---

## Проверка успешности этапа

- [ ] Проект запускается командой `npm run dev`
- [ ] Electron окно открывается
- [ ] Tailwind CSS стили работают
- [ ] ShadCN компоненты отображаются корректно
- [ ] Нет ошибок в консоли
- [ ] Структура папок создана

---

## Возможные проблемы и решения

### Проблема: better-sqlite3 не компилируется
**Решение:** Убедитесь, что установлены build tools для Windows:
```bash
npm install --global windows-build-tools
```

### Проблема: Electron не находит preload
**Решение:** Проверьте путь в main.ts и убедитесь, что preload.js находится в dist-electron.

### Проблема: Ошибки TypeScript
**Решение:** Проверьте tsconfig.json и добавьте необходимые типы.

---

## Результат этапа

После завершения этапа у вас будет работающий каркас Electron-приложения с:
- React + TypeScript
- Tailwind CSS
- ShadCN/UI компоненты
- Подготовленная структура для SQLite
- Настроенная сборка

