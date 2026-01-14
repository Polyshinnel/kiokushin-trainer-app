import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export function Login() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!login || !password) {
      toast.error('Заполните все поля')
      return
    }

    setLoading(true)
    try {
      const employee = await authApi.login(login, password)
      
      if (employee) {
        const sessionData = {
          employeeId: employee.id,
          fullName: employee.full_name,
          login: employee.login,
          expiresAt: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
        }
        localStorage.setItem('auth_session', JSON.stringify(sessionData))
        window.location.href = '/'
      } else {
        toast.error('Неверный логин или пароль')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при входе в систему'
      toast.error(errorMessage)
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="kyokushin-karate-seeklogo.png" 
            alt="Kyokushин Karate" 
            className="w-32 h-32 mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold" style={{ color: '#0c194b', fontSize: '32px' }}>Вход в систему</h1>
          <p className="text-sm text-gray-500 mt-2">Введите ваш логин и пароль для входа в систему</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login">Логин</Label>
            <Input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 disabled:opacity-50 bg-transparent border-none outline-none focus:outline-none"
                style={{ background: 'transparent', border: 'none', outline: 'none' }}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
            style={{ backgroundColor: '#0c194b', color: 'white' }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  )
}

