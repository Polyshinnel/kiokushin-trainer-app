# Этап 1: Backend — запросы и API

**Срок:** 2-3 часа

## Задачи

- [x] Добавить метод `getByGroupAndMonth` в `lessonQueries`
- [x] Добавить метод `getGroupAttendanceMatrix` в `lessonQueries`
- [x] Добавить IPC handlers в `main.ts`
- [x] Добавить функции в `src/lib/api.ts`
- [ ] Протестировать запросы через DevTools

---

## 1.1 Используемые таблицы БД

Для реализации календаря используются уже существующие таблицы:

### Таблица `lessons` (занятия)
```sql
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  lesson_date DATE NOT NULL,        -- Дата занятия
  start_time TEXT NOT NULL,         -- Время начала
  end_time TEXT NOT NULL,           -- Время окончания
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
```

### Таблица `attendance` (посещаемость)
```sql
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'sick') OR status IS NULL),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE(lesson_id, client_id)
);
```

### Таблица `group_members` (участники группы)
```sql
CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  joined_at DATE DEFAULT CURRENT_DATE,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE(group_id, client_id)
);
```

---

## 1.2 Опциональный индекс для оптимизации

**Файл:** `electron/database/migrations.ts`

Если требуется оптимизация выборки занятий за период:

```sql
CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date);
```

---

## 1.3 Queries для календаря

**Обновить файл:** `electron/database/queries/lessons.ts`

Добавить новые методы в `lessonQueries`:

```typescript
export const lessonQueries = {
  // ... существующие методы ...

  /**
   * Получить занятия группы за указанный месяц
   */
  getByGroupAndMonth(groupId: number, year: number, month: number): LessonWithDetails[] {
    const db = getDatabase()
    
    // Формируем даты начала и конца месяца
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    
    return db.prepare(`
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE l.group_id = ? AND l.lesson_date BETWEEN ? AND ?
      ORDER BY l.lesson_date ASC, l.start_time ASC
    `).all(groupId, startDate, endDate) as LessonWithDetails[]
  },

  /**
   * Получить полную матрицу посещаемости группы за месяц
   * Возвращает: { lessons: [], members: [], attendance: { lessonId: { clientId: status } } }
   */
  getGroupAttendanceMatrix(groupId: number, year: number, month: number): {
    lessons: LessonWithDetails[]
    members: { client_id: number; client_name: string; client_phone: string | null }[]
    attendance: Record<number, Record<number, 'present' | 'absent' | 'sick' | null>>
  } {
    const db = getDatabase()
    
    // Получаем занятия за месяц
    const lessons = this.getByGroupAndMonth(groupId, year, month)
    
    // Получаем участников группы
    const members = db.prepare(`
      SELECT gm.client_id, c.full_name as client_name, c.phone as client_phone
      FROM group_members gm
      JOIN clients c ON c.id = gm.client_id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(groupId) as { client_id: number; client_name: string; client_phone: string | null }[]
    
    // Получаем все записи посещаемости за эти занятия
    const lessonIds = lessons.map(l => l.id)
    
    if (lessonIds.length === 0) {
      return { lessons, members, attendance: {} }
    }
    
    const placeholders = lessonIds.map(() => '?').join(',')
    const attendanceRecords = db.prepare(`
      SELECT lesson_id, client_id, status
      FROM attendance
      WHERE lesson_id IN (${placeholders})
    `).all(...lessonIds) as { lesson_id: number; client_id: number; status: 'present' | 'absent' | 'sick' | null }[]
    
    // Формируем матрицу посещаемости
    const attendance: Record<number, Record<number, 'present' | 'absent' | 'sick' | null>> = {}
    
    for (const record of attendanceRecords) {
      if (!attendance[record.lesson_id]) {
        attendance[record.lesson_id] = {}
      }
      attendance[record.lesson_id][record.client_id] = record.status
    }
    
    return { lessons, members, attendance }
  }
}
```

---

## 1.4 IPC Handlers

**Обновить файл:** `electron/main.ts`

Добавить новые handlers в функцию `setupIpcHandlers()`:

```typescript
// Calendar attendance
ipcMain.handle('db:lessons:getByGroupAndMonth', (_, groupId, year, month) => 
  lessonQueries.getByGroupAndMonth(groupId, year, month))
  
ipcMain.handle('db:lessons:getGroupAttendanceMatrix', (_, groupId, year, month) => 
  lessonQueries.getGroupAttendanceMatrix(groupId, year, month))
```

---

## 1.5 API функции

**Обновить файл:** `src/lib/api.ts`

Добавить новые функции в `lessonsApi`:

```typescript
export const lessonsApi = {
  // ... существующие методы ...

  // Получить занятия группы за месяц
  getByGroupAndMonth: (groupId: number, year: number, month: number) =>
    window.electronAPI.db.query('lessons:getByGroupAndMonth', groupId, year, month),

  // Получить матрицу посещаемости группы за месяц
  getGroupAttendanceMatrix: (groupId: number, year: number, month: number) =>
    window.electronAPI.db.query('lessons:getGroupAttendanceMatrix', groupId, year, month),
}
```

Убедиться, что `attendanceApi` содержит метод `updateStatus`:

```typescript
export const attendanceApi = {
  getByLesson: (lessonId: number) => 
    window.electronAPI.db.query('attendance:getByLesson', lessonId),
  
  updateStatus: (lessonId: number, clientId: number, status: AttendanceStatus) =>
    window.electronAPI.db.query('attendance:updateStatus', lessonId, clientId, status),
  
  getClientAttendance: (clientId: number, startDate?: string, endDate?: string) =>
    window.electronAPI.db.query('attendance:getClientAttendance', clientId, startDate, endDate),
}
```

---

## 1.6 Тестирование

После реализации протестировать через DevTools (Ctrl+Shift+I):

```javascript
// Тест получения занятий за месяц
await window.electronAPI.db.query('lessons:getByGroupAndMonth', 1, 2026, 1)

// Тест получения матрицы посещаемости
await window.electronAPI.db.query('lessons:getGroupAttendanceMatrix', 1, 2026, 1)
```

Ожидаемый результат для `getGroupAttendanceMatrix`:
```json
{
  "lessons": [
    { "id": 1, "group_id": 1, "lesson_date": "2026-01-06", "start_time": "18:00", ... },
    { "id": 2, "group_id": 1, "lesson_date": "2026-01-08", "start_time": "18:00", ... }
  ],
  "members": [
    { "client_id": 1, "client_name": "Иванов Иван", "client_phone": "+7..." },
    { "client_id": 2, "client_name": "Петрова Мария", "client_phone": "+7..." }
  ],
  "attendance": {
    "1": { "1": "present", "2": "absent" },
    "2": { "1": "present", "2": "present" }
  }
}
```

---

## ✅ Критерии готовности этапа

1. Метод `getByGroupAndMonth` возвращает занятия группы за указанный месяц
2. Метод `getGroupAttendanceMatrix` возвращает полную матрицу данных
3. IPC handlers зарегистрированы и работают
4. API функции доступны во фронтенде
5. Запросы протестированы через DevTools
