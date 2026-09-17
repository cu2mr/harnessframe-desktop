export type ServerMode = 'managed' | 'remote'
export type AppLanguage = 'zh-CN' | 'en'

export type ServerState = 'stopped' | 'starting' | 'running' | 'error' | 'stopping'

export interface ServerStatus {
  state: ServerState
  mode: ServerMode
  url: string | null
  port: number
  pid: number | null
  error: string | null
  startedAt: number | null
}

export type BrandPresetIcon = 'default' | 'huazhu' | 'sparkles' | 'cpu' | 'shield' | 'bot'

export interface BrandCustomization {
  title?: string
  badge?: string
  hideBadge?: boolean
  presetIcon?: BrandPresetIcon
  customLogoUrl?: string
}

export interface WorkspaceProfile {
  id: string
  name: string
  mode: ServerMode
  managedPort?: number
  remoteUrl?: string
  workingDirectory?: string
  colorBadge?: string
  description?: string
  brandCustomization?: BrandCustomization
}

export interface AppSettings {
  mode: ServerMode
  managedPort: number
  remoteUrl: string
  nodePath: string
  harnessPath?: string
  workingDirectory?: string
  autoStartServer: boolean
  launchAtStartup: boolean
  theme: 'dark' | 'light' | 'system'
  language?: AppLanguage
  extraArgs: string
  activeWorkspaceId?: string
  workspaces?: WorkspaceProfile[]
  brandCustomization?: BrandCustomization
  // Remote sync & defaults
  remoteSyncEnabled?: boolean
  remoteSyncUrl?: string
  autoProvisionDefaults?: boolean
  lastSyncTime?: number
  syncVersion?: string
}

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: 'server' | 'desktop'
}

export interface DiagnosticItem {
  id: string
  title: string
  status: 'pass' | 'warn' | 'fail' | 'checking'
  detail: string
  actionType?: 'kill-port' | 'restart' | 'kill-zombies' | 'repair-config' | 'none'
  actionData?: any
}

export interface DiagnosticReport {
  timestamp: number
  items: DiagnosticItem[]
  canAutoHeal: boolean
  recommendedAction?: string
}

export interface UpdateCheckResult {
  status?: 'available' | 'current' | 'unconfigured' | 'error'
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  releaseUrl?: string
}

export type PetType = 'robot' | 'cat' | 'dog' | 'duck' | 'owl'
export type PetMood = 'happy' | 'coding' | 'sleeping' | 'alert' | 'idle'

export interface PetState {
  type: PetType
  name: string
  level: number
  exp: number
  hunger: number
  affinity: number
  enabled: boolean
}

export interface SessionState {
  lastActiveWorkspaceId?: string
  isSidePanelOpen?: boolean
  lastSidePanelTab?: string
  lastSessionId?: string
  windowBounds?: { x?: number; y?: number; width: number; height: number }
  petState?: PetState
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  tenantId?: string
  roles?: string[]
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  provider?: 'feishu' | 'wework' | 'okta' | 'custom'
  expiresAt?: number
}

export type DlpRuleType = 'api-key' | 'private-key' | 'phone' | 'id-card' | 'private-ip' | 'secret-token'

export interface DlpMatch {
  rule: DlpRuleType
  label: string
  matchedText: string
  index: number
  length: number
}

export interface DlpScanResult {
  hasSensitiveData: boolean
  matches: DlpMatch[]
  maskedText: string
  auditAction: 'pass' | 'masked' | 'blocked'
}

export interface DlpSettings {
  enabled: boolean
  mode: 'mask' | 'warn' | 'block'
  scanApiKeys: boolean
  scanPii: boolean
  scanInternalIps: boolean
}

export interface AgentPresetAsset {
  id: string
  name?: string
  description?: string
  order?: number
  files: Record<string, string>
}

export interface TeamAssetBundle {
  version: string
  timestamp: number
  tenantName?: string
  workspaces: WorkspaceProfile[]
  customPrompts?: Array<{ id: string; title: string; prompt: string }>
  brandCustomization?: BrandCustomization
  modelsConfig?: any
  credentials?: Record<string, string>
  pluginsConfig?: any
  agentPresets?: AgentPresetAsset[]
}

export interface AssetSyncStatus {
  lastSyncTime?: number
  syncVersion?: string
  remoteSyncEnabled: boolean
  remoteSyncUrl: string
  hasLocalConfig: boolean
  modelCount: number
  presetCount: number
}

export interface DshDesktopAPI {
  isDesktop: boolean
  platform: 'darwin' | 'win32' | 'linux'
  getVersion: () => Promise<string>
  getServerStatus: () => Promise<ServerStatus>
  onServerStatusChange: (callback: (status: ServerStatus) => void) => () => void
  onServerLog: (callback: (log: LogEntry) => void) => () => void
  startServer: () => Promise<{ success: boolean; error?: string }>
  stopServer: () => Promise<{ success: boolean; error?: string }>
  restartServer: () => Promise<{ success: boolean; error?: string }>
  getLogs: () => Promise<LogEntry[]>
  clearLogs: () => Promise<void>
  testRemoteConnection: (url: string) => Promise<{ status: number }>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  openExternalUrl: (url: string) => Promise<void>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  openDirectoryDialog: () => Promise<string | null>
  setGuestView: (params: { url: string; visible?: boolean }) => Promise<void>
  setGuestViewVisible: (visible: boolean) => Promise<void>
  syncGuestViewTheme: (isDark: boolean) => Promise<void>
  syncGuestViewLanguage: (language: 'zh' | 'en') => Promise<void>
  reloadGuestView: () => Promise<void>
  setSidePanelWidth: (width: number) => Promise<boolean>
  sendNotification: (options: { title: string; body: string }) => Promise<void>
  // Phase 3: Workspaces & Multi-profile
  getWorkspaces: () => Promise<WorkspaceProfile[]>
  getActiveWorkspaceId: () => Promise<string>
  switchWorkspace: (id: string) => Promise<{ success: boolean; error?: string }>
  saveWorkspace: (profile: WorkspaceProfile) => Promise<WorkspaceProfile[]>
  deleteWorkspace: (id: string) => Promise<WorkspaceProfile[]>
  // Phase 3: External Tooling
  openInTerminal: (dirPath?: string) => Promise<boolean>
  openInEditor: (dirPath?: string) => Promise<boolean>
  // Phase 3: Diagnostics & Self-Healing
  runDiagnostics: () => Promise<DiagnosticReport>
  killPortProcess: (port: number) => Promise<boolean>
  killZombieProcesses: () => Promise<boolean>
  autoHealEnvironment: () => Promise<{ success: boolean; message: string }>
  // Phase 2: Desktop Experience Deepening
  checkForUpdates: () => Promise<UpdateCheckResult>
  getSessionState: () => Promise<SessionState>
  saveSessionState: (state: Partial<SessionState>) => Promise<SessionState>
  toggleDetachedWindow: (url?: string) => Promise<boolean>
  togglePiPWindow: (url?: string) => Promise<boolean>
  toggleFloatingPet: () => Promise<boolean>
  focusMainWindow: () => Promise<void>
  onCompanionMoodTrigger?: (callback: (data: { mood: PetMood; reason: string }) => void) => () => void
  onWorkspaceSwitchRequest: (callback: (workspaceId: string) => void) => () => void
  onToggleSidePanelRequest: (callback: () => void) => () => void
  onCheckUpdatesRequest?: (callback: () => void) => () => void
  onOpenSettingsRequest?: (callback: () => void) => () => void
  onOpenDiagnosticsRequest?: (callback: () => void) => () => void
  // Phase 2.0: Enterprise SSO, DLP & Team Assets
  getAuthState: () => Promise<AuthState>
  loginSSO: (provider: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>
  logoutSSO: () => Promise<void>
  scanDlp: (text: string) => Promise<DlpScanResult>
  getDlpSettings: () => Promise<DlpSettings>
  saveDlpSettings: (settings: Partial<DlpSettings>) => Promise<DlpSettings>
  exportTeamBundle: () => Promise<string>
  importTeamBundle: (bundleJson: string) => Promise<{ success: boolean; importedCount: number; message: string }>
  // Phase 2.5: Comprehensive Sync Methods 1, 2, 3
  exportAssetBundle: (options?: { includeCredentials?: boolean; tenantName?: string }) => Promise<{ success: boolean; data?: string; error?: string }>
  importAssetBundle: (bundleJson: string) => Promise<{ success: boolean; message: string; stats?: any }>
  syncFromRemote: (url?: string) => Promise<{ success: boolean; message: string; version?: string }>
  applyDefaultTemplates: (force?: boolean) => Promise<{ success: boolean; message: string }>
  getAssetSyncStatus: () => Promise<AssetSyncStatus>
}

declare global {
  interface Window {
    dshDesktop?: DshDesktopAPI
  }
}
