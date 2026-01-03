# Этап 3: Базовый UI и навигация

**Срок: 1-2 дня**

---

## Цель этапа

Создать основной layout приложения с боковой панелью, header'ом и настроить маршрутизацию между страницами.

---

## Шаги выполнения

### 3.1 Установка React Router

```bash
npm install react-router-dom
```

### 3.2 Создание типов

**Файл `src/types/index.ts`:**
```typescript
// Entities
export interface Employee {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface Client {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  last_payment_date: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface ClientParent {
  id: number
  client_id: number
  full_name: string
  phone: string | null
}

export interface Group {
  id: number
  name: string
  start_date: string | null
  trainer_id: number | null
  trainer_name?: string
  member_count?: number
  created_at: string
  updated_at: string
  sync_status: string
}

export interface GroupSchedule {
  id: number
  group_id: number
  day_of_week: number
  start_time: string
  end_time: string
}

export interface GroupMember {
  id: number
  group_id: number
  client_id: number
  joined_at: string
  client?: Client
}

export interface Lesson {
  id: number
  group_id: number
  group_name?: string
  trainer_name?: string
  lesson_date: string
  start_time: string
  end_time: string
  attendance_count?: number
  total_members?: number
  created_at: string
  sync_status: string
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | null

export interface Attendance {
  id: number
  lesson_id: number
  client_id: number
  client_name?: string
  client_phone?: string
  status: AttendanceStatus
  updated_at: string
}

// Navigation
export interface NavItem {
  title: string
  path: string
  icon: React.ReactNode
}
```

### 3.3 Создание Sidebar компонента

**Файл `src/components/layout/Sidebar.tsx`:**
```typescript
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Calendar,
  UserCog,
  Settings
} from 'lucide-react'

const navItems = [
  { title: 'Главная', path: '/', icon: LayoutDashboard },
  { title: 'Клиенты', path: '/clients', icon: Users },
  { title: 'Группы', path: '/groups', icon: UsersRound },
  { title: 'Занятия', path: '/lessons', icon: Calendar },
  { title: 'Сотрудники', path: '/employees', icon: UserCog },
]

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight">
          Train Schedule
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Управление тренировками
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    'hover:bg-slate-800',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-300'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              'hover:bg-slate-800',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-300'
            )
          }
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Настройки</span>
        </NavLink>
      </div>
    </aside>
  )
}
```

### 3.4 Создание Header компонента

**Файл `src/components/layout/Header.tsx`:**
```typescript
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await window.electronAPI.sync.start()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-green-600">Онлайн</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Офлайн</span>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !isOnline}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
        </Button>
      </div>
    </header>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
```

### 3.5 Создание MainLayout компонента

**Файл `src/components/layout/MainLayout.tsx`:**
```typescript
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function MainLayout() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

### 3.6 Создание страниц-заглушек

**Файл `src/pages/Dashboard.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Dashboard() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Главная" subtitle="Обзор тренировок и клиентов" />
      
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder cards */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Тренировки сегодня
            </h3>
            <p className="text-3xl font-bold text-primary">0</p>
            <p className="text-sm text-slate-500 mt-1">Нет запланированных</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Активные клиенты
            </h3>
            <p className="text-3xl font-bold text-primary">0</p>
            <p className="text-sm text-slate-500 mt-1">В этом месяце</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Должники
            </h3>
            <p className="text-3xl font-bold text-red-500">0</p>
            <p className="text-sm text-slate-500 mt-1">Требуется оплата</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">
              Расписание на сегодня
            </h3>
            <p className="text-slate-500">Нет занятий на сегодня</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">
              Список должников
            </h3>
            <p className="text-slate-500">Нет должников</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Файл `src/pages/Clients.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Clients() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Клиенты" subtitle="Управление клиентами клуба" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница клиентов в разработке...</p>
        </div>
      </div>
    </div>
  )
}
```

**Файл `src/pages/Groups.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Groups() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Группы" subtitle="Управление группами и расписанием" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница групп в разработке...</p>
        </div>
      </div>
    </div>
  )
}
```

**Файл `src/pages/Lessons.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Lessons() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Занятия" subtitle="Календарь занятий и посещаемость" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница занятий в разработке...</p>
        </div>
      </div>
    </div>
  )
}
```

**Файл `src/pages/Employees.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Employees() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Сотрудники" subtitle="Управление сотрудниками клуба" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница сотрудников в разработке...</p>
        </div>
      </div>
    </div>
  )
}
```

**Файл `src/pages/Settings.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'

export function Settings() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Настройки" subtitle="Настройки приложения" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница настроек в разработке...</p>
        </div>
      </div>
    </div>
  )
}
```

### 3.7 Настройка маршрутизации

**Файл `src/App.tsx`:**
```typescript
import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { Dashboard } from './pages/Dashboard'
import { Clients } from './pages/Clients'
import { Groups } from './pages/Groups'
import { Lessons } from './pages/Lessons'
import { Employees } from './pages/Employees'
import { Settings } from './pages/Settings'
import { Toaster } from './components/ui/toaster'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="groups" element={<Groups />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="employees" element={<Employees />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  )
}
```

### 3.8 Создание утилит

**Файл `src/lib/utils.ts`:**
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
  return days[dayOfWeek]
}

export function getDayShortName(dayOfWeek: number): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  return days[dayOfWeek]
}

export function getAttendanceStatusText(status: string | null): string {
  switch (status) {
    case 'present': return 'Был'
    case 'absent': return 'Отсутствовал'
    case 'sick': return 'Болеет'
    default: return 'Не отмечен'
  }
}

export function getAttendanceStatusColor(status: string | null): string {
  switch (status) {
    case 'present': return 'bg-green-100 text-green-800'
    case 'absent': return 'bg-red-100 text-red-800'
    case 'sick': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export function calculateAge(birthYear: number | null): string {
  if (!birthYear) return '—'
  const currentYear = new Date().getFullYear()
  return `${currentYear - birthYear} лет`
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  return phone
}
```

### 3.9 Обновление main.tsx

**Файл `src/main.tsx`:**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 3.10 Экспорт layout компонентов

**Файл `src/components/layout/index.ts`:**
```typescript
export { Sidebar } from './Sidebar'
export { Header } from './Header'
export { MainLayout } from './MainLayout'
```

### 3.11 Экспорт страниц

**Файл `src/pages/index.ts`:**
```typescript
export { Dashboard } from './Dashboard'
export { Clients } from './Clients'
export { Groups } from './Groups'
export { Lessons } from './Lessons'
export { Employees } from './Employees'
export { Settings } from './Settings'
```

---

## Проверка успешности этапа

- [ ] Приложение запускается без ошибок
- [ ] Sidebar отображается слева
- [ ] Навигация между страницами работает
- [ ] Активный пункт меню подсвечивается
- [ ] Header отображает правильные заголовки
- [ ] Toaster настроен для уведомлений
- [ ] Layout адаптивный и заполняет экран

---

## Дизайн-система

### Цветовая палитра
- **Primary**: Синий (#3b82f6)
- **Background**: Светло-серый (#f1f5f9)
- **Sidebar**: Тёмно-синий (#0f172a)
- **Cards**: Белый (#ffffff)
- **Success**: Зелёный (#22c55e)
- **Warning**: Жёлтый (#eab308)
- **Danger**: Красный (#ef4444)

### Типографика
- Заголовки: font-semibold / font-bold
- Основной текст: text-slate-900
- Вторичный текст: text-slate-500
- Мелкий текст: text-sm

### Компоненты
- Cards с rounded-xl, shadow-sm
- Buttons с вариантами default, outline, ghost
- Отступы: p-4, p-6 для секций

---

## Результат этапа

После завершения этапа у вас будет:
- Полноценный layout с sidebar
- Рабочая навигация между всеми страницами
- Базовые страницы-заглушки для всех модулей
- Настроенная система уведомлений
- Утилиты для форматирования дат и времени

