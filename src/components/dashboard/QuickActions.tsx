import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UsersRound, Calendar, Zap } from 'lucide-react'

export function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    {
      label: 'Добавить клиента',
      icon: UserPlus,
      onClick: () => navigate('/clients?action=add')
    },
    {
      label: 'Создать группу',
      icon: UsersRound,
      onClick: () => navigate('/groups?action=add')
    },
    {
      label: 'Сгенерировать занятия',
      icon: Calendar,
      onClick: () => navigate('/lessons?action=generate')
    }
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Быстрые действия
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-slate-50 border-slate-200"
              onClick={action.onClick}
            >
              <div className="p-3 rounded-lg bg-blue-100">
                <action.icon className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm text-slate-900">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

