import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLessonsStore } from '@/stores/lessonsStore'
import { formatTime, cn } from '@/lib/utils'
import { AttendanceDialog } from '@/components/lessons/AttendanceDialog'
import type { Lesson } from '@/types'

export function TodayLessons() {
  const navigate = useNavigate()
  const { todayLessons, fetchTodayLessons } = useLessonsStore()
  const [attendanceLesson, setAttendanceLesson] = useState<Lesson | null>(null)

  useEffect(() => {
    fetchTodayLessons()
  }, [fetchTodayLessons])

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const isLessonNow = (startTime: string, endTime: string) => {
    return currentTime >= startTime && currentTime <= endTime
  }

  const isLessonPast = (endTime: string) => {
    return currentTime > endTime
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Тренировки сегодня
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/lessons')}>
          Все занятия
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {todayLessons.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Нет занятий на сегодня</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayLessons.map((lesson) => {
              const isNow = isLessonNow(lesson.start_time, lesson.end_time)
              const isPast = isLessonPast(lesson.end_time)
              
              return (
                <div
                  key={lesson.id}
                  onClick={() => setAttendanceLesson(lesson)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                    isNow && 'border-primary bg-primary/5 hover:bg-primary/10',
                    isPast && 'opacity-60 hover:opacity-80',
                    !isNow && !isPast && 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isNow ? 'bg-primary text-white' : 'bg-slate-100'
                    )}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{lesson.group_name}</p>
                      <p className="text-sm text-slate-500">
                        {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
                        {lesson.trainer_name && ` • ${lesson.trainer_name}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isNow && (
                      <Badge className="bg-primary">Сейчас</Badge>
                    )}
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Users className="w-4 h-4" />
                      {lesson.attendance_count || 0}/{lesson.total_members || 0}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <AttendanceDialog
        open={!!attendanceLesson}
        onOpenChange={(open) => !open && setAttendanceLesson(null)}
        lesson={attendanceLesson}
      />
    </Card>
  )
}

