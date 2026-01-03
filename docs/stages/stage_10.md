# Этап 10: Финализация

**Срок: 1-2 дня**

---

## Цель этапа

Провести тестирование, обработать ошибки, оптимизировать производительность и создать production-сборку с инсталлятором.

---

## Шаги выполнения

### 10.1 Глобальная обработка ошибок

**Файл `src/components/ErrorBoundary.tsx`:**
```typescript
import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Произошла ошибка</h1>
            <p className="text-slate-600 mb-4">
              Что-то пошло не так. Попробуйте перезагрузить приложение.
            </p>
            <pre className="text-xs text-left bg-slate-100 p-3 rounded mb-4 overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <Button onClick={this.handleReload}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Перезагрузить
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Обновить `src/App.tsx`:**
```typescript
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        {/* ... rest of the app */}
      </HashRouter>
    </ErrorBoundary>
  )
}
```

### 10.2 Создание компонента загрузки

**Файл `src/components/shared/LoadingScreen.tsx`:**
```typescript
import { Loader2 } from 'lucide-react'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = 'Загрузка...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  )
}
```

### 10.3 Создание пустых состояний

**Файл `src/components/shared/EmptyState.tsx`:**
```typescript
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Icon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-500 mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

### 10.4 Оптимизация базы данных

**Добавить в `electron/database/index.ts`:**
```typescript
export function optimizeDatabase(): void {
  const db = getDatabase()
  
  db.pragma('optimize')
  
  db.exec('VACUUM')
  
  db.exec('ANALYZE')
}

export function getDatabaseStats(): {
  size: number
  tables: { name: string; rows: number }[]
} {
  const db = getDatabase()
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[]
  
  const tableStats = tables.map(t => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as { count: number }
    return { name: t.name, rows: count.count }
  })
  
  return {
    size: 0,
    tables: tableStats
  }
}
```

### 10.5 Добавление иконки приложения

Создайте файлы иконок:
- `public/icon.ico` (256x256 для Windows)
- `public/icon.png` (512x512 для общего использования)

### 10.6 Настройка production сборки

**Обновить `electron-builder.json`:**
```json
{
  "appId": "com.trainschedule.app",
  "productName": "Train Schedule",
  "copyright": "Copyright © 2024",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "!node_modules/**/*"
  ],
  "extraResources": [
    {
      "from": "resources/",
      "to": "resources/"
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "public/icon.ico",
    "artifactName": "${productName}-Setup-${version}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "public/icon.ico",
    "uninstallerIcon": "public/icon.ico",
    "installerHeaderIcon": "public/icon.ico",
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Train Schedule"
  },
  "mac": {
    "target": ["dmg"],
    "icon": "public/icon.png",
    "category": "public.app-category.productivity"
  },
  "linux": {
    "target": ["AppImage"],
    "icon": "public/icon.png",
    "category": "Office"
  }
}
```

### 10.7 Обновление package.json для сборки

```json
{
  "name": "train-schedule",
  "version": "1.0.0",
  "description": "Приложение для управления тренировками",
  "main": "dist-electron/main.js",
  "author": "Your Name",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "vite",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux",
    "rebuild": "electron-rebuild",
    "lint": "eslint src --ext ts,tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

### 10.8 Чек-лист тестирования

**Модуль "Сотрудники":**
- [ ] Просмотр списка
- [ ] Добавление нового сотрудника
- [ ] Редактирование сотрудника
- [ ] Удаление с подтверждением
- [ ] Валидация обязательных полей

**Модуль "Клиенты":**
- [ ] Просмотр списка
- [ ] Поиск по ФИО и телефону
- [ ] Добавление клиента с родителями
- [ ] Редактирование клиента
- [ ] Отметка оплаты
- [ ] Удаление с подтверждением
- [ ] Отображение индикатора долга

**Модуль "Группы":**
- [ ] Просмотр списка карточек
- [ ] Создание группы
- [ ] Назначение тренера
- [ ] Добавление расписания
- [ ] Удаление расписания
- [ ] Добавление участников
- [ ] Удаление участников
- [ ] Переход на детальную страницу

**Модуль "Занятия":**
- [ ] Просмотр списка
- [ ] Фильтрация по группе
- [ ] Фильтрация по датам
- [ ] Генерация занятий по расписанию
- [ ] Отметка посещаемости
- [ ] Смена статуса посещаемости
- [ ] Удаление занятия

**Главная страница:**
- [ ] Отображение статистики
- [ ] Список занятий на сегодня
- [ ] Подсветка текущего занятия
- [ ] Список должников
- [ ] Быстрая отметка оплаты
- [ ] Быстрые действия

**Синхронизация:**
- [ ] Кнопка синхронизации в Header
- [ ] Индикатор статуса
- [ ] Счётчик pending изменений
- [ ] Страница настроек

**Общее:**
- [ ] Навигация между страницами
- [ ] Toast-уведомления
- [ ] Обработка ошибок
- [ ] Работа офлайн
- [ ] Сохранение данных после перезапуска

### 10.9 Сборка production-версии

```bash
# Установка зависимостей
npm install

# Пересборка нативных модулей
npm run rebuild

# Сборка для Windows
npm run electron:build:win
```

После сборки инсталлятор будет в папке `release/`.

### 10.10 Финальная структура проекта

```
train-schedule/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── database/
│   │   ├── index.ts
│   │   ├── migrations.ts
│   │   └── queries/
│   │       ├── employees.ts
│   │       ├── clients.ts
│   │       ├── groups.ts
│   │       └── lessons.ts
│   └── sync/
│       ├── config.ts
│       └── syncService.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── shared/
│   │   │   ├── DeleteConfirmDialog.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingScreen.tsx
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── clients/
│   │   ├── groups/
│   │   └── lessons/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Clients.tsx
│   │   ├── Groups.tsx
│   │   ├── GroupDetail.tsx
│   │   ├── Lessons.tsx
│   │   ├── Employees.tsx
│   │   └── Settings.tsx
│   ├── stores/
│   │   ├── employeesStore.ts
│   │   ├── clientsStore.ts
│   │   ├── groupsStore.ts
│   │   ├── lessonsStore.ts
│   │   └── syncStore.ts
│   ├── hooks/
│   ├── lib/
│   │   ├── utils.ts
│   │   └── api.ts
│   └── types/
│       └── index.ts
├── public/
│   ├── icon.ico
│   └── icon.png
├── package.json
├── vite.config.ts
├── electron-builder.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## Проверка успешности этапа

- [ ] Все модули работают без ошибок
- [ ] Данные сохраняются между сессиями
- [ ] Приложение работает офлайн
- [ ] Error Boundary ловит ошибки
- [ ] Production сборка создаётся
- [ ] Инсталлятор работает на Windows
- [ ] Приложение запускается после установки

---

## Результат этапа

Готовое production-приложение:
- Полная функциональность всех модулей
- Обработка ошибок
- Оптимизированная база данных
- Инсталлятор для Windows
- Документация

---

## Итоговый результат проекта

Полнофункциональное десктопное приложение "Train Schedule" для управления:
- Сотрудниками спортивного клуба
- Клиентами и их родителями
- Группами с расписанием
- Занятиями и посещаемостью
- Оплатами и должниками

Технические особенности:
- Electron + React + TypeScript
- Tailwind CSS + ShadCN/UI
- SQLite для локального хранения
- Офлайн-first архитектура
- Синхронизация с сервером по запросу

