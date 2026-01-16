import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Calendar,
  UserCog,
  CreditCard,
  Settings,
  LogOut
} from 'lucide-react'

const navItems = [
  { title: 'Главная', path: '/', icon: LayoutDashboard },
  { title: 'Клиенты', path: '/clients', icon: Users },
  { title: 'Группы', path: '/groups', icon: UsersRound },
  { title: 'Занятия', path: '/lessons', icon: Calendar },
  { title: 'Сотрудники', path: '/employees', icon: UserCog },
  { title: 'Абонементы', path: '/subscriptions', icon: CreditCard },
]

export function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('auth_session')
    navigate('/login')
  }

  return (
    <aside className="w-64 bg-white flex flex-col h-screen border-r border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img 
            src="kyokushin-karate-seeklogo.png" 
            alt="Kentos Dojo" 
            className="h-10 w-auto object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight" style={{ color: '#0c194b', fontSize: '32px' }}>
              Kentos Dojo
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Управление тренировками
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-slate-100'
                        : 'hover:bg-slate-50'
                    )
                  }
                  style={{ color: '#0c194b' }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#0c194b' }} />
                  <span className="font-medium">{item.title}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-slate-50"
          style={{ color: '#0c194b' }}
        >
          <LogOut className="w-5 h-5" style={{ color: '#0c194b' }} />
          <span className="font-medium">Выход</span>
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              isActive
                ? 'bg-slate-100'
                : 'hover:bg-slate-50'
            )
          }
          style={{ color: '#0c194b' }}
        >
          <Settings className="w-5 h-5" style={{ color: '#0c194b' }} />
          <span className="font-medium">Настройки</span>
        </NavLink>
      </div>
    </aside>
  )
}

