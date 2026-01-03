import { Header } from '@/components/layout/Header'

export function Clients() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Клиенты" subtitle="Управление клиентами клуба" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница клиентов в разработке...</p>
        </div>
      </div>
    </div>
  )
}

