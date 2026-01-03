import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { getDayName } from '@/lib/utils'
import type { GroupSchedule } from '@/types'

interface ScheduleEditorProps {
  schedule: GroupSchedule[]
  onAdd: (data: { day_of_week: number; start_time: string; end_time: string }) => Promise<void>
  onRemove: (scheduleId: number) => Promise<void>
}

const DAYS = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
]

export function ScheduleEditor({ schedule, onAdd, onRemove }: ScheduleEditorProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newSlot, setNewSlot] = useState({
    day_of_week: '0',
    start_time: '18:00',
    end_time: '19:30'
  })

  const handleAdd = async () => {
    await onAdd({
      day_of_week: parseInt(newSlot.day_of_week),
      start_time: newSlot.start_time,
      end_time: newSlot.end_time
    })
    setIsAdding(false)
    setNewSlot({ day_of_week: '0', start_time: '18:00', end_time: '19:30' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Расписание</h4>
        <Button 
          size="sm" 
          onClick={() => setIsAdding(true)}
          style={{ backgroundColor: '#0c194b', color: '#fff' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
        >
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      {schedule.length === 0 && !isAdding && (
        <p className="text-sm text-slate-500">Расписание не задано</p>
      )}

      <div className="space-y-2">
        {schedule.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div>
              <span className="font-medium">{getDayName(slot.day_of_week)}</span>
              <span className="text-slate-600 ml-2">
                {slot.start_time} — {slot.end_time}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500"
              onClick={() => onRemove(slot.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {isAdding && (
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <div className="space-y-2">
              <Label>День недели</Label>
              <Select
                value={newSlot.day_of_week}
                onValueChange={(v) => setNewSlot({ ...newSlot, day_of_week: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Начало</Label>
                <Input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Конец</Label>
                <Input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Отмена
              </Button>
              <Button 
                size="sm" 
                onClick={handleAdd}
                style={{ backgroundColor: '#0c194b', color: '#fff' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
              >
                Добавить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

