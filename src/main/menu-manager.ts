import { app, Menu, MenuItemConstructorOptions, shell } from 'electron'
import type { WindowManager } from './window-manager.js'
import type { ServerManager } from './server-manager.js'
import type { ConfigStore } from './config-store.js'

export class MenuManager {
  constructor(
    private windowManager: WindowManager,
    private serverManager: ServerManager,
    private configStore: ConfigStore
  ) {}

  public init(): void {
    this.updateMenu()
  }

  public updateMenu(): void {
    const isMac = process.platform === 'darwin'
    const workspaces = this.configStore.getWorkspaces()
    const activeWorkspaceId = this.configStore.getSettings().activeWorkspaceId

    const workspaceMenuItems: MenuItemConstructorOptions[] = workspaces.map((ws, idx) => {
      const accelerator = idx < 9 ? `CmdOrCtrl+${idx + 1}` : undefined
      const isChecked = ws.id === activeWorkspaceId
      return {
        label: `${ws.name} (${ws.mode === 'managed' ? `:${ws.managedPort || 8080}` : '远程'})`,
        type: 'radio' as const,
        checked: isChecked,
        accelerator,
        click: () => {
          this.configStore.switchWorkspace(ws.id)
          const win = this.windowManager.getMainWindow()
          win?.webContents.send('workspace:switch-request', ws.id)
        },
      }
    })

    const template: MenuItemConstructorOptions[] = [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                {
                  label: 'Preferences...',
                  accelerator: 'CmdOrCtrl+,',
                  click: () => {
                    this.windowManager.show()
                    const win = this.windowManager.getMainWindow()
                    win?.webContents.send('app:open-settings', 'general')
                  },
                },
                {
                  label: '企业协同与安全合规 (SSO / DLP)...',
                  accelerator: 'CmdOrCtrl+Shift+E',
                  click: () => {
                    this.windowManager.show()
                    const win = this.windowManager.getMainWindow()
                    win?.webContents.send('app:open-settings', 'enterprise')
                  },
                },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const },
              ],
            },
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Web UI in Browser',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => {
              const status = this.serverManager.getStatus()
              if (status.url) void shell.openExternal(status.url)
            },
          },
          ...(!isMac
            ? [
                { type: 'separator' as const },
                {
                  label: 'Preferences...',
                  accelerator: 'CmdOrCtrl+,',
                  click: () => {
                    this.windowManager.show()
                    const win = this.windowManager.getMainWindow()
                    win?.webContents.send('app:open-settings', 'general')
                  },
                },
                {
                  label: '企业协同与安全合规 (SSO / DLP)...',
                  accelerator: 'CmdOrCtrl+Shift+E',
                  click: () => {
                    this.windowManager.show()
                    const win = this.windowManager.getMainWindow()
                    win?.webContents.send('app:open-settings', 'enterprise')
                  },
                },
              ]
            : []),
          { type: 'separator' as const },
          isMac ? { role: 'close' as const } : { role: 'quit' as const },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          {
            label: '切换侧边生产力面板',
            accelerator: 'CmdOrCtrl+B',
            click: () => {
              const win = this.windowManager.getMainWindow()
              win?.webContents.send('view:toggle-side-panel')
            },
          },
          {
            label: '查看实时服务日志',
            accelerator: 'CmdOrCtrl+L',
            click: () => {
              const win = this.windowManager.getMainWindow()
              win?.webContents.send('app:open-logs')
            },
          },
          {
            label: '环境自检与诊断向导',
            accelerator: 'CmdOrCtrl+D',
            click: () => {
              const win = this.windowManager.getMainWindow()
              win?.webContents.send('app:open-diagnostics')
            },
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Workspaces',
        submenu: [
          ...workspaceMenuItems,
          { type: 'separator' },
          {
            label: '管理工作空间...',
            click: () => {
              this.windowManager.show()
              const win = this.windowManager.getMainWindow()
              win?.webContents.send('app:manage-workspaces')
            },
          },
        ],
      },
      {
        label: 'Server',
        submenu: [
          {
            label: 'Start Server',
            click: () => {
              const settings = this.configStore.getSettings()
              void this.serverManager.start(settings)
            },
          },
          {
            label: 'Stop Server',
            click: () => {
              void this.serverManager.stop()
            },
          },
          {
            label: 'Restart Server',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => {
              const settings = this.configStore.getSettings()
              void this.serverManager.restart(settings)
            },
          },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(isMac
            ? [
                { type: 'separator' as const },
                { role: 'front' as const },
                { type: 'separator' as const },
                { role: 'window' as const },
              ]
            : [{ role: 'close' as const }]),
        ],
      },
      {
        role: 'help',
        submenu: [
          {
            label: '检查版本更新...',
            click: () => {
              const win = this.windowManager.getMainWindow()
              win?.webContents.send('app:check-updates')
            },
          },
          { type: 'separator' },
          {
            label: 'DeepSeek Harness 上游项目',
            click: () => {
              void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness')
            },
          },
          {
            label: 'DeepSeek Harness 架构文档',
            click: () => {
              void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness')
            },
          },
          {
            label: '关于 HarnessFrame...',
            click: () => {
              this.windowManager.show()
            },
          },
        ],
      },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }
}
