import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Check, X, ThermometerSun, HelpCircle } from 'lucide-react'
import { useLessonsStore } from '@/stores/lessonsStore'
import { formatDate, formatTime, getAttendanceStatusText, getAttendanceStatusColor, cn } from '@/lib/utils'
import type { Lesson, AttendanceStatus } from '@/types'

interface AttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: Lesson | null
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Присутствовал', icon: <Check className="w-4 h-4" />, color: 'bg-green-500' },
  { value: 'absent', label: 'Отсутствовал', icon: <X className="w-4 h-4" />, color: 'bg-red-500' },
  { value: 'sick', label: 'Болеет', icon: <ThermometerSun className="w-4 h-4" />, color: 'bg-yellow-500' },
  { value: null, label: 'Не отмечен', icon: <HelpCircle className="w-4 h-4" />, color: 'bg-slate-300' },
]

export function AttendanceDialog({ open, onOpenChange, lesson }: AttendanceDialogProps) {
  const { currentAttendance, fetchAttendance, updateAttendance } = useLessonsStore()

  useEffect(() => {
    if (open && lesson) {
      fetchAttendance(lesson.id)
    }
  }, [open, lesson, fetchAttendance])

  if (!lesson) return null

  const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
    await updateAttendance(lesson.id, clientId, status)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Посещаемость — {lesson.group_name}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {formatDate(lesson.lesson_date)}, {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {currentAttendance.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              Нет участников в группе
            </p>
          ) : (
            currentAttendance.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{record.client_name}</p>
                  <p className="text-sm text-slate-500">{record.client_phone || '—'}</p>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Badge className={cn('mr-2', getAttendanceStatusColor(record.status))}>
                        {getAttendanceStatusText(record.status)}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1">
                    {STATUS_OPTIONS.map((option) => (
                      <Button
                        key={option.value ?? 'null'}
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => handleStatusChange(record.client_id, option.value)}
                      >
                        <span className={cn('p-1 rounded text-white', option.color)}>
                          {option.icon}
                        </span>
                        {option.label}
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

