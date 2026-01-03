import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useLessonsStore } from '@/stores/lessonsStore'
import { LessonsTable } from '@/components/lessons/LessonsTable'
import { LessonsFilters } from '@/components/lessons/LessonsFilters'
import { GenerateLessonsDialog } from '@/components/lessons/GenerateLessonsDialog'
import { AttendanceDialog } from '@/components/lessons/AttendanceDialog'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Lesson } from '@/types'

export function Lessons() {
  const { lessons, isLoading, filters, fetchLessons, setFilters, generateLessons, deleteLesson } = useLessonsStore()
  
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [attendanceLesson, setAttendanceLesson] = useState<Lesson | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  const handleGenerate = async (groupId: number, startDate: string, endDate: string) => {
    const count = await generateLessons(groupId, startDate, endDate)
    toast.success(`Создано ${count} занятий`)
    return count
  }

  const handleDelete = async () => {
    if (!deletingLesson) return
    setIsDeleting(true)
    try {
      await deleteLesson(deletingLesson.id)
      toast.success('Занятие удалено')
      setDeletingLesson(null)
    } catch (error) {
      toast.error('Ошибка')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Занятия" subtitle={`Всего: ${lessons.length}`} />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row gap-4 justify-between">
            <LessonsFilters filters={filters} onChange={setFilters} />
            <Button 
              onClick={() => setIsGenerateOpen(true)}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#0f1f5a' }}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Сгенерировать
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <LessonsTable
                lessons={lessons}
                onAttendance={setAttendanceLesson}
                onDelete={setDeletingLesson}
              />
            )}
          </div>
        </div>
      </div>

      <GenerateLessonsDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onGenerate={handleGenerate}
      />

      <AttendanceDialog
        open={!!attendanceLesson}
        onOpenChange={(open) => !open && setAttendanceLesson(null)}
        lesson={attendanceLesson}
      />

      <DeleteConfirmDialog
        open={!!deletingLesson}
        onOpenChange={(open) => !open && setDeletingLesson(null)}
        title="Удалить занятие?"
        description="Данные о посещаемости также будут удалены."
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}

