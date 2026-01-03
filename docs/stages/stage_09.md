# Этап 9: Синхронизация

**Срок: 2-3 дня**

---

## Цель этапа

Реализовать механизм синхронизации локальных данных с удалённым сервером: отправка изменений, получение обновлений, обработка конфликтов.

---

## Шаги выполнения

### 9.1 Создание конфигурации синхронизации

**Файл `electron/sync/config.ts`:**
```typescript
export const SYNC_CONFIG = {
  apiUrl: process.env.SYNC_API_URL || 'https://api.example.com',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}

export const SYNC_ENDPOINTS = {
  employees: '/sync/employees',
  clients: '/sync/clients',
  groups: '/sync/groups',
  lessons: '/sync/lessons',
  attendance: '/sync/attendance'
}
```

### 9.2 Создание сервиса синхронизации

**Файл `electron/sync/syncService.ts`:**
```typescript
import { getDatabase } from '../database'
import { SYNC_CONFIG, SYNC_ENDPOINTS } from './config'

interface SyncResult {
  success: boolean
  synced: number
  errors: string[]
}

interface PendingRecord {
  id: number
  table_name: string
  data: string
  updated_at: string
}

export class SyncService {
  private db = getDatabase()

  async syncAll(): Promise<SyncResult> {
    const results: SyncResult = {
      success: true,
      synced: 0,
      errors: []
    }

    const tables = ['employees', 'clients', 'groups', 'lessons', 'attendance']

    for (const table of tables) {
      try {
        const tableResult = await this.syncTable(table)
        results.synced += tableResult.synced
        results.errors.push(...tableResult.errors)
      } catch (error) {
        results.success = false
        results.errors.push(`Ошибка синхронизации ${table}: ${error}`)
      }
    }

    this.logSync(results)
    return results
  }

  private async syncTable(tableName: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, errors: [] }

    const pendingRecords = this.db.prepare(`
      SELECT * FROM ${tableName} WHERE sync_status = 'pending'
    `).all()

    if (pendingRecords.length === 0) {
      return result
    }

    const endpoint = SYNC_ENDPOINTS[tableName as keyof typeof SYNC_ENDPOINTS]
    
    try {
      const response = await fetch(`${SYNC_CONFIG.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: pendingRecords }),
        signal: AbortSignal.timeout(SYNC_CONFIG.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const serverData = await response.json()
      
      await this.processServerResponse(tableName, serverData, pendingRecords)
      result.synced = pendingRecords.length

    } catch (error) {
      result.success = false
      result.errors.push(`${tableName}: ${error}`)
    }

    return result
  }

  private async processServerResponse(
    tableName: string, 
    serverData: any, 
    localRecords: any[]
  ): Promise<void> {
    const updateStatus = this.db.prepare(`
      UPDATE ${tableName} SET sync_status = 'synced' WHERE id = ?
    `)

    const transaction = this.db.transaction(() => {
      for (const record of localRecords) {
        const serverRecord = serverData.synced?.find((s: any) => s.local_id === record.id)
        
        if (serverRecord) {
          updateStatus.run(record.id)
          
          if (serverRecord.server_id && serverRecord.server_id !== record.id) {
            this.db.prepare(`
              UPDATE ${tableName} SET server_id = ? WHERE id = ?
            `).run(serverRecord.server_id, record.id)
          }
        }
      }

      if (serverData.updates) {
        this.applyServerUpdates(tableName, serverData.updates)
      }
    })

    transaction()
  }

  private applyServerUpdates(tableName: string, updates: any[]): void {
    for (const update of updates) {
      const existing = this.db.prepare(`
        SELECT * FROM ${tableName} WHERE server_id = ?
      `).get(update.id)

      if (existing) {
        if (new Date(update.updated_at) > new Date((existing as any).updated_at)) {
          this.updateLocalRecord(tableName, update)
        }
      } else {
        this.insertLocalRecord(tableName, update)
      }
    }
  }

  private updateLocalRecord(tableName: string, data: any): void {
    const columns = Object.keys(data).filter(k => k !== 'id')
    const setClause = columns.map(c => `${c} = @${c}`).join(', ')
    
    this.db.prepare(`
      UPDATE ${tableName} SET ${setClause}, sync_status = 'synced' 
      WHERE server_id = @id
    `).run(data)
  }

  private insertLocalRecord(tableName: string, data: any): void {
    const columns = Object.keys(data)
    const placeholders = columns.map(c => `@${c}`).join(', ')
    
    this.db.prepare(`
      INSERT INTO ${tableName} (${columns.join(', ')}, sync_status) 
      VALUES (${placeholders}, 'synced')
    `).run(data)
  }

  private logSync(result: SyncResult): void {
    this.db.prepare(`
      INSERT INTO sync_log (status, details) VALUES (?, ?)
    `).run(
      result.success ? 'success' : 'error',
      JSON.stringify({
        synced: result.synced,
        errors: result.errors,
        timestamp: new Date().toISOString()
      })
    )
  }

  getLastSyncInfo(): { date: string | null; status: string | null } {
    const lastSync = this.db.prepare(`
      SELECT sync_date, status FROM sync_log ORDER BY id DESC LIMIT 1
    `).get() as { sync_date: string; status: string } | undefined

    return {
      date: lastSync?.sync_date || null,
      status: lastSync?.status || null
    }
  }

  getPendingCount(): number {
    const tables = ['employees', 'clients', 'groups', 'lessons', 'attendance']
    let total = 0

    for (const table of tables) {
      const count = this.db.prepare(`
        SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'
      `).get() as { count: number }
      total += count.count
    }

    return total
  }
}

let syncService: SyncService | null = null

export function getSyncService(): SyncService {
  if (!syncService) {
    syncService = new SyncService()
  }
  return syncService
}
```

### 9.3 Добавление IPC-хендлеров для синхронизации

**Добавить в `electron/main.ts`:**
```typescript
import { getSyncService } from './sync/syncService'

function setupSyncHandlers() {
  ipcMain.handle('sync:start', async () => {
    const syncService = getSyncService()
    return syncService.syncAll()
  })

  ipcMain.handle('sync:status', () => {
    const syncService = getSyncService()
    return {
      lastSync: syncService.getLastSyncInfo(),
      pendingCount: syncService.getPendingCount()
    }
  })

  ipcMain.handle('sync:pending-count', () => {
    const syncService = getSyncService()
    return syncService.getPendingCount()
  })
}

app.whenReady().then(() => {
  initDatabase()
  setupIpcHandlers()
  setupSyncHandlers()
  createWindow()
})
```

### 9.4 Создание Zustand store для синхронизации

**Файл `src/stores/syncStore.ts`:**
```typescript
import { create } from 'zustand'

interface SyncState {
  isSyncing: boolean
  lastSyncDate: string | null
  lastSyncStatus: string | null
  pendingCount: number
  error: string | null
  
  fetchStatus: () => Promise<void>
  startSync: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncDate: null,
  lastSyncStatus: null,
  pendingCount: 0,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await window.electronAPI.sync.getStatus() as any
      set({
        lastSyncDate: status.lastSync?.date,
        lastSyncStatus: status.lastSync?.status,
        pendingCount: status.pendingCount
      })
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    }
  },

  startSync: async () => {
    set({ isSyncing: true, error: null })
    try {
      const result = await window.electronAPI.sync.start() as any
      set({
        isSyncing: false,
        lastSyncStatus: result.success ? 'success' : 'error',
        lastSyncDate: new Date().toISOString(),
        pendingCount: 0
      })
      
      if (!result.success) {
        set({ error: result.errors.join(', ') })
      }
    } catch (error) {
      set({
        isSyncing: false,
        error: 'Ошибка синхронизации',
        lastSyncStatus: 'error'
      })
    }
  }
}))
```

### 9.5 Обновление Header с индикатором синхронизации

**Файл `src/components/layout/Header.tsx`:**
```typescript
import { useEffect } from 'react'
import { RefreshCw, Wifi, WifiOff, Check, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSyncStore } from '@/stores/syncStore'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { 
    isSyncing, 
    lastSyncDate, 
    lastSyncStatus, 
    pendingCount,
    fetchStatus, 
    startSync 
  } = useSyncStore()
  
  const isOnline = navigator.onLine

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const formatLastSync = () => {
    if (!lastSyncDate) return 'Никогда'
    const date = new Date(lastSyncDate)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Только что'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`
    return date.toLocaleDateString('ru-RU')
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-slate-400" />
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  {lastSyncStatus === 'success' && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                  {lastSyncStatus === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {!lastSyncStatus && (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-slate-600">{formatLastSync()}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Последняя синхронизация</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {pendingCount} изменений
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={startSync}
            disabled={isSyncing || !isOnline}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>
    </header>
  )
}
```

### 9.6 Страница настроек синхронизации

**Файл `src/pages/Settings.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSyncStore } from '@/stores/syncStore'
import { RefreshCw, Server, Database, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export function Settings() {
  const { toast } = useToast()
  const { 
    isSyncing, 
    lastSyncDate, 
    lastSyncStatus, 
    pendingCount,
    startSync 
  } = useSyncStore()
  
  const [apiUrl, setApiUrl] = useState('')

  const handleSync = async () => {
    await startSync()
    toast({
      title: 'Синхронизация завершена',
      description: `Синхронизировано записей: ${pendingCount}`
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Настройки" subtitle="Конфигурация приложения" />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Синхронизация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Статус синхронизации</p>
                  <p className="text-sm text-slate-500">
                    Последняя: {lastSyncDate 
                      ? new Date(lastSyncDate).toLocaleString('ru-RU')
                      : 'Никогда'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lastSyncStatus === 'success' ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Успешно
                    </Badge>
                  ) : lastSyncStatus === 'error' ? (
                    <Badge className="bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3 mr-1" />
                      Ошибка
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Не синхронизировано</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Несинхронизированные изменения</p>
                  <p className="text-sm text-slate-500">
                    Ожидают отправки на сервер
                  </p>
                </div>
                <Badge variant={pendingCount > 0 ? 'destructive' : 'secondary'}>
                  {pendingCount} записей
                </Badge>
              </div>

              <Button 
                onClick={handleSync} 
                disabled={isSyncing}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                База данных
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium">Локальная база данных</p>
                <p className="text-sm text-slate-500">
                  SQLite • Все данные хранятся локально
                </p>
              </div>
              
              <p className="text-sm text-slate-500">
                Приложение работает полностью офлайн. Синхронизация 
                происходит только по вашему запросу.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

---

## Проверка успешности этапа

- [ ] Кнопка синхронизации в Header работает
- [ ] Индикатор статуса отображается
- [ ] Счётчик pending изменений обновляется
- [ ] Синхронизация отправляет данные (при наличии API)
- [ ] Лог синхронизации записывается
- [ ] Страница настроек показывает статус
- [ ] Обработка ошибок работает

---

## Результат этапа

Система синхронизации:
- Отправка локальных изменений на сервер
- Получение обновлений с сервера
- Индикатор статуса в Header
- Счётчик несинхронизированных изменений
- Лог синхронизации
- Страница настроек с информацией

