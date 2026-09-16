import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { serviceUrl, parseBundle, redactSecrets } from './security.js'
import { newerVersion, repositoryName } from './updates.js'
import releaseConfig from '../../release.config.json'
import { type IpcMainInvokeEvent, ipcMain, shell, dialog, app } from 'electron'
import type { WindowManager } from './window-manager.js'
import type { ServerManager } from './server-manager.js'
import type { ConfigStore } from './config-store.js'
import type { NotificationManager } from './notification-manager.js'
import type { DiagnosticService } from './diagnostic-service.js'
import type { MenuManager } from './menu-manager.js'
import type { AuthService } from './auth-service.js'
import type { DlpService } from './dlp-service.js'
import type { TeamSyncService } from './team-sync-service.js'
import type { AssetSyncService } from './asset-sync-service.js'
import type { AppSettings, SessionState, UpdateCheckResult, DlpSettings } from '../types/index.js'

export function registerIpcHandlers(
  windowManager: WindowManager,
  serverManager: ServerManager,
  configStore: ConfigStore,
  notificationManager: NotificationManager,
  diagnosticService: DiagnosticService,
  menuManager?: MenuManager,
  authService?: AuthService,
  dlpService?: DlpService,
  teamSyncService?: TeamSyncService,
  assetSyncService?: AssetSyncService
): void {
  const handle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!windowManager.isTrustedSender(event)) throw new Error('Untrusted IPC sender')
      return listener(event, ...args)
    })
  }
  // App info
  handle('app:get-version', () => app.getVersion())

  // Server management
  handle('server:status', () => serverManager.getStatus())

  handle('server:start', async () => {
    const settings = configStore.getSettings()
    return serverManager.start(settings)
  })

  handle('server:stop', async () => {
    windowManager.setGuestViewVisible(false)
    return serverManager.stop()
  })

  handle('server:restart', async () => {
    const settings = configStore.getSettings()
    return serverManager.restart(settings)
  })

  handle('server:get-logs', () => serverManager.getLogs())

  handle('server:clear-logs', () => {
    serverManager.clearLogs()
    return true
  })

  // Settings
  handle('settings:get', () => configStore.getSettings())

  handle('settings:save', async (_event, partial: Partial<AppSettings>) => {
    const prevSettings = configStore.getSettings()
    const updated = configStore.updateSettings(partial)
    try {
      await serverManager.applySettings(updated, prevSettings)
    } catch (err) {
      console.error('[IPC] Failed to apply settings to serverManager:', err)
    }
    windowManager.syncActiveBrandToGuestView()
    return updated
  })

  // WebContentsView Controls
  handle('view:set', (_event, params: { url: string; visible?: boolean }) => {
    windowManager.setGuestViewUrl(params.url, params.visible ?? true)
  })

  handle('view:setVisible', (_event, visible: boolean) => {
    windowManager.setGuestViewVisible(visible)
  })

  handle('view:syncTheme', (_event, isDark: boolean) => {
    windowManager.syncThemeToGuestView(isDark)
  })

  handle('view:reload', () => {
    windowManager.reloadGuestView()
  })

  handle('view:set-side-panel', (_event, width: number) => {
    windowManager.setSidePanelWidth(width)
    return true
  })

  // Notifications
  handle('notification:send', (_event, options: { title: string; body: string }) => {
    notificationManager.show(options.title, options.body)
  })

  // Shell & Dialogs
  handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(serviceUrl(url).toString())
  })

  handle('dialog:open-directory', async () => {
    const win = windowManager.getMainWindow()
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  // Window controls
  handle('window:minimize', () => {
    windowManager.minimize()
  })

  handle('window:maximize', () => {
    windowManager.maximize()
  })

  handle('window:close', () => {
    windowManager.close()
  })

  // Phase 2: Detached Window & PiP Mini Mode
  handle('window:toggle-detached', (_event, targetUrl?: string) => {
    return windowManager.toggleDetachedWindow(targetUrl)
  })

  handle('window:toggle-pip', (_event, targetUrl?: string) => {
    return windowManager.togglePiPWindow(targetUrl)
  })

  handle('window:toggle-floating-pet', () => {
    return windowManager.toggleFloatingPet()
  })

  handle('window:focus-main', () => {
    windowManager.focusMainWindow()
  })

  // Phase 3: Workspace & Multi-Profile
  handle('workspace:list', () => configStore.getWorkspaces())

  handle('workspace:active-id', () => configStore.getActiveWorkspace().id)

  handle('workspace:switch', async (_event, id: string) => {
    const wasRunning = serverManager.getStatus().state === 'running'
    const { success, activeWorkspace } = configStore.switchWorkspace(id)
    if (success && activeWorkspace) {
      const updated = configStore.getSettings()
      if (wasRunning) {
        try {
          await serverManager.restart(updated)
        } catch (err) {
          console.error('[IPC] Error restarting server on workspace switch:', err)
        }
      } else {
        windowManager.setGuestViewVisible(false)
      }
    }
    menuManager?.updateMenu()
    return { success, activeWorkspace }
  })

  handle('workspace:save', (_event, profile: any) => {
    const res = configStore.saveWorkspace(profile)
    windowManager.syncActiveBrandToGuestView()
    menuManager?.updateMenu()
    return res
  })

  handle('workspace:delete', (_event, id: string) => {
    windowManager.destroyWorkspaceViewport(id)
    const res = configStore.deleteWorkspace(id)
    menuManager?.updateMenu()
    return res
  })

  // Phase 2: Session state persistence & Update checking
  handle('session:get-state', () => configStore.getSessionState())

  handle('session:save-state', (_event, partial: Partial<SessionState>) => {
    return configStore.updateSessionState(partial)
  })

  handle('app:check-updates', async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion()
    const repository = repositoryName(releaseConfig.repository)
    if (!repository) return { status: 'unconfigured', hasUpdate: false, currentVersion, releaseNotes: '此构建尚未配置发布仓库。' }
    const releaseUrl = `https://github.com/${repository}/releases`
    try {
      const res = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=20`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'harnessframe-desktop' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const releases: any = await res.json()
      if (!Array.isArray(releases)) throw new Error('Invalid release response')
      const eligible = releases.filter(r => !r.draft && (releaseConfig.channel === 'preview' || !r.prerelease) && typeof r.tag_name === 'string')
      const latest = eligible.reduce((best, item) => !best || newerVersion(item.tag_name, best.tag_name) ? item : best, undefined)
      if (!latest) throw new Error('No published releases')
      const hasUpdate = newerVersion(latest.tag_name, currentVersion)
      return { status: hasUpdate ? 'available' : 'current', hasUpdate, currentVersion, latestVersion: latest.tag_name.replace(/^v/, ''), releaseUrl, releaseNotes: latest.body || '请查看发行说明。' }
    } catch {
      return { status: 'error', hasUpdate: false, currentVersion, releaseUrl, releaseNotes: '无法确认最新版本，请稍后重试。' }
    }
  })

  const directory = (input?: string): string => {
    const path = input || configStore.getSettings().workingDirectory || process.cwd()
    if (typeof path !== 'string' || !isAbsolute(path) || !statSync(path).isDirectory()) throw new Error('Invalid directory')
    return path
  }
  handle('tool:open-terminal', async (_event, dirPath?: string) => {
    const target = directory(dirPath)
    const { execFile } = await import('node:child_process')
    if (process.platform === 'darwin') {
      return new Promise<boolean>(resolve => execFile('open', ['-a', 'Terminal', target], error => resolve(!error)))
    }
    // Open the directory on Windows; do not interpolate paths into cmd.exe.
    return !(await shell.openPath(target))
  })
  handle('tool:open-editor', async (_event, dirPath?: string) => {
    const target = directory(dirPath)
    const { execFile } = await import('node:child_process')
    return new Promise<boolean>(resolve => {
      execFile('code', [target], { shell: false }, async error => resolve(error ? !(await shell.openPath(target)) : true))
    })
  })

  // Phase 3: Diagnostics & Self-Healing
  handle('diagnostic:run', () => diagnosticService.runDiagnostics())

  handle('diagnostic:kill-port', (_event, port: number) => diagnosticService.killPortProcess(port))

  handle('diagnostic:kill-zombies', () => diagnosticService.killZombieProcesses())

  handle('diagnostic:auto-heal', () => diagnosticService.autoHealEnvironment())

  // Phase 2.0: Enterprise SSO & Authentication
  handle('auth:get-state', () => authService?.getAuthState() || { isAuthenticated: false, user: null })

  handle('auth:login-sso', async (_event, provider: string) => {
    return authService?.loginWithProvider(provider) || { success: false, error: 'AuthService 未初始化' }
  })

  handle('auth:logout', () => {
    authService?.logout()
    return true
  })

  // Phase 2.0: Enterprise DLP (Data Loss Prevention)
  handle('dlp:get-settings', () => dlpService?.getSettings() || {
    enabled: true,
    mode: 'mask',
    scanApiKeys: true,
    scanPii: true,
    scanInternalIps: true,
  })

  handle('dlp:save-settings', (_event, partial: Partial<DlpSettings>) => {
    if (!partial || typeof partial !== 'object') throw new Error('Invalid text scanner settings')
    if (partial.mode !== undefined && !['mask', 'warn', 'block'].includes(partial.mode)) throw new Error('Invalid text scanner mode')
    for (const key of ['enabled', 'scanApiKeys', 'scanPii', 'scanInternalIps'] as const) {
      if (partial[key] !== undefined && typeof partial[key] !== 'boolean') throw new Error('Invalid text scanner setting')
    }
    return dlpService?.updateSettings(partial)
  })

  handle('dlp:scan', (_event, text: string) => {
    if (typeof text !== 'string' || text.length > 200_000) throw new Error('Text sample is too large')
    return dlpService?.scan(text) || {
      hasSensitiveData: false,
      matches: [],
      maskedText: text,
      auditAction: 'pass',
    }
  })

  // Phase 2.0: Team Assets Cloud Sync & Bundle Export
  handle('team:export-bundle', () => {
    return teamSyncService?.exportBundle() || '{}'
  })

  handle('team:import-bundle', async (_event, bundleJson: string) => {
    const result = await assetSyncService?.importAssetBundle(bundleJson)
    menuManager?.updateMenu()
    return { ...result, importedCount: result?.stats?.workspacesImported || 0 }
  })

  // Phase 2.5: Comprehensive Enterprise Asset Sync (Methods 1, 2, 3)
  handle('assets:export', async (_event, options?: { includeCredentials?: boolean; tenantName?: string }) => {
    if (!assetSyncService) {
      return { success: false, error: 'AssetSyncService 未初始化' }
    }
    return assetSyncService.exportAssetBundle(options)
  })

  handle('assets:import', async (_event, bundleJson: string) => {
    if (!assetSyncService) {
      return { success: false, message: 'AssetSyncService 未初始化', stats: {} }
    }
    const result = await assetSyncService.importAssetBundle(bundleJson)
    menuManager?.updateMenu()
    windowManager.syncActiveBrandToGuestView()
    return result
  })

  handle('assets:sync-remote', async (_event, url?: string) => {
    if (!assetSyncService) {
      return { success: false, message: 'AssetSyncService 未初始化' }
    }
    const result = await assetSyncService.syncFromRemote(url)
    menuManager?.updateMenu()
    windowManager.syncActiveBrandToGuestView()
    return result
  })

  handle('assets:provision-defaults', async (_event, force?: boolean) => {
    if (!assetSyncService) {
      return { success: false, message: 'AssetSyncService 未初始化' }
    }
    const res = await assetSyncService.provisionDefaultTemplates(force ?? false)
    return { success: res.provisioned, message: res.message }
  })

  handle('assets:get-sync-status', async () => {
    if (!assetSyncService) {
      return {
        remoteSyncEnabled: true,
        remoteSyncUrl: '',
        hasLocalConfig: false,
        modelCount: 0,
        presetCount: 0,
      }
    }
    return assetSyncService.getSyncStatus()
  })

  // Setup main -> renderer event streaming & Notification triggers
  serverManager.onStatusChange((status) => {
    const win = windowManager.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('server:status-changed', status)

      // Broadcast companion mood trigger based on lifecycle
      if (status.state === 'starting') {
        win.webContents.send('companion:mood-trigger', { mood: 'coding', reason: '正在拉起 Harness 核心引擎...' })
      } else if (status.state === 'running') {
        win.webContents.send('companion:mood-trigger', { mood: 'happy', reason: '引擎就绪，开始高效协作！' })
      } else if (status.state === 'error') {
        win.webContents.send('companion:mood-trigger', { mood: 'alert', reason: '服务遇到错误，进入戒备状态。' })
      } else if (status.state === 'stopped') {
        win.webContents.send('companion:mood-trigger', { mood: 'idle', reason: '服务离线待机中。' })
      }
    }

    if (status.state === 'running' && status.url) {
      windowManager.setGuestViewUrl(status.url, true)
      notificationManager.updateDockBadge('')

      // Notify if backgrounded
      if (win && (!win.isFocused() || !win.isVisible())) {
        notificationManager.show(
          'HarnessFrame 服务就绪',
          status.mode === 'managed'
            ? `本地引擎已拉起并监听端口 :${status.port}`
            : '已成功连通远程 DeepSeek Harness 实例！'
        )
      }
    } else if (status.state === 'error') {
      windowManager.setGuestViewVisible(false)
      notificationManager.updateDockBadge('!')
      notificationManager.show(
        'HarnessFrame 服务异常',
        status.error || '后台进程遇到问题并退出，请查看日志排查。'
      )
    } else if (status.state === 'stopped') {
      windowManager.setGuestViewVisible(false)
      notificationManager.updateDockBadge('')
    }
  })

  serverManager.onLog((log) => {
    const win = windowManager.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('server:log-added', log)

      if (log.level === 'error') {
        win.webContents.send('companion:mood-trigger', {
          mood: 'alert',
          reason: `系统检测到异常: ${log.message.slice(0, 40)}...`,
        })
      }
    }
  })
}
