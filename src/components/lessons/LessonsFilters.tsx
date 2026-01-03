import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import { groupsApi } from '@/lib/api'
import type { Group } from '@/types'

interface LessonsFiltersProps {
  filters: {
    groupId?: number
    startDate?: string
    endDate?: string
  }
  onChange: (filters: any) => void
}

export function LessonsFilters({ filters, onChange }: LessonsFiltersProps) {
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    const groups = await groupsApi.getAll() as Group[]
    setGroups(groups)
  }

  const getDefaultDateRange = () => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + 7)
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      startDate: formatDate(today),
      endDate: formatDate(endDate)
    }
  }

  const clearFilters = () => {
    onChange(getDefaultDateRange())
  }

  const defaultRange = getDefaultDateRange()
  const hasFilters = filters.groupId || 
    filters.startDate !== defaultRange.startDate || 
    filters.endDate !== defaultRange.endDate

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-1">
        <Label className="text-xs">Группа</Label>
        <Select
          value={filters.groupId?.toString() || 'all'}
          onValueChange={(v) => onChange({ ...filters, groupId: v === 'all' ? undefined : parseInt(v) })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">С даты</Label>
        <Input
          type="date"
          className="w-[160px]"
          value={filters.startDate || ''}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">По дату</Label>
        <Input
          type="date"
          className="w-[160px]"
          value={filters.endDate || ''}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="w-4 h-4 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  )
}

