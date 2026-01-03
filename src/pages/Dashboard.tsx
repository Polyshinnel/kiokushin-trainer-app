import { Header } from '@/components/layout/Header'

export function Dashboard() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Главная" subtitle="Обзор тренировок и клиентов" />
      
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Тренировки сегодня
            </h3>
            <p className="text-3xl font-bold text-primary">0</p>
            <p className="text-sm text-slate-500 mt-1">Нет запланированных</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Активные клиенты
            </h3>
            <p className="text-3xl font-bold text-primary">0</p>
            <p className="text-sm text-slate-500 mt-1">В этом месяце</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">
              Должники
            </h3>
            <p className="text-3xl font-bold text-red-500">0</p>
            <p className="text-sm text-slate-500 mt-1">Требуется оплата</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">
              Расписание на сегодня
            </h3>
            <p className="text-slate-500">Нет занятий на сегодня</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">
              Список должников
            </h3>
            <p className="text-slate-500">Нет должников</p>
          </div>
        </div>
      </div>
    </div>
  )
}

