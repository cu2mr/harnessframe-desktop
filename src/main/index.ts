import { dialog, app, BrowserWindow, Notification, nativeImage } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { WindowManager } from './window-manager.js'
import { ServerManager } from './server-manager.js'
import { ConfigStore } from './config-store.js'
import { TrayManager } from './tray-manager.js'
import { MenuManager } from './menu-manager.js'
import { NotificationManager } from './notification-manager.js'
import { DiagnosticService } from './diagnostic-service.js'
import { AuthService } from './auth-service.js'
import { DlpService } from './dlp-service.js'
import { TeamSyncService } from './team-sync-service.js'
import { AssetSyncService } from './asset-sync-service.js'
import { serviceUrl } from './security.js'
import { registerIpcHandlers } from './ipc-handlers.js'

// Set the product name used by macOS Dock tooltips and application menus.
app.setName('HarnessFrame')
// Reuse data from either earlier display name; keep filenames and appId stable.
const currentUserData = app.getPath('userData')
const legacyDataCandidates = ['DSH Desktop', '华助 Think Harness'].map(name => join(app.getPath('appData'), name))
const legacyData = legacyDataCandidates.find(path => existsSync(path))
if (legacyData && !existsSync(currentUserData)) app.setPath('userData', legacyData)

// Register think:// and dsh:// protocol clients
if (app.isPackaged && !app.isDefaultProtocolClient('think')) {
  app.setAsDefaultProtocolClient('think')
}
if (app.isPackaged && !app.isDefaultProtocolClient('dsh')) {
  app.setAsDefaultProtocolClient('dsh')
}

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let windowManager: WindowManager
  let serverManager: ServerManager
  let configStore: ConfigStore
  let trayManager: TrayManager
  let menuManager: MenuManager
  let notificationManager: NotificationManager
  let diagnosticService: DiagnosticService
  let assetSyncService: AssetSyncService

  const handleDeepLink = async (rawUrl: string) => {
    if (!rawUrl) return
    try {
      console.log('[Main] Processing connection request')
      windowManager?.show()
      const parsed = new URL(rawUrl)
      if (!['dsh:', 'think:'].includes(parsed.protocol)) return
      if (parsed.hostname === 'workspace' && parsed.pathname === '/switch') {
        const id = parsed.searchParams.get('id')
        if (id && configStore) {
          const { success } = configStore.switchWorkspace(id)
          if (success) {
            void serverManager?.restart(configStore.getSettings())
          }
        }
      } else if (parsed.hostname === 'connect') {
        const targetUrl = parsed.searchParams.get('url')
        if (targetUrl && configStore) {
          const url = serviceUrl(targetUrl)
          const choice = await dialog.showMessageBox({ type: 'question', buttons: ['取消', '连接'], defaultId: 0, cancelId: 0, message: '连接到新的 Harness 服务？', detail: url.origin })
          if (choice.response !== 1) return
          configStore.updateSettings({ mode: 'remote', remoteUrl: url.toString() })
          void serverManager?.restart(configStore.getSettings())
        }
      }
    } catch (err) {
      console.warn('[Main] Failed to parse deep link:', err)
    }
  }

  // Handle second instance launch (Windows / Linux deep links)
  app.on('second-instance', (_event, commandLine) => {
    const win = windowManager?.getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }

    const deepUrl = commandLine.find((arg) => arg.startsWith('dsh://') || arg.startsWith('think://'))
    if (deepUrl) {
      handleDeepLink(deepUrl)
    }
  })

  // Handle open-url on macOS (deep links)
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.whenReady().then(async () => {
    configStore = new ConfigStore()
    serverManager = new ServerManager({ getAppPath: () => app.getAppPath(), resourcesPath: process.resourcesPath })
    windowManager = new WindowManager(configStore)
    trayManager = new TrayManager(windowManager, serverManager, configStore)
    menuManager = new MenuManager(windowManager, serverManager, configStore)

    notificationManager = new NotificationManager(windowManager)
    diagnosticService = new DiagnosticService(serverManager, configStore, windowManager)
    const authService = new AuthService()
    const dlpService = new DlpService()
    const teamSyncService = new TeamSyncService(configStore)
    assetSyncService = new AssetSyncService(configStore)

    registerIpcHandlers(
      windowManager,
      serverManager,
      configStore,
      notificationManager,
      diagnosticService,
      menuManager,
      authService,
      dlpService,
      teamSyncService,
      assetSyncService
    )

    windowManager.createMainWindow()
    trayManager.init()
    menuManager.init()

    // Provisioning and remote configuration import are explicit user actions.
    const settings = configStore.getSettings()

    // Set official Dock icon on macOS
    if (process.platform === 'darwin' && app.dock) {
      const candidates = [
        join(app.getAppPath(), 'build/icon.png'),
        join(app.getAppPath(), 'src/renderer/src/assets/logo.png'),
        join(process.resourcesPath, 'build/icon.png'),
        join(process.resourcesPath, 'icon.png'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) {
          try {
            const iconImg = nativeImage.createFromPath(c)
            if (!iconImg.isEmpty()) {
              app.dock.setIcon(iconImg)
              break
            }
          } catch (e) {
            console.warn('[Main] Failed to set dock icon:', e)
          }
        }
      }
    }

    if (settings.autoStartServer) {
      void serverManager.start(settings)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow()
      } else {
        windowManager.show()
      }
    })
  }).catch(error => {
    dialog.showErrorBox('Unable to start HarnessFrame', String(error?.message || error))
    app.exit(1)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  let isQuitting = false
  app.on('before-quit', async (event) => {
    event.preventDefault()
    if (!isQuitting) {
      isQuitting = true
      windowManager?.setQuitting(true)
      try {
        const result = await serverManager?.stop()
        if (result && !result.success) throw new Error(result.error || 'Harness did not stop')
        trayManager?.destroy()
        app.exit(0)
      } catch (err) {
        isQuitting = false
        windowManager?.setQuitting(false)
        dialog.showErrorBox('HarnessFrame 无法安全退出',
          `本地 Harness 进程尚未确认退出，请重试。${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
}
