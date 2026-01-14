export async function startSync() {
  if (window.electronAPI) {
    await window.electronAPI.sync.start()
  }
}

export async function getSyncStatus(): Promise<string> {
  if (window.electronAPI) {
    return await window.electronAPI.sync.getStatus()
  }
  return 'not_available'
}






