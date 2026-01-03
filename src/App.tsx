import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { Dashboard } from './pages/Dashboard'
import { Clients } from './pages/Clients'
import { Groups } from './pages/Groups'
import { Lessons } from './pages/Lessons'
import { Employees } from './pages/Employees'
import { Settings } from './pages/Settings'
import { Toaster } from './components/ui/toaster'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="groups" element={<Groups />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="employees" element={<Employees />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  )
}
