import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Calendar,
  UserCog,
  Settings
} from 'lucide-react'

const navItems = [
  { title: 'Главная', path: '/', icon: LayoutDashboard },
  { title: 'Клиенты', path: '/clients', icon: Users },
  { title: 'Группы', path: '/groups', icon: UsersRound },
  { title: 'Занятия', path: '/lessons', icon: Calendar },
  { title: 'Сотрудники', path: '/employees', icon: UserCog },
]

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight">
          Train Schedule
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Управление тренировками
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    'hover:bg-slate-800',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-300'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              'hover:bg-slate-800',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-300'
            )
          }
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Настройки</span>
        </NavLink>
      </div>
    </aside>
  )
}

