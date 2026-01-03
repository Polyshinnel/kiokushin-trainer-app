import { Header } from '@/components/layout/Header'

export function Settings() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Настройки" subtitle="Настройки приложения" />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500">Страница настроек в разработке...</p>
        </div>
      </div>
    </div>
  )
}

