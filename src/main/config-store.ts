import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import type { AppSettings, WorkspaceProfile, SessionState, BrandCustomization } from '../types/index.js'

import { sealSettings, unsealSettings, validateSettings, validateWorkspace, type SettingsCodec } from './security.js'

export const DEFAULT_BRAND_CUSTOMIZATION: BrandCustomization = {
  title: 'HarnessFrame',
  badge: 'Community Preview',
  hideBadge: true,
  presetIcon: 'default',
}

const DEFAULT_WORKSPACES: WorkspaceProfile[] = [{
  id: 'ws-remote', name: 'Harness Server', mode: 'remote',
  remoteUrl: process.env.DSH_DEFAULT_SERVER_URL || 'http://127.0.0.1:8080',
  colorBadge: '#38bdf8',
}]

const DEFAULT_SETTINGS: AppSettings = {
  mode: (process.env.DSH_DEFAULT_MODE as AppSettings['mode']) || 'remote',
  managedPort: 8080,
  remoteUrl: process.env.DSH_DEFAULT_SERVER_URL || 'http://127.0.0.1:8080',
  nodePath: '',
  autoStartServer: false,
  autoProvisionDefaults: false,
  remoteSyncEnabled: false,
  launchAtStartup: false,
  theme: 'dark',
  extraArgs: '',
  activeWorkspaceId: 'ws-remote',
  workspaces: DEFAULT_WORKSPACES,
  brandCustomization: DEFAULT_BRAND_CUSTOMIZATION,
}

export class ConfigStore {
  private configPath: string
  private sessionStatePath: string
  private settings: AppSettings
  private sessionState: SessionState

  constructor() {
    const userData = app.getPath('userData')
    mkdirSync(userData, { recursive: true })
    this.configPath = join(userData, 'dsh-desktop-config.json')
    this.sessionStatePath = join(userData, 'dsh-session-state.json')
    this.settings = this.load()
    // Repair the legacy diagnostic backup, which previously copied plaintext URLs.
    const backup = join(userData, 'config.backup.json')
    if (existsSync(backup)) writeFileSync(backup, JSON.stringify(sealSettings(this.settings), null, 2), { encoding: 'utf8', mode: 0o600 })
    this.sessionState = this.loadSessionState()
  }

  public getUserDataPath(): string {
    return app.getPath('userData')
  }

  public getConfigPath(): string {
    return this.configPath
  }

  private loadSessionState(): SessionState {
    try {
      if (existsSync(this.sessionStatePath)) {
        const data = readFileSync(this.sessionStatePath, 'utf8')
        return JSON.parse(data) as SessionState
      }
    } catch {
      // ignore
    }
    return {
      lastActiveWorkspaceId: 'ws-remote',
      isSidePanelOpen: false,
      lastSidePanelTab: 'home',
    }
  }

  public getSessionState(): SessionState {
    return { ...this.sessionState }
  }

  public updateSessionState(partial: Partial<SessionState>): SessionState {
    this.sessionState = { ...this.sessionState, ...partial }
    try {
      writeFileSync(this.sessionStatePath, JSON.stringify(this.sessionState, null, 2), 'utf8')
    } catch (err) {
      console.error('[ConfigStore] Failed to write session state:', err)
    }
    return { ...this.sessionState }
  }

  private getBundledDefaults(): Partial<AppSettings> {
    try {
      const bundledPath = join(app.getAppPath(), 'bundled-config.json')
      if (existsSync(bundledPath)) {
        const data = readFileSync(bundledPath, 'utf8')
        return JSON.parse(data) as Partial<AppSettings>
      }
    } catch {
      // ignore
    }
    return {}
  }

  private load(): AppSettings {
    const bundled = this.getBundledDefaults()
    const mergedDefaults: AppSettings = { ...DEFAULT_SETTINGS, ...bundled }

    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf8')
        const parsed = JSON.parse(data)
        const loaded = { ...mergedDefaults, ...unsealSettings(parsed, this.codec()) }

        // Ensure workspaces are present
        if (!loaded.workspaces || loaded.workspaces.length === 0) {
          loaded.workspaces = DEFAULT_WORKSPACES
        }
        if (!loaded.activeWorkspaceId) {
          loaded.activeWorkspaceId = loaded.workspaces[0]?.id || 'ws-remote'
        }
        if (!loaded.brandCustomization) {
          loaded.brandCustomization = DEFAULT_BRAND_CUSTOMIZATION
        }

        // Rewrite legacy plaintext settings on first load, including workspace URLs.
        this.persist(loaded)
        return loaded
      }
    } catch (err) {
      // Do not replace an unreadable vault or silently discard existing credentials.
      throw new Error('Unable to open settings. Existing configuration was preserved.', { cause: err })
    }
    return mergedDefaults
  }

  public getSettings(): AppSettings {
    return structuredClone(this.settings)
  }

  private codec(): SettingsCodec | undefined {
    if (!safeStorage.isEncryptionAvailable()) return undefined
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') return undefined
    return {
      encrypt: value => safeStorage.encryptString(value).toString('base64'),
      decrypt: value => safeStorage.decryptString(Buffer.from(value, 'base64')),
    }
  }

  private persist(settings: AppSettings): void {
    const payload = sealSettings(settings, this.codec())
    const temporary = `${this.configPath}.tmp`
    writeFileSync(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 })
    renameSync(temporary, this.configPath)
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    validateSettings(partial)
    const next = { ...this.settings, ...partial }
    this.persist(next)
    this.settings = next
    return this.getSettings()
  }

  public getWorkspaces(): WorkspaceProfile[] {
    return structuredClone(this.settings.workspaces || DEFAULT_WORKSPACES)
  }

  public getActiveWorkspace(): WorkspaceProfile {
    const list = this.getWorkspaces()
    return list.find((w) => w.id === this.settings.activeWorkspaceId) || list[0] || DEFAULT_WORKSPACES[0]
  }

  public switchWorkspace(id: string): { success: boolean; activeWorkspace: WorkspaceProfile } {
    const list = this.getWorkspaces()
    const target = list.find((w) => w.id === id)
    if (!target) {
      return { success: false, activeWorkspace: this.getActiveWorkspace() }
    }

    // Update settings with workspace params
    this.updateSettings({
      activeWorkspaceId: target.id,
      mode: target.mode,
      managedPort: target.managedPort || this.settings.managedPort,
      remoteUrl: target.remoteUrl || this.settings.remoteUrl,
      workingDirectory: target.workingDirectory,
    })

    return { success: true, activeWorkspace: target }
  }

  public saveWorkspace(profile: WorkspaceProfile): WorkspaceProfile[] {
    validateWorkspace(profile)
    const list = [...this.getWorkspaces()]
    const idx = list.findIndex((w) => w.id === profile.id)
    if (idx >= 0) {
      list[idx] = profile
    } else {
      list.push(profile)
    }
    this.updateSettings({ workspaces: list })
    return list
  }

  public deleteWorkspace(id: string): WorkspaceProfile[] {
    let list = this.getWorkspaces().filter((w) => w.id !== id)
    if (list.length === 0) {
      list = DEFAULT_WORKSPACES
    }
    const nextActive = this.settings.activeWorkspaceId === id ? list[0].id : this.settings.activeWorkspaceId
    this.updateSettings({
      workspaces: list,
      activeWorkspaceId: nextActive,
    })
    return list
  }
}
