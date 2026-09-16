import { Notification, app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { WindowManager } from './window-manager.js'

export class NotificationManager {
  constructor(private windowManager: WindowManager) {}

  public show(title: string, body: string, onClick?: () => void): void {
    if (!Notification.isSupported()) return

    const iconPath = this.getIconPath()
    const notification = new Notification({
      title,
      body,
      icon: iconPath || undefined,
      silent: false,
    })

    notification.on('click', () => {
      if (onClick) {
        onClick()
      } else {
        this.windowManager.show()
      }
    })

    notification.show()
  }

  public updateDockBadge(badge: string): void {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setBadge(badge)
    }
  }

  private getIconPath(): string {
    const candidates = [
      join(app.getAppPath(), 'dist/renderer/logo.png'),
      join(app.getAppPath(), 'build/icon.png'),
      join(process.resourcesPath, 'icon.png'),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return ''
  }
}
