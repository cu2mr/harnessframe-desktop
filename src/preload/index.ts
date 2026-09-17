// Use CommonJS require for standard Electron preload sandbox compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron')
import type { DshDesktopAPI, ServerStatus, LogEntry, AppSettings } from '../types/index.js'

const desktopAPI: DshDesktopAPI = {
  isDesktop: true,
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getServerStatus: () => ipcRenderer.invoke('server:status'),
  onServerStatusChange: (callback: (status: ServerStatus) => void) => {
    const subscription = (_event: any, status: ServerStatus) => callback(status)
    ipcRenderer.on('server:status-changed', subscription)
    return () => {
      ipcRenderer.removeListener('server:status-changed', subscription)
    }
  },
  onServerLog: (callback: (log: LogEntry) => void) => {
    const subscription = (_event: any, log: LogEntry) => callback(log)
    ipcRenderer.on('server:log-added', subscription)
    return () => {
      ipcRenderer.removeListener('server:log-added', subscription)
    }
  },
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  restartServer: () => ipcRenderer.invoke('server:restart'),
  getLogs: () => ipcRenderer.invoke('server:get-logs'),
  clearLogs: () => ipcRenderer.invoke('server:clear-logs'),
  testRemoteConnection: (url: string) => ipcRenderer.invoke('server:test-remote', url),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings),
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory'),
  setGuestView: (params: { url: string; visible?: boolean }) => ipcRenderer.invoke('view:set', params),
  setGuestViewVisible: (visible: boolean) => ipcRenderer.invoke('view:setVisible', visible),
  syncGuestViewTheme: (isDark: boolean) => ipcRenderer.invoke('view:syncTheme', isDark),
  syncGuestViewLanguage: (language: 'zh' | 'en') => ipcRenderer.invoke('view:syncLanguage', language),
  reloadGuestView: () => ipcRenderer.invoke('view:reload'),
  setSidePanelWidth: (width: number) => ipcRenderer.invoke('view:set-side-panel', width),
  sendNotification: (options: { title: string; body: string }) => ipcRenderer.invoke('notification:send', options),
  // Phase 3: Workspaces & Multi-Profile
  getWorkspaces: () => ipcRenderer.invoke('workspace:list'),
  getActiveWorkspaceId: () => ipcRenderer.invoke('workspace:active-id'),
  switchWorkspace: (id: string) => ipcRenderer.invoke('workspace:switch', id),
  saveWorkspace: (profile: any) => ipcRenderer.invoke('workspace:save', profile),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  // Phase 3: Developer Tools Integration
  openInTerminal: (dirPath?: string) => ipcRenderer.invoke('tool:open-terminal', dirPath),
  openInEditor: (dirPath?: string) => ipcRenderer.invoke('tool:open-editor', dirPath),
  // Phase 3: Diagnostics & Self-Healing
  runDiagnostics: () => ipcRenderer.invoke('diagnostic:run'),
  killPortProcess: (port: number) => ipcRenderer.invoke('diagnostic:kill-port', port),
  killZombieProcesses: () => ipcRenderer.invoke('diagnostic:kill-zombies'),
  autoHealEnvironment: () => ipcRenderer.invoke('diagnostic:auto-heal'),
  // Phase 2: Desktop Experience Deepening
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  getSessionState: () => ipcRenderer.invoke('session:get-state'),
  saveSessionState: (state: any) => ipcRenderer.invoke('session:save-state', state),
  toggleDetachedWindow: (url?: string) => ipcRenderer.invoke('window:toggle-detached', url),
  togglePiPWindow: (url?: string) => ipcRenderer.invoke('window:toggle-pip', url),
  toggleFloatingPet: () => ipcRenderer.invoke('window:toggle-floating-pet'),
  focusMainWindow: () => ipcRenderer.invoke('window:focus-main'),
  onCompanionMoodTrigger: (callback: (data: { mood: any; reason: string }) => void) => {
    const sub = (_event: any, data: { mood: any; reason: string }) => callback(data)
    ipcRenderer.on('companion:mood-trigger', sub)
    return () => {
      ipcRenderer.removeListener('companion:mood-trigger', sub)
    }
  },
  onWorkspaceSwitchRequest: (callback: (workspaceId: string) => void) => {
    const sub = (_event: any, id: string) => callback(id)
    ipcRenderer.on('workspace:switch-request', sub)
    return () => {
      ipcRenderer.removeListener('workspace:switch-request', sub)
    }
  },
  onToggleSidePanelRequest: (callback: () => void) => {
    const sub = () => callback()
    ipcRenderer.on('view:toggle-side-panel', sub)
    return () => {
      ipcRenderer.removeListener('view:toggle-side-panel', sub)
    }
  },
  onCheckUpdatesRequest: (callback: () => void) => {
    const sub = () => callback()
    ipcRenderer.on('app:check-updates', sub)
    return () => {
      ipcRenderer.removeListener('app:check-updates', sub)
    }
  },
  onOpenSettingsRequest: (callback: () => void) => {
    const sub = () => callback()
    ipcRenderer.on('app:open-settings', sub)
    return () => {
      ipcRenderer.removeListener('app:open-settings', sub)
    }
  },
  onOpenDiagnosticsRequest: (callback: () => void) => {
    const sub = () => callback()
    ipcRenderer.on('app:open-diagnostics', sub)
    return () => {
      ipcRenderer.removeListener('app:open-diagnostics', sub)
    }
  },
  // Phase 2.0: Enterprise SSO, DLP & Team Assets
  getAuthState: () => ipcRenderer.invoke('auth:get-state'),
  loginSSO: (provider: string) => ipcRenderer.invoke('auth:login-sso', provider),
  logoutSSO: () => ipcRenderer.invoke('auth:logout'),
  scanDlp: (text: string) => ipcRenderer.invoke('dlp:scan', text),
  getDlpSettings: () => ipcRenderer.invoke('dlp:get-settings'),
  saveDlpSettings: (settings: any) => ipcRenderer.invoke('dlp:save-settings', settings),
  exportTeamBundle: () => ipcRenderer.invoke('team:export-bundle'),
  importTeamBundle: (bundleJson: string) => ipcRenderer.invoke('team:import-bundle', bundleJson),
  // Phase 2.5: Comprehensive Sync Methods 1, 2, 3
  exportAssetBundle: (options?: { includeCredentials?: boolean; tenantName?: string }) =>
    ipcRenderer.invoke('assets:export', options),
  importAssetBundle: (bundleJson: string) => ipcRenderer.invoke('assets:import', bundleJson),
  syncFromRemote: (url?: string) => ipcRenderer.invoke('assets:sync-remote', url),
  applyDefaultTemplates: (force?: boolean) => ipcRenderer.invoke('assets:provision-defaults', force),
  getAssetSyncStatus: () => ipcRenderer.invoke('assets:get-sync-status'),
}

try {
  contextBridge.exposeInMainWorld('dshDesktop', desktopAPI)
} catch (error) {
  console.error('[Preload] Failed to expose dshDesktop API to main world:', error)
}
