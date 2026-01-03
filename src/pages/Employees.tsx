import { Header } from '@/components/layout/Header'

export function Employees() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Сотрудники" subtitle="Управление сотрудниками клуба" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница сотрудников в разработке...</p>
        </div>
      </div>
    </div>
  )
}

