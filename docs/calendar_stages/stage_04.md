# Этап 4: Полировка UI

**Срок:** 1-2 часа

## Задачи

- [x] Настроить цвета и отступы
- [x] Проверить легенду
- [x] Проверить адаптивность
- [x] Добавить анимации переходов

---

## 4.1 Цветовая схема

### Таблица цветов

| Элемент | Цвет | Класс Tailwind |
|---------|------|----------------|
| День с занятием (фон) | Светло-изумрудный | `bg-emerald-50` |
| День с занятием (граница) | Изумрудный | `border-emerald-200` |
| Статус "Был" | Зелёный | `bg-green-100 text-green-600` |
| Статус "Не был" | Красный | `bg-red-100 text-red-600` |
| Статус "Болел" | Жёлтый | `bg-yellow-100 text-yellow-600` |
| Не отмечен | Серый | `bg-slate-100 text-slate-400` |
| Заголовок таблицы | Светло-серый | `bg-slate-50` |
| Sticky колонка | Белый | `bg-white` |

### Проверка контрастности

Убедиться, что:
- Текст хорошо читается на фоне
- Иконки различимы на соответствующем фоне
- Границы ячеек видны

### Опциональные улучшения цветов

При необходимости можно усилить контраст:

```tsx
// Более насыщенные цвета для статусов
const STATUS_OPTIONS = [
  { value: 'present', bgColor: 'bg-green-200', textColor: 'text-green-700' },
  { value: 'absent', bgColor: 'bg-red-200', textColor: 'text-red-700' },
  { value: 'sick', bgColor: 'bg-amber-200', textColor: 'text-amber-700' },
  { value: null, bgColor: 'bg-slate-200', textColor: 'text-slate-500' },
]
```

---

## 4.2 Отступы и размеры

### Диалог

```tsx
// Настройки диалога
<DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
```

При необходимости адаптировать:
- `sm:max-w-[900px]` — максимальная ширина диалога
- `max-h-[90vh]` — максимальная высота (90% viewport)

### Таблица

```tsx
// Минимальная ширина колонки с именем
<th className="min-w-[200px]">Участник</th>

// Минимальная ширина колонки дня
<th className="min-w-[60px]">6</th>
```

При необходимости увеличить:
- `min-w-[200px]` → `min-w-[250px]` для длинных имён
- `min-w-[60px]` → `min-w-[70px]` для лучшей читаемости

### Ячейки

```tsx
// Отступы в ячейках
<td className="p-2">  // Стандартный
<td className="p-1">  // Компактный для ячеек статуса
```

---

## 4.3 Легенда

### Текущий вариант легенды

```tsx
<div className="flex items-center gap-4 pt-4 border-t text-sm text-slate-600">
  <span className="font-medium">Легенда:</span>
  <div className="flex items-center gap-1">
    <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
    <span>Был</span>
  </div>
  {/* ... */}
</div>
```

### Опциональные улучшения

**Вариант 1: С иконками Lucide (консистентность)**
```tsx
import { Check, X, ThermometerSun, HelpCircle } from 'lucide-react'

<div className="flex items-center gap-1">
  <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-green-600">
    <Check className="w-3 h-3" />
  </span>
  <span>Был</span>
</div>
```

**Вариант 2: Сворачиваемая легенда (для мобильных)**
```tsx
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const [legendOpen, setLegendOpen] = useState(true)

<div className="pt-4 border-t">
  <button 
    className="flex items-center gap-2 text-sm font-medium text-slate-600 md:hidden"
    onClick={() => setLegendOpen(!legendOpen)}
  >
    Легенда
    <ChevronDown className={cn('w-4 h-4 transition-transform', legendOpen && 'rotate-180')} />
  </button>
  <div className={cn('flex items-center gap-4 text-sm text-slate-600', !legendOpen && 'hidden md:flex')}>
    {/* элементы легенды */}
  </div>
</div>
```

---

## 4.4 Адаптивность

### Breakpoints

| Размер экрана | Поведение |
|---------------|-----------|
| Desktop (>900px) | Полная таблица, все колонки видны |
| Tablet (600-900px) | Горизонтальная прокрутка таблицы |
| Mobile (<600px) | Диалог на весь экран, компактный вид |

### Диалог на мобильных

```tsx
<DialogContent className="sm:max-w-[900px] max-h-[90vh] w-full overflow-hidden flex flex-col">
```

Добавить классы для мобильных:
```tsx
className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[900px] ..."
```

### Легенда на мобильных

Изменить расположение легенды:
```tsx
<div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-4 border-t text-sm text-slate-600">
  {/* элементы будут переноситься на новую строку на мобильных */}
</div>
```

### Тестирование адаптивности

1. Открыть DevTools (F12)
2. Включить режим устройства (Ctrl+Shift+M)
3. Проверить на размерах:
   - iPhone SE (375px)
   - iPhone 14 (390px)
   - iPad (768px)
   - Desktop (1920px)

---

## 4.5 Анимации и переходы

### Анимация загрузки

**Spinner вместо текста "Загрузка...":**
```tsx
import { Loader2 } from 'lucide-react'

{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    <span className="ml-2 text-slate-500">Загрузка...</span>
  </div>
) : (
  // ...
)}
```

### Плавное появление данных

Добавить анимацию fade-in для таблицы:

```tsx
// В AttendanceCalendar.tsx
<div className="overflow-auto animate-in fade-in duration-300">
  <table>...</table>
</div>
```

Если используется shadcn/ui, анимации уже встроены. Иначе добавить в CSS:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

### Анимация смены месяца

```tsx
// Добавить состояние для анимации
const [isTransitioning, setIsTransitioning] = useState(false)

const handleMonthChange = (direction: 'prev' | 'next') => {
  setIsTransitioning(true)
  // изменить месяц
  setTimeout(() => setIsTransitioning(false), 150)
}

// В JSX
<div className={cn(
  'flex-1 overflow-auto transition-opacity duration-150',
  isTransitioning && 'opacity-50'
)}>
  {/* таблица */}
</div>
```

### Анимация Popover

Popover из shadcn/ui уже имеет анимации. Убедиться, что они работают:

```tsx
<PopoverContent className="w-40 p-1 animate-in fade-in-0 zoom-in-95">
```

### Hover эффекты

Добавить визуальную обратную связь при наведении:

```tsx
// Кнопка статуса
<Button
  variant="ghost"
  size="sm"
  className="w-full h-8 p-0 hover:bg-slate-100 transition-colors"
>

// Строка таблицы
<tr className="hover:bg-slate-50 transition-colors">
```

---

## 4.6 Финальная проверка UI

### Чек-лист визуальной проверки

- [ ] Цвета статусов хорошо различимы
- [ ] Текст читабельный на всех фонах
- [ ] Иконки имеют достаточный размер
- [ ] Отступы равномерные и достаточные
- [ ] Границы таблицы ровные
- [ ] Sticky-колонка работает корректно
- [ ] Легенда понятна без объяснений
- [ ] Диалог не обрезается на разных экранах
- [ ] Анимации плавные (не дёргаются)
- [ ] Hover-эффекты присутствуют

### Скриншоты для документации

Сделать скриншоты финального вида:
1. Календарь с заполненными данными
2. Popover выбора статуса
3. Пустой календарь (нет занятий)
4. Мобильный вид

---

## 4.7 Опциональные улучшения

### Кнопка "Сегодня"

Добавить быстрый переход к текущему месяцу:

```tsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }}
>
  Сегодня
</Button>
```

### Подсветка сегодняшнего дня

```tsx
const today = new Date()
const isToday = (day: number) => 
  year === today.getFullYear() && 
  month === today.getMonth() + 1 && 
  day === today.getDate()

// В JSX
<th className={cn(
  'border p-2',
  isToday(dayData.day) && 'ring-2 ring-blue-500'
)}>
```

### Статистика посещаемости

Добавить процент посещаемости для каждого участника:

```tsx
const getAttendancePercent = (clientId: number): number => {
  const totalLessons = lessonDays.length
  if (totalLessons === 0) return 0
  
  const presentCount = lessonDays.filter(d => {
    const lesson = d.lessons[0]
    return attendance[lesson.id]?.[clientId] === 'present'
  }).length
  
  return Math.round((presentCount / totalLessons) * 100)
}

// В последней колонке
<td className="border p-2 text-center font-medium">
  {getAttendancePercent(member.client_id)}%
</td>
```

---

## ✅ Критерии готовности этапа

1. Цветовая схема консистентна и контрастна
2. Отступы и размеры оптимальны
3. Легенда понятна и корректно отображается
4. Интерфейс адаптивен для разных экранов
5. Анимации плавные и ненавязчивые
6. Все элементы имеют hover-эффекты
7. Финальный вид соответствует макету
8. Нет визуальных артефактов или багов
