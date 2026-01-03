import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase, closeDatabase } from './database'
import { employeeQueries } from './database/queries/employees'
import { clientQueries } from './database/queries/clients'
import { groupQueries } from './database/queries/groups'
import { lessonQueries, attendanceQueries } from './database/queries/lessons'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function setupIpcHandlers() {
  ipcMain.handle('db:employees:getAll', () => employeeQueries.getAll())
  ipcMain.handle('db:employees:getById', (_, id) => employeeQueries.getById(id))
  ipcMain.handle('db:employees:create', (_, data) => employeeQueries.create(data))
  ipcMain.handle('db:employees:update', (_, id, data) => employeeQueries.update(id, data))
  ipcMain.handle('db:employees:delete', (_, id) => employeeQueries.delete(id))

  ipcMain.handle('db:clients:getAll', () => clientQueries.getAll())
  ipcMain.handle('db:clients:getById', (_, id) => clientQueries.getById(id))
  ipcMain.handle('db:clients:search', (_, query) => clientQueries.search(query))
  ipcMain.handle('db:clients:getDebtors', (_, days) => clientQueries.getDebtors(days))
  ipcMain.handle('db:clients:create', (_, data) => clientQueries.create(data))
  ipcMain.handle('db:clients:update', (_, id, data) => clientQueries.update(id, data))
  ipcMain.handle('db:clients:updatePaymentDate', (_, id, date) => clientQueries.updatePaymentDate(id, date))
  ipcMain.handle('db:clients:delete', (_, id) => clientQueries.delete(id))
  ipcMain.handle('db:clients:addParent', (_, clientId, data) => clientQueries.addParent(clientId, data))
  ipcMain.handle('db:clients:removeParent', (_, parentId) => clientQueries.removeParent(parentId))

  ipcMain.handle('db:groups:getAll', () => groupQueries.getAll())
  ipcMain.handle('db:groups:getById', (_, id) => groupQueries.getById(id))
  ipcMain.handle('db:groups:create', (_, data) => groupQueries.create(data))
  ipcMain.handle('db:groups:update', (_, id, data) => groupQueries.update(id, data))
  ipcMain.handle('db:groups:delete', (_, id) => groupQueries.delete(id))
  ipcMain.handle('db:groups:addSchedule', (_, groupId, data) => groupQueries.addSchedule(groupId, data))
  ipcMain.handle('db:groups:updateSchedule', (_, scheduleId, data) => groupQueries.updateSchedule(scheduleId, data))
  ipcMain.handle('db:groups:removeSchedule', (_, scheduleId) => groupQueries.removeSchedule(scheduleId))
  ipcMain.handle('db:groups:addMember', (_, groupId, clientId) => groupQueries.addMember(groupId, clientId))
  ipcMain.handle('db:groups:removeMember', (_, groupId, clientId) => groupQueries.removeMember(groupId, clientId))
  ipcMain.handle('db:groups:getScheduleForDay', (_, day) => groupQueries.getScheduleForDay(day))

  ipcMain.handle('db:lessons:getAll', (_, filters) => lessonQueries.getAll(filters))
  ipcMain.handle('db:lessons:getById', (_, id) => lessonQueries.getById(id))
  ipcMain.handle('db:lessons:getByDate', (_, date) => lessonQueries.getByDate(date))
  ipcMain.handle('db:lessons:getTodayLessons', () => lessonQueries.getTodayLessons())
  ipcMain.handle('db:lessons:create', (_, data) => lessonQueries.create(data))
  ipcMain.handle('db:lessons:generateFromSchedule', (_, groupId, startDate, endDate) => 
    lessonQueries.generateFromSchedule(groupId, startDate, endDate))
  ipcMain.handle('db:lessons:delete', (_, id) => lessonQueries.delete(id))

  ipcMain.handle('db:attendance:getByLesson', (_, lessonId) => attendanceQueries.getByLesson(lessonId))
  ipcMain.handle('db:attendance:updateStatus', (_, lessonId, clientId, status) => 
    attendanceQueries.updateStatus(lessonId, clientId, status))
  ipcMain.handle('db:attendance:getClientAttendance', (_, clientId, startDate, endDate) => 
    attendanceQueries.getClientAttendance(clientId, startDate, endDate))
  ipcMain.handle('db:attendance:getStatsByGroup', (_, groupId) => attendanceQueries.getStatsByGroup(groupId))

  ipcMain.handle('sync:start', () => {
    return Promise.resolve()
  })

  ipcMain.handle('sync:status', () => {
    return Promise.resolve('idle')
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase()
  setupIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

