import type { Group } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface GroupsListProps {
  groups: Group[]
  onEdit: (group: Group) => void
  onDelete: (group: Group) => void
}

export function GroupsList({ groups, onEdit, onDelete }: GroupsListProps) {
  const navigate = useNavigate()

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p>Нет групп</p>
        <p className="text-sm mt-1">Создайте первую группу</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map((group) => (
        <Card 
          key={group.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/groups/${group.id}`)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{group.name}</CardTitle>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={() => onEdit(group)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => onDelete(group)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{group.member_count || 0} участников</span>
              </div>
              {group.trainer_name && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{group.trainer_name}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <Badge variant="secondary">
                {group.start_date || 'Дата не указана'}
              </Badge>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

