# План разработки приложения "Train Schedule"

## Обзор проекта

Десктопное приложение для управления тренировками, клиентами, группами и сотрудниками спортивного клуба. Работает офлайн с возможностью синхронизации данных с удаленным сервером.

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Фреймворк | Electron |
| Frontend | React + TypeScript |
| UI библиотека | ShadCN/UI + Tailwind CSS |
| Локальная БД | SQLite3 (better-sqlite3) |
| Состояние | Zustand |
| Синхронизация | REST API / Fetch |
| Сборка | Vite + electron-builder |

---

## Структура базы данных

### Таблица `employees` (Сотрудники)
```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  birth_year INTEGER,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `clients` (Клиенты)
```sql
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  birth_year INTEGER,
  phone TEXT,
  last_payment_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `clients_parents` (Родители клиентов)
```sql
CREATE TABLE clients_parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `groups` (Группы)
```sql
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date DATE,
  trainer_id INTEGER REFERENCES employees(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `group_schedule` (Расписание групп)
```sql
CREATE TABLE group_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0-6 (Пн-Вс)
  start_time TEXT NOT NULL,     -- "20:00"
  end_time TEXT NOT NULL,       -- "21:30"
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `group_members` (Участники групп)
```sql
CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  joined_at DATE DEFAULT CURRENT_DATE,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `lessons` (Занятия)
```sql
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `attendance` (Посещаемость)
```sql
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT CHECK(status IN ('present', 'absent', 'sick', NULL)),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### Таблица `sync_log` (Лог синхронизации)
```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT,
  details TEXT
);
```

---

## Структура проекта

```
train-schedule/
├── electron/
│   ├── main.ts              # Главный процесс Electron
│   ├── preload.ts           # Preload скрипт
│   └── database/
│       ├── index.ts         # Инициализация SQLite
│       ├── migrations.ts    # Миграции БД
│       └── queries/         # SQL запросы по сущностям
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/              # ShadCN компоненты
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── dashboard/
│   │   │   ├── TodayLessons.tsx
│   │   │   └── Debtors.tsx
│   │   ├── clients/
│   │   ├── groups/
│   │   ├── lessons/
│   │   └── employees/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Clients.tsx
│   │   ├── Groups.tsx
│   │   ├── Lessons.tsx
│   │   └── Employees.tsx
│   ├── stores/              # Zustand stores
│   ├── hooks/
│   ├── lib/
│   │   ├── utils.ts
│   │   └── sync.ts          # Логика синхронизации
│   └── types/
├── package.json
├── vite.config.ts
├── electron-builder.json
└── tailwind.config.js
```

---

## Этапы разработки

### Этап 1: Инициализация проекта (1-2 дня)
- [ ] Инициализация Electron + Vite + React + TypeScript
- [ ] Настройка Tailwind CSS
- [ ] Установка и настройка ShadCN/UI
- [ ] Настройка better-sqlite3 для Electron
- [ ] Базовая структура папок

### Этап 2: База данных (1-2 дня)
- [ ] Создание миграций
- [ ] Написание базовых CRUD-операций
- [ ] IPC-мост между renderer и main процессами
- [ ] Тестирование работы с БД

### Этап 3: Базовый UI и навигация (1-2 дня)
- [ ] Layout приложения (Sidebar + Header)
- [ ] Роутинг между страницами
- [ ] Базовые страницы-заглушки

### Этап 4: Модуль "Сотрудники" (1 день)
- [ ] Список сотрудников
- [ ] Форма добавления/редактирования
- [ ] Удаление с подтверждением

### Этап 5: Модуль "Клиенты" (1-2 дня)
- [ ] Список клиентов с поиском
- [ ] Форма добавления/редактирования
- [ ] Поля для родителей (опционально)
- [ ] Отображение даты последней оплаты

### Этап 6: Модуль "Группы" (2-3 дня)
- [ ] Список групп
- [ ] Форма создания группы
- [ ] Настройка расписания (выбор дней и времени)
- [ ] Назначение тренера из сотрудников
- [ ] Добавление/удаление участников группы

### Этап 7: Модуль "Занятия" (3-4 дня)
- [ ] Список занятий (фильтрация по группе)
- [ ] Автогенерация занятий по расписанию
- [ ] Календарь посещаемости
- [ ] Интерфейс отметки посещаемости (Был/Отсутствовал/Болеет)
- [ ] Индикатор статуса посещаемости

### Этап 8: Главная страница (1-2 дня)
- [ ] Виджет "Тренировки сегодня"
- [ ] Виджет "Должники" (клиенты без оплаты)
- [ ] Быстрые действия

### Этап 9: Синхронизация (2-3 дня)
- [ ] API эндпоинты на сервере (если нужно)
- [ ] Логика синхронизации в приложении
- [ ] Кнопка синхронизации в Header
- [ ] Индикатор статуса синхронизации
- [ ] Обработка конфликтов

### Этап 10: Финализация (1-2 дня)
- [ ] Тестирование всех модулей
- [ ] Обработка ошибок
- [ ] Сборка production-версии
- [ ] Создание инсталлятора

---

## Оценка времени

| Этап | Срок |
|------|------|
| Инициализация | 1-2 дня |
| База данных | 1-2 дня |
| Базовый UI | 1-2 дня |
| Сотрудники | 1 день |
| Клиенты | 1-2 дня |
| Группы | 2-3 дня |
| Занятия | 3-4 дня |
| Главная | 1-2 дня |
| Синхронизация | 2-3 дня |
| Финализация | 1-2 дня |
| **Итого** | **~15-22 дня** |

---

## Ключевые решения

### Синхронизация
- Каждая запись имеет поле `sync_status`: `pending`, `synced`, `conflict`
- При изменении данных статус меняется на `pending`
- При нажатии кнопки синхронизации отправляются все записи со статусом `pending`
- После успешной синхронизации статус меняется на `synced`

### Офлайн-режим
- Все данные хранятся локально в SQLite
- Приложение полностью функционально без интернета
- Синхронизация происходит только по запросу пользователя

### Посещаемость
- Статусы: `present` (Был), `absent` (Отсутствовал), `sick` (Болеет), `NULL` (Не отмечен)
- При клике на ячейку появляется popup с выбором статуса

---

## Следующий шаг

Начать с **Этапа 1**: инициализация проекта Electron + Vite + React.

