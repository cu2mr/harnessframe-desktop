import { serviceUrl, sameOrigin, redactText } from './security.js'
import { BrowserWindow, WebContentsView, shell, app, session, nativeImage, nativeTheme, screen, type NativeImage, type WebContents, type IpcMainInvokeEvent } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ConfigStore } from './config-store.js'
import type { BrandCustomization, BrandPresetIcon } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private guestView: WebContentsView | null = null
  private viewportPool: Map<string, WebContentsView> = new Map()
  private activeWorkspaceId: string = 'default'
  private maxCachedViewports: number = 5
  private detachedWindow: BrowserWindow | null = null
  private pipWindow: BrowserWindow | null = null
  private petWindow: BrowserWindow | null = null
  private isQuitting: boolean = false
  private guestUrl: string | null = null
  private isDark: boolean = true
  private sidePanelWidth: number = 0
  private boundsTimer: NodeJS.Timeout | null = null
  private isGuestVisible: boolean = false

  constructor(private configStore?: ConfigStore) {
    const theme = configStore?.getSettings().theme
    this.isDark =
      theme === 'dark' ||
      (theme === 'system' && nativeTheme.shouldUseDarkColors) ||
      theme === undefined
  }

  private trustedOrigins = new Map<number, string>()
  private pendingUrls = new Map<number, string>()

  public isTrustedSender(event: IpcMainInvokeEvent): boolean {
    const contents = event.sender
    if (contents !== this.mainWindow?.webContents && contents !== this.petWindow?.webContents) return false
    if (!event.senderFrame || event.senderFrame !== contents.mainFrame) return false
    const actual = new URL(event.senderFrame.url)
    const dev = process.env.VITE_DEV_SERVER_URL
    if (!app.isPackaged && dev) return sameOrigin(actual.href, dev)
    return actual.protocol === 'file:' && fileURLToPath(actual) === join(__dirname, '../renderer/index.html')
  }

  private protectShell(contents: WebContents): void {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', event => event.preventDefault())
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
  }

  private protectRemote(contents: WebContents, url?: string): void {
    if (url) this.trustedOrigins.set(contents.id, serviceUrl(url).origin)
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
    contents.setWindowOpenHandler(({ url }) => {
      try { void shell.openExternal(serviceUrl(url).toString()).catch(() => {}) } catch {}
      return { action: 'deny' }
    })
    const guard = (event: Electron.Event, target: string) => {
      const trusted = this.trustedOrigins.get(contents.id)
      if (!trusted || !sameOrigin(target, trusted)) event.preventDefault()
    }
    contents.on('will-navigate', guard)
    contents.on('will-redirect', guard)
    contents.on('destroyed', () => {
      this.trustedOrigins.delete(contents.id)
      this.pendingUrls.delete(contents.id)
    })
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public getGuestView(): WebContentsView | null {
    return this.guestView
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting
  }

  public createMainWindow(): BrowserWindow {
    const isMac = process.platform === 'darwin'
    const sessionState = this.configStore?.getSessionState()
    const savedBounds = sessionState?.windowBounds

    const iconCandidates = [
      join(app.getAppPath(), 'build/icon.png'),
      join(app.getAppPath(), 'src/renderer/src/assets/logo.png'),
      join(process.resourcesPath, 'build/icon.png'),
      join(process.resourcesPath, 'icon.png'),
    ]

    let appIcon: NativeImage | undefined
    for (const c of iconCandidates) {
      if (existsSync(c)) {
        try {
          const img = nativeImage.createFromPath(c)
          if (!img.isEmpty()) {
            appIcon = img
            break
          }
        } catch {}
      }
    }

    this.mainWindow = new BrowserWindow({
      width: savedBounds?.width || 1280,
      height: savedBounds?.height || 860,
      x: savedBounds?.x,
      y: savedBounds?.y,
      minWidth: 900,
      minHeight: 600,
      title: 'HarnessFrame',
      icon: appIcon,
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
      backgroundColor: '#0f172a',
      show: false,
      webPreferences: {
        preload: existsSync(join(__dirname, '../preload/index.cjs'))
          ? join(__dirname, '../preload/index.cjs')
          : join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        spellcheck: false,
      },
    })

    this.protectShell(this.mainWindow.webContents)
    this.mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error('[MainWindow] Preload error in', preloadPath, error)
    })

    this.mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(redactText(`[Renderer:${level}] ${message} (${sourceId}:${line})`))
    })

    // Initialize modern WebContentsView pool for active workspace
    this.activeWorkspaceId = this.configStore?.getActiveWorkspace().id || 'default'
    this.guestView = this.createGuestWebContentsView(this.activeWorkspaceId)
    this.viewportPool.set(this.activeWorkspaceId, this.guestView)
    this.isGuestVisible = false

    // Dynamic Bounds for WebContentsView (HeaderBar = 48px, Right Side Panel)
    const handleBoundsChange = () => {
      this.updateGuestBounds()
      if (this.boundsTimer) clearTimeout(this.boundsTimer)
      this.boundsTimer = setTimeout(() => {
        if (!this.mainWindow || this.mainWindow.isMaximized() || this.mainWindow.isMinimized()) return
        const b = this.mainWindow.getBounds()
        this.configStore?.updateSessionState({ windowBounds: b })
      }, 500)
    }

    this.mainWindow.on('resize', handleBoundsChange)
    this.mainWindow.on('move', handleBoundsChange)
    this.mainWindow.on('maximize', () => this.updateGuestBounds())
    this.mainWindow.on('unmaximize', () => this.updateGuestBounds())

    this.mainWindow.once('ready-to-show', () => {
      this.updateGuestBounds()
      this.mainWindow?.show()
    })

    // Intercept window close for Close-to-Tray常驻
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault()
        this.mainWindow?.hide()
      }
    })

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      this.guestView = null
      for (const view of this.viewportPool.values()) {
        try {
          ;(view.webContents as any).close?.()
        } catch {}
      }
      this.viewportPool.clear()
    })

    // Load Host Shell UI
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (devUrl) {
      void this.mainWindow.loadURL(devUrl)
    } else {
      void this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return this.mainWindow
  }

  private createGuestWebContentsView(workspaceId: string): WebContentsView {
    const partition = `persist:dsh_${workspaceId}`
    const view = new WebContentsView({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    })

    this.protectRemote(view.webContents)

    // Apply the persisted desktop theme before and after the remote app hydrates.
    // The second pass keeps Harness UI state from overwriting the initial value.
    view.webContents.on('dom-ready', () => {
      this.syncThemeToGuestView(this.isDark, view)
    })
    view.webContents.on('did-finish-load', () => {
      this.syncThemeToGuestView(this.isDark, view)
      this.syncActiveBrandToGuestView(workspaceId, view)
    })

    return view
  }

  public switchWorkspaceViewport(workspaceId: string, url?: string, isDark?: boolean): void {
    if (isDark !== undefined) {
      this.isDark = isDark
    }

    if (!this.mainWindow) return

    // Hide previous view from view hierarchy
    if (this.guestView && this.activeWorkspaceId !== workspaceId) {
      try {
        this.guestView.setVisible(false)
        this.guestView.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        if (this.mainWindow.contentView.children.includes(this.guestView)) {
          this.mainWindow.contentView.removeChildView(this.guestView)
        }
      } catch {}
    }

    this.activeWorkspaceId = workspaceId
    if (url) {
      serviceUrl(url)
      this.guestUrl = url
    }

    let targetView = this.viewportPool.get(workspaceId)
    if (!targetView) {
      // LRU cache eviction if pool reaches max capacity
      if (this.viewportPool.size >= this.maxCachedViewports) {
        const oldestKey = this.viewportPool.keys().next().value
        if (oldestKey && oldestKey !== workspaceId) {
          const evicted = this.viewportPool.get(oldestKey)
          if (evicted) {
            try {
              if (this.mainWindow.contentView.children.includes(evicted)) {
                this.mainWindow.contentView.removeChildView(evicted)
              }
              ;(evicted.webContents as any).close?.()
            } catch {}
            this.viewportPool.delete(oldestKey)
          }
        }
      }

      targetView = this.createGuestWebContentsView(workspaceId)
      this.viewportPool.set(workspaceId, targetView)
    }

    this.guestView = targetView

    // Load or navigate if url is supplied and differs
    if (url) {
      const normalized = serviceUrl(url).toString()
      const contents = targetView.webContents
      if (contents.getURL() !== normalized && this.pendingUrls.get(contents.id) !== normalized) {
        this.trustedOrigins.set(contents.id, serviceUrl(normalized).origin)
        this.pendingUrls.set(contents.id, normalized)
        void contents.loadURL(normalized)
          .catch(error => this.addNavigationError(normalized, error))
          .finally(() => {
            if (this.pendingUrls.get(contents.id) === normalized) this.pendingUrls.delete(contents.id)
          })
      }
    }

    // Only attach and show if isGuestVisible is true
    if (this.isGuestVisible) {
      try {
        if (!this.mainWindow.contentView.children.includes(targetView)) {
          this.mainWindow.contentView.addChildView(targetView)
        }
        this.updateGuestBounds()
        targetView.setVisible(true)
      } catch {}
    }

    this.syncThemeToGuestView(this.isDark, targetView)
    this.syncActiveBrandToGuestView(workspaceId, targetView)
  }

  public destroyWorkspaceViewport(workspaceId: string): void {
    const view = this.viewportPool.get(workspaceId)
    if (view) {
      if (this.mainWindow) {
        try {
          if (this.mainWindow.contentView.children.includes(view)) {
            this.mainWindow.contentView.removeChildView(view)
          }
        } catch {}
      }
      try {
        ;(view.webContents as any).close?.()
      } catch {}
      this.viewportPool.delete(workspaceId)
      if (this.activeWorkspaceId === workspaceId) {
        this.guestView = null
      }
    }
  }

  private addNavigationError(url: string, error: unknown): void {
    const origin = (() => {
      try { return serviceUrl(url).origin } catch { return 'invalid URL' }
    })()
    console.warn(`[WindowManager] Failed to load ${origin}:`, error)
  }

  public updateGuestBounds(): void {
    if (!this.mainWindow || !this.guestView || !this.isGuestVisible) return
    const bounds = this.mainWindow.getContentBounds()
    const titlebarHeight = 48
    const effectiveWidth = Math.max(0, bounds.width - this.sidePanelWidth)
    this.guestView.setBounds({
      x: 0,
      y: titlebarHeight,
      width: effectiveWidth,
      height: Math.max(0, bounds.height - titlebarHeight),
    })
  }

  public setSidePanelWidth(width: number): void {
    this.sidePanelWidth = Math.max(0, width)
    this.updateGuestBounds()
  }

  public setGuestViewUrl(url: string, visible = true, workspaceId?: string): void {
    const targetWsId = workspaceId || this.activeWorkspaceId
    this.isGuestVisible = visible
    this.switchWorkspaceViewport(targetWsId, url, this.isDark)
    this.setGuestViewVisible(visible)
  }

  public setGuestViewVisible(visible: boolean): void {
    this.isGuestVisible = visible
    if (!this.mainWindow) return

    if (!visible) {
      // Robust hide on macOS: remove all views from contentView and zero bounds so modals show
      for (const view of this.viewportPool.values()) {
        try {
          view.setVisible(false)
          view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
          if (this.mainWindow.contentView.children.includes(view)) {
            this.mainWindow.contentView.removeChildView(view)
          }
        } catch {}
      }
    } else if (this.guestView) {
      // Re-attach and show active view
      try {
        if (!this.mainWindow.contentView.children.includes(this.guestView)) {
          this.mainWindow.contentView.addChildView(this.guestView)
        }
        this.updateGuestBounds()
        this.guestView.setVisible(true)
      } catch {}
    }
  }

  public syncThemeToGuestView(isDark: boolean, targetView?: WebContentsView): void {
    this.isDark = isDark
    const view = targetView || this.guestView
    if (!view || !view.webContents.getURL() || view.webContents.isLoadingMainFrame()) return
    const script = `
      (function() {
        try {
          const isDark = ${isDark};
          if (isDark) {
            document.body.setAttribute('data-ds-dark-theme', '');
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
            localStorage.setItem('dsh.theme', 'dark');
          } else {
            document.body.removeAttribute('data-ds-dark-theme');
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            localStorage.setItem('dsh.theme', 'light');
          }
          window.dispatchEvent(new StorageEvent('storage', { key: 'dsh.theme', newValue: isDark ? 'dark' : 'light' }));
        } catch (e) {
          console.warn('[dsh-theme-sync]', e);
        }
      })();
    `
    try {
      void view.webContents.executeJavaScript(script)
    } catch {
      // ignore
    }
  }

  private getPresetIconSvg(preset?: BrandPresetIcon, customLogoUrl?: string): string {
    if (customLogoUrl) {
      const normalizedLogoUrl = serviceUrl(customLogoUrl).toString()
      return `<img src="${normalizedLogoUrl.replace(/"/g, '&quot;')}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;" />`
    }
    switch (preset) {
      case 'huazhu':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hz-b-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#hz-b-grad)"/><path d="M6 7v10M11 7v10M6 12h5M14 8h4.5l-4.5 8h4.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      case 'sparkles':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sp-b-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs><path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z" fill="url(#sp-b-grad)"/><path d="M19 16l1 2.5L22.5 19.5 20 20.5 19 23l-1-2.5-2.5-1 2.5-1L19 16z" fill="#f59e0b"/></svg>`
      case 'cpu':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" fill="#0284c7" fill-opacity="0.25"/><rect x="9" y="9" width="6" height="6" fill="#38bdf8"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>`
      case 'shield':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#10b981" fill-opacity="0.25"/><path d="M9 12l2 2 4-4"/></svg>`
      case 'bot':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="3" fill="#6366f1" fill-opacity="0.25"/><circle cx="12" cy="5" r="2" fill="#818cf8"/><path d="M12 7v4M8 16h.01M16 16h.01M2 16h1M21 16h1"/></svg>`
      case 'default':
      default:
        return ''
    }
  }

  public syncBrandToGuestView(brand?: BrandCustomization, targetView?: WebContentsView): void {
    const view = targetView || this.guestView
    if (!view || !view.webContents.getURL() || view.webContents.isLoadingMainFrame()) return
    const markHtml = this.getPresetIconSvg(brand?.presetIcon, brand?.customLogoUrl)
    const title = brand?.title ?? ''
    const badge = brand?.badge ?? ''
    const hideBadge = Boolean(brand?.hideBadge)

    const script = `
      (function() {
        try {
          const brandTitle = ${JSON.stringify(title)};
          const brandBadge = ${JSON.stringify(badge)};
          const hideBadge = ${hideBadge};
          const markHtml = ${JSON.stringify(markHtml)};

          function updateBrandDom() {
            // 1. Title
            if (brandTitle) {
              const titles = document.querySelectorAll('[class*="localBuildTitle"], [class*="fallbackBrandName"]');
              titles.forEach(function(el) {
                if (el.textContent !== brandTitle) {
                  el.textContent = brandTitle;
                }
              });
              if (document.title && (document.title.includes('DSH') || document.title.includes('本地构建'))) {
                document.title = document.title.replace(/DSH.*本地构建|DSH Local Build/g, brandTitle);
              }
            }

            // 2. Badge
            const badges = document.querySelectorAll('[class*="buildVersion"]');
            badges.forEach(function(el) {
              if (hideBadge) {
                if (el.style.display !== 'none') el.style.display = 'none';
              } else {
                if (el.style.display === 'none') el.style.display = '';
                if (brandBadge && el.textContent !== brandBadge) {
                  el.textContent = brandBadge;
                }
              }
            });

            // 3. Brand Mark
            if (markHtml) {
              const marks = document.querySelectorAll('[class*="brandMark"], [class*="railMark"]');
              marks.forEach(function(el) {
                if (el.dataset.brandMarkCode !== markHtml) {
                  el.dataset.brandMarkCode = markHtml;
                  el.innerHTML = markHtml;
                }
              });
            }
          }

          updateBrandDom();

          if (window.__dsh_brand_observer) {
            try { window.__dsh_brand_observer.disconnect(); } catch (e) {}
          }
          const obs = new MutationObserver(updateBrandDom);
          obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
          window.__dsh_brand_observer = obs;
        } catch (e) {
          console.warn('[dsh-brand-sync]', e);
        }
      })();
    `
    try {
      void view.webContents.executeJavaScript(script)
    } catch {
      // ignore
    }
  }

  public syncActiveBrandToGuestView(workspaceId?: string, targetView?: WebContentsView): void {
    const wsId = workspaceId || this.activeWorkspaceId
    const ws = this.configStore?.getWorkspaces().find((w) => w.id === wsId)
    const brand = ws?.brandCustomization || this.configStore?.getSettings().brandCustomization
    this.syncBrandToGuestView(brand, targetView)
  }

  public reloadGuestView(): void {
    this.guestView?.webContents.reload()
  }

  public minimize(): void {
    this.mainWindow?.minimize()
  }

  public maximize(): void {
    if (!this.mainWindow) return
    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow.maximize()
    }
  }

  public close(): void {
    this.mainWindow?.close()
  }

  public show(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.show()
      this.mainWindow.focus()
    } else {
      this.createMainWindow()
    }
  }

  public toggleDetachedWindow(targetUrl?: string): boolean {
    if (this.detachedWindow && !this.detachedWindow.isDestroyed()) {
      if (this.detachedWindow.isMinimized()) this.detachedWindow.restore()
      this.detachedWindow.focus()
      return true
    }

    const url = targetUrl || this.guestUrl
    if (!url) return false
    serviceUrl(url)

    this.detachedWindow = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 640,
      minHeight: 480,
      title: 'HarnessFrame · 独立工作台视图',
      backgroundColor: this.isDark ? '#0f172a' : '#f8fafc',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.protectRemote(this.detachedWindow.webContents, url)
    void this.detachedWindow.loadURL(url)

    this.detachedWindow.on('closed', () => {
      this.detachedWindow = null
    })

    return true
  }

  public togglePiPWindow(targetUrl?: string): boolean {
    if (this.pipWindow && !this.pipWindow.isDestroyed()) {
      this.pipWindow.close()
      this.pipWindow = null
      return false
    }

    const url = targetUrl || this.guestUrl
    if (!url) return false
    serviceUrl(url)

    const { workArea } = screen.getPrimaryDisplay()
    const pipWidth = 400
    const pipHeight = 300

    this.pipWindow = new BrowserWindow({
      width: pipWidth,
      height: pipHeight,
      x: workArea.x + workArea.width - pipWidth - 20,
      y: workArea.y + workArea.height - pipHeight - 20,
      alwaysOnTop: true,
      frame: false,
      roundedCorners: true,
      title: 'HarnessFrame · 画中画监视器',
      backgroundColor: this.isDark ? '#0f172a' : '#f8fafc',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.protectRemote(this.pipWindow.webContents, url)
    void this.pipWindow.loadURL(url)

    this.pipWindow.on('closed', () => {
      this.pipWindow = null
    })

    return true
  }

  public toggleFloatingPet(): boolean {
    if (this.petWindow && !this.petWindow.isDestroyed()) {
      this.petWindow.close()
      this.petWindow = null
      return false
    }

    const { workArea } = screen.getPrimaryDisplay()
    const petWidth = 220
    const petHeight = 300

    const preloadPath = existsSync(join(__dirname, '../preload/index.cjs'))
      ? join(__dirname, '../preload/index.cjs')
      : join(__dirname, '../preload/index.js')

    this.petWindow = new BrowserWindow({
      width: petWidth,
      height: petHeight,
      x: workArea.x + workArea.width - petWidth - 30,
      y: workArea.y + workArea.height - petHeight - 30,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      title: 'Codex 桌面悬浮小宠物',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.protectShell(this.petWindow.webContents)
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (devUrl) {
      void this.petWindow.loadURL(`${devUrl}#pet-floating`)
    } else {
      void this.petWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'pet-floating' })
    }

    this.petWindow.on('closed', () => {
      this.petWindow = null
    })

    return true
  }

  public focusMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }
}
