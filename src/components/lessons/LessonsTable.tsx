import type { Lesson } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Users, Trash2, ClipboardList } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

interface LessonsTableProps {
  lessons: Lesson[]
  onAttendance: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
}

export function LessonsTable({ lessons, onAttendance, onDelete }: LessonsTableProps) {
  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Нет занятий</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Время</TableHead>
          <TableHead>Группа</TableHead>
          <TableHead>Тренер</TableHead>
          <TableHead>Посещаемость</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons.map((lesson) => (
          <TableRow key={lesson.id}>
            <TableCell className="font-medium">
              {formatDate(lesson.lesson_date)}
            </TableCell>
            <TableCell>
              {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
            </TableCell>
            <TableCell>{lesson.group_name}</TableCell>
            <TableCell>{lesson.trainer_name || '—'}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{lesson.attendance_count || 0} / {lesson.total_members || 0}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Посещаемость"
                  onClick={() => onAttendance(lesson)}
                >
                  <ClipboardList className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => onDelete(lesson)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

