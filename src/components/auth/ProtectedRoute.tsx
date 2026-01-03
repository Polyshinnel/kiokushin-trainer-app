import { Navigate } from 'react-router-dom'

interface SessionData {
  employeeId: number
  fullName: string
  login: string
  expiresAt: string
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const sessionStr = localStorage.getItem('auth_session')
  
  if (!sessionStr) {
    return <Navigate to="/login" replace />
  }

  try {
    const session: SessionData = JSON.parse(sessionStr)
    const expiresAt = new Date(session.expiresAt)
    
    if (expiresAt < new Date()) {
      localStorage.removeItem('auth_session')
      return <Navigate to="/login" replace />
    }

    return <>{children}</>
  } catch {
    localStorage.removeItem('auth_session')
    return <Navigate to="/login" replace />
  }
}

