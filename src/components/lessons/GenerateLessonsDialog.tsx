import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { groupsApi } from '@/lib/api'
import type { Group } from '@/types'

interface GenerateLessonsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (groupId: number, startDate: string, endDate: string) => Promise<number>
}

export function GenerateLessonsDialog({ open, onOpenChange, onGenerate }: GenerateLessonsDialogProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      const today = new Date()
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
      setStartDate(today.toISOString().split('T')[0])
      setEndDate(nextMonth.toISOString().split('T')[0])
    }
  }, [open])

  const loadGroups = async () => {
    const groups = await groupsApi.getAll() as Group[]
    setGroups(groups)
  }

  const handleGenerate = async () => {
    if (!groupId || !startDate || !endDate) return
    
    setIsGenerating(true)
    try {
      const count = await onGenerate(parseInt(groupId), startDate, endDate)
      onOpenChange(false)
      return count
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сгенерировать занятия</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Группа</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите группу" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дата начала</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Дата окончания</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Занятия будут созданы согласно расписанию группы на выбранный период.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !groupId}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: '#0f1f5a' }}
          >
            {isGenerating ? 'Генерация...' : 'Сгенерировать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

