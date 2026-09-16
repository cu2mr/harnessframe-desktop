import { Tray, Menu, nativeImage, shell, app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { WindowManager } from './window-manager.js'
import type { ServerManager } from './server-manager.js'
import type { ConfigStore } from './config-store.js'

export class TrayManager {
  private tray: Tray | null = null

  constructor(
    private windowManager: WindowManager,
    private serverManager: ServerManager,
    private configStore: ConfigStore
  ) {}

  public init(): void {
    const iconPath = this.getTrayIconPath()
    let icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      // Fallback 16x16 transparent image
      icon = nativeImage.createEmpty()
    }
    // Resize for crisp tray icon on macOS/Windows
    if (process.platform === 'darwin') {
      icon = icon.resize({ width: 18, height: 18 })
      icon.setTemplateImage(true)
    }

    try {
      this.tray = new Tray(icon)
      this.tray.setToolTip('DeepSeek Harness')

      this.updateContextMenu()

      this.tray.on('click', () => {
        this.windowManager.show()
      })

      this.tray.on('double-click', () => {
        this.windowManager.show()
      })

      this.serverManager.onStatusChange(() => {
        this.updateContextMenu()
      })
    } catch (err) {
      console.warn('[TrayManager] Failed to initialize tray:', err)
    }
  }

  private getTrayIconPath(): string {
    const candidates = [
      join(app.getAppPath(), 'dist/renderer/logo.png'),
      join(app.getAppPath(), 'build/icon.png'),
      join(process.resourcesPath, 'build/icon.png'),
      join(process.resourcesPath, 'icon.png'),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return ''
  }

  public updateContextMenu(): void {
    if (!this.tray) return

    const status = this.serverManager.getStatus()
    const isRunning = status.state === 'running'
    const statusLabel = isRunning
      ? `🟢 运行中 (${status.mode === 'managed' ? `端口 :${status.port}` : '远程实例'})`
      : status.state === 'starting'
      ? '🟡 正在连接 / 启动中...'
      : status.state === 'error'
      ? '🔴 服务异常'
      : '⚪ 已停止'

    this.tray.setToolTip(`HarnessFrame - ${statusLabel}`)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `HarnessFrame · ${statusLabel}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '显示主工作台窗口',
        click: () => this.windowManager.show(),
      },
      {
        label: '在默认浏览器中打开',
        enabled: isRunning && !!status.url,
        click: () => {
          if (status.url) void shell.openExternal(status.url)
        },
      },
      { type: 'separator' },
      {
        label: isRunning ? '重启后台服务' : '启动服务',
        click: () => {
          const settings = this.configStore.getSettings()
          if (isRunning) {
            void this.serverManager.restart(settings)
          } else {
            void this.serverManager.start(settings)
          }
        },
      },
      {
        label: '停止后台服务',
        enabled: isRunning,
        click: () => {
          void this.serverManager.stop()
        },
      },
      { type: 'separator' },
      {
        label: '退出 HarnessFrame',
        click: () => {
          this.windowManager.setQuitting(true)
          app.quit()
        },
      },
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
