import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, User } from 'lucide-react'
import { useGroupsStore } from '@/stores/groupsStore'
import { ScheduleEditor } from '@/components/groups/ScheduleEditor'
import { MembersManager } from '@/components/groups/MembersManager'
import { toast } from 'sonner'

export function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentGroup, fetchGroupById, addSchedule, removeSchedule, addMember, removeMember } = useGroupsStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      setIsLoading(true)
      fetchGroupById(parseInt(id)).finally(() => setIsLoading(false))
    }
  }, [id, fetchGroupById])

  if (isLoading || !currentGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={currentGroup.name} subtitle="Информация о группе" />
      
      <div className="flex-1 p-6 overflow-auto">
        <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к группам
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Дата начала</p>
                <p className="font-medium">{currentGroup.start_date || 'Не указана'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Тренер</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">
                    {currentGroup.trainer?.full_name || 'Не назначен'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Расписание и участники</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScheduleEditor
                schedule={currentGroup.schedule || []}
                onAdd={async (data) => {
                  await addSchedule(currentGroup.id, data)
                  toast.success('Расписание добавлено')
                }}
                onRemove={async (scheduleId) => {
                  await removeSchedule(scheduleId)
                  toast.success('Расписание удалено')
                }}
              />

              <hr />

              <MembersManager
                members={currentGroup.members || []}
                onAdd={async (clientId) => {
                  await addMember(currentGroup.id, clientId)
                  toast.success('Участник добавлен')
                }}
                onRemove={async (clientId) => {
                  await removeMember(currentGroup.id, clientId)
                  toast.success('Участник удалён')
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}







