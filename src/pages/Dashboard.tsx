import { Header } from '@/components/layout/Header'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TodayLessons } from '@/components/dashboard/TodayLessons'
import { Debtors } from '@/components/dashboard/Debtors'
import { QuickActions } from '@/components/dashboard/QuickActions'

export function Dashboard() {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Главная" 
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)} 
      />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          <StatsCards />
          
          <QuickActions />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayLessons />
            <Debtors />
          </div>
          
        </div>
      </div>
    </div>
  )
}

