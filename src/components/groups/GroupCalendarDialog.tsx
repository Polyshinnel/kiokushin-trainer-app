import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, Check, X, ThermometerSun, HelpCircle } from 'lucide-react'
import { AttendanceCalendar } from './AttendanceCalendar'
import { lessonsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Group, GroupAttendanceMatrix } from '@/types'

interface GroupCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export function GroupCalendarDialog({ open, onOpenChange, group }: GroupCalendarDialogProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12
  const [data, setData] = useState<GroupAttendanceMatrix | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Загрузка данных при открытии или смене месяца
  useEffect(() => {
    if (open && group) {
      loadData()
    }
  }, [open, group, year, month])

  const loadData = async () => {
    if (!group) return
    setIsLoading(true)
    try {
      const result = await lessonsApi.getGroupAttendanceMatrix(group.id, year, month) as GroupAttendanceMatrix
      setData(result)
    } catch (error) {
      console.error('Error loading attendance matrix:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrevMonth = () => {
    setIsTransitioning(true)
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
    setTimeout(() => setIsTransitioning(false), 150)
  }

  const handleNextMonth = () => {
    setIsTransitioning(true)
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
    setTimeout(() => setIsTransitioning(false), 150)
  }

  const handleToday = () => {
    setIsTransitioning(true)
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setTimeout(() => setIsTransitioning(false), 150)
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[900px] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <DialogTitle className="text-lg sm:text-xl">Календарь посещаемости — {group.name}</DialogTitle>
            
            {/* Навигация по месяцам */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center text-sm sm:text-base">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToday}
                className="ml-auto sm:ml-2"
              >
                Сегодня
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          'flex-1 overflow-auto transition-opacity duration-150',
          isTransitioning && 'opacity-50'
        )}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">Загрузка...</span>
            </div>
          ) : data ? (
            <AttendanceCalendar
              year={year}
              month={month}
              lessons={data.lessons}
              members={data.members}
              attendance={data.attendance}
              onAttendanceChange={loadData}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-500">Нет данных</p>
            </div>
          )}
        </div>

        {/* Легенда */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-4 border-t text-sm text-slate-600">
          <span className="font-medium w-full sm:w-auto">Легенда:</span>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-green-200 flex items-center justify-center text-green-700">
              <Check className="w-3 h-3" />
            </span>
            <span>Был</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-red-200 flex items-center justify-center text-red-700">
              <X className="w-3 h-3" />
            </span>
            <span>Не был</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-amber-200 flex items-center justify-center text-amber-700">
              <ThermometerSun className="w-3 h-3" />
            </span>
            <span>Болел</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center text-slate-500">
              <HelpCircle className="w-3 h-3" />
            </span>
            <span>Не отмечен</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200"></span>
            <span>День занятия</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
