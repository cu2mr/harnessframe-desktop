import React, { useState, useEffect } from 'react'
import type {
  AppSettings,
  ServerStatus,
  AuthState,
  DlpSettings,
  DlpScanResult,
  BrandCustomization,
  BrandPresetIcon,
  AssetSyncStatus,
} from '@shared-types/index.js'
import {
  X, Server, Globe, Cpu, FolderOpen, Save, RefreshCw, Sun, Moon, Monitor,
  Shield, Lock, Users, CheckCircle2, AlertTriangle, Download, Upload, Copy, Check,
  Palette, Eye, Bot, Sparkles, Layers, Cloud, Database, FileText, CheckCircle
} from 'lucide-react'

const renderPresetIconOnly = (preset?: string) => {
  switch (preset) {
    case 'huazhu':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="hz-p-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#hz-p-grad)" />
          <path d="M6 7v10M11 7v10M6 12h5M14 8h4.5l-4.5 8h4.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="sp-p-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z" fill="url(#sp-p-grad)" />
          <path d="M19 16l1 2.5L22.5 19.5 20 20.5 19 23l-1-2.5-2.5-1 2.5-1L19 16z" fill="#f59e0b" />
        </svg>
      )
    case 'cpu':
      return <Cpu size={20} className="text-sky-400" />
    case 'shield':
      return <Shield size={20} className="text-emerald-400" />
    case 'bot':
      return <Bot size={20} className="text-indigo-400" />
    case 'default':
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-sky-500">
          <path d="M2 12c2-4 6-6 10-6 3.5 0 6.5 1.5 8.5 4-1 1-2.5 1.5-4 1.5-2 0-3.5-1-5-1-2 0-3.5 1-5 1-1.5 0-3-.5-4.5-1.5z" />
        </svg>
      )
  }
}

const renderBrandMarkPreview = (brand?: BrandCustomization) => {
  if (brand?.customLogoUrl) {
    return <img src={brand.customLogoUrl} alt="Logo" className="w-5 h-5 object-contain rounded" />
  }
  return renderPresetIconOnly(brand?.presetIcon || 'huazhu')
}

interface Props {
  isOpen: boolean
  status: ServerStatus
  isDark?: boolean
  initialTab?: 'general' | 'brand' | 'sync' | 'enterprise'
  onClose: () => void
  onSaved: () => void
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  status,
  isDark: isDarkProp,
  initialTab = 'general',
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'brand' | 'sync' | 'enterprise'>(initialTab)
  const [settings, setSettings] = useState<AppSettings>({
    mode: 'remote',
    managedPort: 8080,
    remoteUrl: 'http://127.0.0.1:8080',
    nodePath: '',
    autoStartServer: false,
    launchAtStartup: false,
    theme: 'dark',
    extraArgs: '',
    remoteSyncEnabled: true,
    remoteSyncUrl: 'https://config.example.com/harness.json',
    autoProvisionDefaults: true,
  })
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)

  // Enterprise SSO state
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, user: null })
  // DLP State
  const [dlpSettings, setDlpSettings] = useState<DlpSettings>({
    enabled: true,
    mode: 'mask',
    scanApiKeys: true,
    scanPii: true,
    scanInternalIps: true,
  })
  const [dlpTestInput, setDlpTestInput] = useState('')
  const [dlpTestResult, setDlpTestResult] = useState<DlpScanResult | null>(null)

  // Team Sync State
  const [teamSyncMsg, setTeamSyncMsg] = useState<string | null>(null)
  const [importJsonText, setImportJsonText] = useState('')

  // Asset Sync Comprehensive (Method 1, 2, 3) State
  const [syncStatus, setSyncStatus] = useState<AssetSyncStatus | null>(null)
  const [syncingRemote, setSyncingRemote] = useState(false)
  const [remoteSyncResult, setRemoteSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [exportIncludeCreds, setExportIncludeCreds] = useState(false)
  const [exportedJsonText, setExportedJsonText] = useState('')
  const [exportSuccess, setExportSuccess] = useState(false)
  const [importingAssets, setImportingAssets] = useState(false)
  const [assetImportInput, setAssetImportInput] = useState('')
  const [assetImportMsg, setAssetImportMsg] = useState<{ success: boolean; message: string } | null>(null)
  const [provisioningDefaults, setProvisioningDefaults] = useState(false)
  const [provisionMsg, setProvisionMsg] = useState<string | null>(null)

  const reloadSyncStatus = () => {
    if (window.dshDesktop?.getAssetSyncStatus) {
      void window.dshDesktop.getAssetSyncStatus().then(setSyncStatus)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    if (initialTab) {
      setActiveTab(initialTab)
    }
    if (window.dshDesktop) {
      void window.dshDesktop.getSettings().then((s) => {
        if (s) setSettings((prev) => ({ ...prev, ...s }))
      })
      void window.dshDesktop.getAuthState().then((a) => {
        if (a) setAuthState(a)
      })
      void window.dshDesktop.getDlpSettings().then((d) => {
        if (d) setDlpSettings(d)
      })
      reloadSyncStatus()
    } else {
      try {
        const saved = localStorage.getItem('dsh_desktop_settings_mock')
        if (saved) setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }))
      } catch {
        // ignore
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async (andRestart = false) => {
    setSaving(true)
    setSaveError(null)
    try {
      if (window.dshDesktop) {
        await window.dshDesktop.saveSettings(settings)
        await window.dshDesktop.saveDlpSettings(dlpSettings)
        if (andRestart) {
          await window.dshDesktop.restartServer()
        }
      } else {
        localStorage.setItem('dsh_desktop_settings_mock', JSON.stringify(settings))
      }
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onSaved()
        onClose()
      }, 500)
    } catch (err: any) {
      console.error('[SettingsModal] Save error:', err)
      const msg = err?.message || '保存设置失败，请检查参数'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSSOLogin = async (provider: string) => {
    if (!window.dshDesktop) return
    const res = await window.dshDesktop.loginSSO(provider)
    if (res.success) {
      const state = await window.dshDesktop.getAuthState()
      setAuthState(state)
    }
  }

  const handleSSOLogout = async () => {
    if (!window.dshDesktop) return
    await window.dshDesktop.logoutSSO()
    const state = await window.dshDesktop.getAuthState()
    setAuthState(state)
  }

  const handleTestDlp = async () => {
    if (!window.dshDesktop || !dlpTestInput) return
    const res = await window.dshDesktop.scanDlp(dlpTestInput)
    setDlpTestResult(res)
  }

  const handleExportTeamBundle = async () => {
    if (!window.dshDesktop) return
    const jsonStr = await window.dshDesktop.exportTeamBundle()
    try {
      await navigator.clipboard.writeText(jsonStr)
      setTeamSyncMsg('团队工作区配置包已成功导出并复制到剪贴板！可发给成员一键导入。')
      setTimeout(() => setTeamSyncMsg(null), 4000)
    } catch {
      setTeamSyncMsg('导出成功，请手动在控制台查看配置包。')
    }
  }

  const handleImportTeamBundle = async () => {
    if (!window.dshDesktop || !importJsonText) return
    const res = await window.dshDesktop.importTeamBundle(importJsonText)
    setTeamSyncMsg(res.message)
    if (res.success) {
      setImportJsonText('')
      setTimeout(() => setTeamSyncMsg(null), 4000)
    }
  }

  // Method 1: Provision Default Templates
  const handleApplyDefaultTemplates = async (force: boolean) => {
    setProvisioningDefaults(true)
    setProvisionMsg(null)
    try {
      if (window.dshDesktop) {
        const res = await window.dshDesktop.applyDefaultTemplates(force)
        setProvisionMsg(res.message)
        reloadSyncStatus()
      }
    } catch (e: any) {
      setProvisionMsg(`执行失败: ${e?.message || e}`)
    } finally {
      setProvisioningDefaults(false)
    }
  }

  // Method 2: Export Asset Bundle
  const handleExportAssetBundle = async () => {
    try {
      if (window.dshDesktop) {
        const res = await window.dshDesktop.exportAssetBundle({
          includeCredentials: false,
          tenantName: 'Example Team',
        })
        if (res.success && res.data) {
          setExportedJsonText(res.data)
          await navigator.clipboard.writeText(res.data)
          setExportSuccess(true)
          setTimeout(() => setExportSuccess(false), 3000)
        }
      }
    } catch (e: any) {
      console.error('Export failed:', e)
    }
  }

  // Method 2: Import Asset Bundle
  const handleImportAssetBundle = async () => {
    if (!assetImportInput.trim()) return
    setImportingAssets(true)
    setAssetImportMsg(null)
    try {
      if (window.dshDesktop) {
        const res = await window.dshDesktop.importAssetBundle(assetImportInput.trim())
        setAssetImportMsg(res)
        if (res.success) {
          setAssetImportInput('')
          reloadSyncStatus()
        }
      }
    } catch (e: any) {
      setAssetImportMsg({ success: false, message: `导入异常: ${e?.message || e}` })
    } finally {
      setImportingAssets(false)
    }
  }

  // Method 3: Cloud Auto-Sync Now
  const handleSyncFromRemote = async () => {
    setSyncingRemote(true)
    setRemoteSyncResult(null)
    try {
      if (window.dshDesktop) {
        const res = await window.dshDesktop.syncFromRemote(settings.remoteSyncUrl)
        setRemoteSyncResult(res)
        reloadSyncStatus()
      }
    } catch (e: any) {
      setRemoteSyncResult({ success: false, message: `云端同步失败: ${e?.message || e}` })
    } finally {
      setSyncingRemote(false)
    }
  }

  const handleTestConnection = async () => {
    if (!settings.remoteUrl) return
    setTestingConnection(true)
    setConnectionTestResult(null)
    try {
      new URL(settings.remoteUrl)
      const res = await fetch(settings.remoteUrl, { signal: AbortSignal.timeout(5000) })
      if (res.status === 401) {
        setConnectionTestResult({
          type: 'warning',
          message: '目标服务器已响应，但提示需要 Token 鉴权（请粘贴带 ?token=... 的完整地址）',
        })
      } else if (res.ok || res.status < 400) {
        setConnectionTestResult({
          type: 'success',
          message: '目标服务器响应正常，鉴权通过，连接可用',
        })
      } else {
        setConnectionTestResult({
          type: 'warning',
          message: `目标服务器响应状态异常: HTTP ${res.status}`,
        })
      }
    } catch (err: any) {
      setConnectionTestResult({
        type: 'error',
        message: '无法访问该地址，请检查服务是否正在运行或 URL 是否正确',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSelectNodePath = async () => {
    if (window.dshDesktop) {
      const picked = await window.dshDesktop.openDirectoryDialog()
      if (picked) {
        setSettings((prev) => ({ ...prev, nodePath: picked }))
      }
    }
  }

  const isDark =
    typeof isDarkProp === 'boolean'
      ? isDarkProp
      : typeof document !== 'undefined'
      ? !document.documentElement.classList.contains('light')
      : true

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in no-drag ${
        isDark ? 'bg-black/75' : 'bg-slate-900/40'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full max-w-xl flex flex-col rounded-xl overflow-hidden shadow-2xl border transition-colors ${
          isDark
            ? 'bg-[#0c1220] border-slate-800 text-slate-200'
            : 'bg-white border-slate-300 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/90'
          }`}
        >
          <div className="flex items-center gap-2">
            <Server size={18} className="text-sky-500" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              HarnessFrame 桌面偏好设置
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex border-b px-5 pt-2 gap-5 text-xs transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'border-sky-500 text-sky-400'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server size={14} />
            <span>核心运行与外观</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'brand'
                ? 'border-sky-500 text-sky-400'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette size={14} />
            <span>品牌与标识定制</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'sync'
                ? 'border-indigo-500 text-indigo-400'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw size={14} className={syncingRemote ? 'animate-spin' : ''} />
            <span>模型·插件·Agent同步</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enterprise')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'enterprise'
                ? 'border-emerald-500 text-emerald-400'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield size={14} />
            <span>实验工具与认证状态</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[70vh]">
          {activeTab === 'general' ? (
            <div className="space-y-5">
          {/* Running Mode Selector */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              服务运行模式 (Server Mode)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, mode: 'managed' })}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  settings.mode === 'managed'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-slate-100 ring-1 ring-sky-500/30'
                    : isDark
                    ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Cpu size={16} className={settings.mode === 'managed' ? 'text-sky-500' : 'text-slate-400'} />
                <div>
                  <div className={`font-semibold text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>本地托管模式 (Managed)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    由桌面客户端自动管理后台服务生命周期，安全退出无残留。
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, mode: 'remote' })}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  settings.mode === 'remote'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-slate-100 ring-1 ring-sky-500/30'
                    : isDark
                    ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Globe size={16} className={settings.mode === 'remote' ? 'text-sky-500' : 'text-slate-400'} />
                <div>
                  <div className={`font-semibold text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>远程/直连模式 (Attach)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    连接已有正在运行的 local / 远程 dsh 实例 URL。
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Managed Port Config */}
          {settings.mode === 'managed' ? (
            <div className={`space-y-3 p-3.5 rounded-lg border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  本地服务监听端口 (Port)
                </label>
                <input
                  type="number"
                  value={settings.managedPort}
                  onChange={(e) =>
                    setSettings({ ...settings, managedPort: parseInt(e.target.value) || 8080 })
                  }
                  className={`w-full px-3 py-1.5 rounded border text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                  placeholder="8080"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  默认端口为 8080，如被占用可在此指定自定义端口。
                </span>
              </div>

              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  自定义 Node.js 可执行文件路径 (可选)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.nodePath}
                    onChange={(e) => setSettings({ ...settings, nodePath: e.target.value })}
                    className={`flex-1 px-3 py-1.5 rounded border text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                    placeholder="留空则自动检测系统 PATH 中的 node"
                  />
                  <button
                    type="button"
                    onClick={handleSelectNodePath}
                    className={`px-3 py-1.5 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
                    }`}
                  >
                    <FolderOpen size={13} />
                    <span>浏览</span>
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  额外命令行参数 (Extra Args)
                </label>
                <input
                  type="text"
                  value={settings.extraArgs}
                  onChange={(e) => setSettings({ ...settings, extraArgs: e.target.value })}
                  className={`w-full px-3 py-1.5 rounded border text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                  placeholder="例如: --trusted-host 0.0.0.0"
                />
              </div>
            </div>
          ) : (
            /* Remote Host Config */
            <div className={`space-y-3 p-3.5 rounded-lg border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                目标服务器连接地址 (Remote URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.remoteUrl}
                  onChange={(e) => {
                    setSettings({ ...settings, remoteUrl: e.target.value })
                    setConnectionTestResult(null)
                  }}
                  className={`flex-1 px-3 py-1.5 rounded border text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                  placeholder="https://dsh.yourcompany.com"
                />
                <button
                  type="button"
                  disabled={testingConnection || !settings.remoteUrl}
                  onClick={handleTestConnection}
                  className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400' : 'bg-white hover:bg-slate-100 border-slate-300 text-sky-600 shadow-xs'
                  }`}
                >
                  {testingConnection && <RefreshCw size={12} className="animate-spin" />}
                  <span>{testingConnection ? '测试中...' : '测试连接'}</span>
                </button>
              </div>
              {connectionTestResult && (
                <div
                  className={`text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    connectionTestResult.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                      : connectionTestResult.type === 'warning'
                      ? 'bg-amber-950/60 border border-amber-800/60 text-amber-300'
                      : 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                  }`}
                >
                  <span>
                    {connectionTestResult.type === 'success'
                      ? '🟢'
                      : connectionTestResult.type === 'warning'
                      ? '⚠️'
                      : '🔴'}
                  </span>
                  <span>{connectionTestResult.message}</span>
                </div>
              )}
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                💡 <strong>提示</strong>：运行中的 DeepSeek Harness 需要携带启动 Token 鉴权，请将终端中输出的完整地址（例如 <code className="text-sky-300 font-mono">http://127.0.0.1:3080/?token=...</code>）粘贴在此处。
              </span>
            </div>
          )}

          {/* General App Toggles */}
          <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <label className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
              isDark ? 'hover:bg-slate-900/60' : 'hover:bg-slate-100'
            }`}>
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>启动应用时自动拉起服务</div>
                <div className="text-[11px] text-slate-400">
                  桌面客户端打开时自动初始化并运行后端服务
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoStartServer}
                onChange={(e) => setSettings({ ...settings, autoStartServer: e.target.checked })}
                className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 bg-slate-950 cursor-pointer"
              />
            </label>
          </div>

          {/* Theme Selector */}
          <div className={`space-y-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              界面外观主题 (Appearance)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'dark' as const, label: '深色模式', sub: '极客沉浸风格', icon: Moon },
                { id: 'light' as const, label: '浅色模式', sub: '明亮清爽风格', icon: Sun },
                { id: 'system' as const, label: '跟随系统', sub: '随 macOS 适配', icon: Monitor },
              ].map(({ id, label, sub, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSettings({ ...settings, theme: id })}
                  className={`p-2.5 rounded-lg border text-left flex flex-col items-start gap-1 transition-all cursor-pointer ${
                    settings.theme === id
                      ? 'border-sky-500 bg-sky-500/10 text-sky-500 font-medium ring-1 ring-sky-500/30'
                      : isDark
                      ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Icon size={14} className={settings.theme === id ? 'text-sky-500' : 'text-slate-400'} />
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
          ) : activeTab === 'brand' ? (
            <div className="space-y-5">
              {/* 1. Real-time Live Preview Card */}
              <div className={`p-4 rounded-xl border transition-colors ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    <Eye size={13} className="text-sky-400" />
                    <span>侧边栏顶部品牌 1:1 实时预览</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    修改后即刻生效
                  </span>
                </div>

                <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                  isDark ? 'bg-[#0f172a] border-slate-700/60' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                      {renderBrandMarkPreview(settings.brandCustomization)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {settings.brandCustomization?.title || 'DSH 本地构建'}
                      </span>
                      {!settings.brandCustomization?.hideBadge && (
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded w-fit bg-slate-800 text-slate-300 border border-slate-700">
                          {settings.brandCustomization?.badge || 'Community Preview'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    展开态展示
                  </div>
                </div>
              </div>

              {/* 2. Brand Title Input */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  品牌标题名称 (Brand Title)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.brandCustomization?.title || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      brandCustomization: {
                        ...settings.brandCustomization,
                        title: e.target.value,
                      },
                    })}
                    placeholder="例如：HarnessFrame 或团队工具名称"
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors outline-none ${
                      isDark
                        ? 'bg-slate-900/90 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-sky-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      brandCustomization: {
                        ...settings.brandCustomization,
                        title: 'HarnessFrame',
                      },
                    })}
                    className={`px-2.5 py-2 text-xs rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="填入社区默认推荐标题"
                  >
                    <span>社区默认</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  用于覆盖侧边栏左上角原有的 “DSH 本地构建” 品牌文案。
                </p>
              </div>

              {/* 3. Version Badge & Hide Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    版本/环境徽标 (Badge Tag)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.brandCustomization?.hideBadge)}
                      onChange={(e) => setSettings({
                        ...settings,
                        brandCustomization: {
                          ...settings.brandCustomization,
                          hideBadge: e.target.checked,
                        },
                      })}
                      className="rounded text-sky-500 focus:ring-0"
                    />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                      完全隐藏此徽标
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={Boolean(settings.brandCustomization?.hideBadge)}
                  value={settings.brandCustomization?.badge || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    brandCustomization: {
                      ...settings.brandCustomization,
                      badge: e.target.value,
                    },
                  })}
                  placeholder="例如：Community Preview、内部定制版、v1.0"
                  className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors outline-none ${
                    settings.brandCustomization?.hideBadge
                      ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-800'
                      : isDark
                      ? 'bg-slate-900/90 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-sky-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500'
                  }`}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  展示在品牌标题下方的胶囊徽标，可自由填写环境或版本说明。
                </p>
              </div>

              {/* 4. Preset Icon Selector */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  品牌图标样式 (Brand Mark Logo)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'huazhu', name: 'HZ 徽标', desc: '项目现有渐变蓝 HZ 标识' },
                    { id: 'cpu', name: '算力芯片', desc: 'AI 算力与引擎' },
                    { id: 'sparkles', name: '智能星芒', desc: '金色灵动风格' },
                    { id: 'shield', name: '安全护盾', desc: '绿色安全可信' },
                    { id: 'bot', name: '智能助理', desc: '紫色 AI 机器人' },
                    { id: 'default', name: '原生小鲸鱼', desc: '官方默认鲸鱼标' },
                  ].map((preset) => {
                    const isSelected = (settings.brandCustomization?.presetIcon || 'huazhu') === preset.id && !settings.brandCustomization?.customLogoUrl
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSettings({
                          ...settings,
                          brandCustomization: {
                            ...settings.brandCustomization,
                            presetIcon: preset.id as any,
                            customLogoUrl: '',
                          },
                        })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                            : isDark
                            ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-6 h-6 flex items-center justify-center">
                            {renderPresetIconOnly(preset.id)}
                          </div>
                          {isSelected && <Check size={13} className="text-sky-400" />}
                        </div>
                        <div>
                          <div className={`text-xs font-semibold ${isSelected ? 'text-sky-400' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {preset.desc}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 5. Custom Logo URL */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  或指定自定义图片 URL / Base64 图标
                </label>
                <input
                  type="text"
                  value={settings.brandCustomization?.customLogoUrl || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    brandCustomization: {
                      ...settings.brandCustomization,
                      customLogoUrl: e.target.value,
                    },
                  })}
                  placeholder="https://... 或 data:image/png;base64,..."
                  className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors outline-none ${
                    isDark
                      ? 'bg-slate-900/90 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-sky-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500'
                  }`}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  填入图片链接后将覆盖预设图标，作为侧边栏的定制 Logo。
                </p>
              </div>
            </div>
          ) : activeTab === 'sync' ? (
            <div className="space-y-4">
              {/* Top Overview Status Dashboard */}
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50/60 border-indigo-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database size={15} className="text-indigo-400" />
                    <span className="font-semibold text-xs text-indigo-400">全客户端配置与资产同步中心</span>
                  </div>
                  <button
                    type="button"
                    onClick={reloadSyncStatus}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>刷新状态</span>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">生效模型路由</div>
                    <div className="text-sm font-bold text-sky-400">{syncStatus?.modelCount ?? 2} 个</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">智能体示例预设</div>
                    <div className="text-sm font-bold text-indigo-400">{syncStatus?.presetCount ?? 2} 个</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">手动拉取配置</div>
                    <div className={`text-sm font-bold ${false ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {false ? '已开启' : '已暂停'}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">最后同步时间</div>
                    <div className="text-[11px] font-medium text-slate-300 truncate mt-0.5">
                      {syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : '出厂状态'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Method 1: Packaged Default Preset Templates */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database size={15} className="text-sky-400" />
                    <span className="font-semibold text-xs">方式 1 · 社区示例预设 (Packaged Example Presets)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    本地示例 · 手动导入
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  桌面客户端包含一组用于说明配置格式的社区示例。按下按钮并确认后才会写入本地配置；现有文件将备份。
                </p>

                <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-sky-400 mb-0.5">🎯 示例模型路由</div>
                    <div className="text-[10px] text-slate-400">DeepSeek-V3 / R1 (思维链) / 本地 Ollama 集群</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-purple-400 mb-0.5">⚙️ 核心插件策略</div>
                    <div className="text-[10px] text-slate-400">终端 60s 超时守护 / Subagent 路由权限 / 网页检索</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-emerald-400 mb-0.5">🤖 示例智能体</div>
                    <div className="text-[10px] text-slate-400">示例研发智能体 + 示例代码审查智能体</div>
                  </div>
                </div>

                {provisionMsg && (
                  <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-sky-400 shrink-0" />
                    <span>{provisionMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled checked={false}
                      onChange={(e) => setSettings({ ...settings, autoProvisionDefaults: e.target.checked })}
                      className="rounded text-sky-500 focus:ring-0"
                    />
                    <span>预览版仅支持手动导入预设</span>
                  </label>

                  <button
                    type="button"
                    disabled={provisioningDefaults}
                    onClick={() => handleApplyDefaultTemplates(true)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} className={provisioningDefaults ? 'animate-spin' : ''} />
                    <span>{provisioningDefaults ? '正在导入...' : '导入 / 恢复社区示例'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Method 2: Team Asset Bundle Export & Import */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-purple-400" />
                    <span className="font-semibold text-xs">方式 2 · 团队配置资产包一键分发与漫游 (.dsh-bundle)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    一键导出 · 导入热更新
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  可将本机的模型、插件、智能体与工作区配置导出为团队资产包。导入前会显示警告并要求确认，部分引擎配置可能需要重启后生效。
                </p>

                {/* Export section */}
                <div className={`p-3 rounded-lg border mb-3 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled checked={false}
                        onChange={(e) => setExportIncludeCreds(e.target.checked)}
                        className="rounded text-purple-500 focus:ring-0"
                      />
                      <span>凭据导出在 Preview 中禁用</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleExportAssetBundle}
                      className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      {exportSuccess ? <Check size={13} /> : <Copy size={13} />}
                      <span>{exportSuccess ? '已导出并复制到剪贴板！' : '一键导出团队资产包'}</span>
                    </button>
                  </div>
                </div>

                {/* Import section */}
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={assetImportInput}
                    onChange={(e) => setAssetImportInput(e.target.value)}
                    placeholder="粘贴团队资产包 (.dsh-bundle / JSON 内容) 后点击「导入并热更新」..."
                    className={`w-full p-2.5 rounded-lg border text-xs font-mono transition-colors ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-purple-500' : 'bg-white border-slate-300 text-slate-800 focus:border-purple-500'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-slate-400">
                      支持合并模型路由、插件配置、Agent 预设与工作区
                    </div>
                    <button
                      type="button"
                      disabled={!assetImportInput.trim() || importingAssets}
                      onClick={handleImportAssetBundle}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <Upload size={12} className={importingAssets ? 'animate-spin' : ''} />
                      <span>{importingAssets ? '正在导入并热更新...' : '导入并实时热更新'}</span>
                    </button>
                  </div>
                </div>

                {assetImportMsg && (
                  <div className={`mt-2.5 p-2.5 rounded text-[11px] flex items-center gap-1.5 ${
                    assetImportMsg.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {assetImportMsg.success ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={13} className="text-rose-400 shrink-0" />}
                    <span>{assetImportMsg.message}</span>
                  </div>
                )}
              </div>

              {/* 3. Method 3: Remote Config Center Auto-Sync */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cloud size={15} className="text-emerald-400" />
                    <span className="font-semibold text-xs">方式 3 · 远程配置手动拉取 (Remote Config Import)</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled checked={false}
                      onChange={(e) => setSettings({ ...settings, remoteSyncEnabled: e.target.checked })}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-300">预览版仅支持手动拉取并确认</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  从用户指定的 HTTPS 地址拉取配置包。拉取后会显示导入摘要，经确认后才会应用配置。
                </p>

                <div className="space-y-2">
                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      远程配置地址 (Remote Config Endpoint)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={settings.remoteSyncUrl || ''}
                        onChange={(e) => setSettings({ ...settings, remoteSyncUrl: e.target.value })}
                        placeholder="https://config.example.com/harness.json 或内网私有地址"
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono outline-none ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-500'
                        }`}
                      />
                      <button
                        type="button"
                        disabled={syncingRemote}
                        onClick={handleSyncFromRemote}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
                      >
                        <RefreshCw size={13} className={syncingRemote ? 'animate-spin' : ''} />
                        <span>{syncingRemote ? '正在同步...' : '立即从云端同步'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-400">快捷配置：</span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, remoteSyncUrl: 'https://config.example.com/harness.json' })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      示例配置地址
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, remoteSyncUrl: 'http://127.0.0.1:8080/api/config' })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      本地私有节点 (Local Mock)
                    </button>
                  </div>
                </div>

                {remoteSyncResult && (
                  <div className={`mt-3 p-2.5 rounded text-[11px] flex items-center gap-1.5 ${
                    remoteSyncResult.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                  }`}>
                    {remoteSyncResult.success ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                    <span>{remoteSyncResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Enterprise SSO Card */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-sky-400" />
                    <span className="font-semibold text-xs">企业 SSO（尚未实现）</span>
                  </div>
                  {authState.isAuthenticated ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 size={13} />
                      <span>已登录 ({authState.provider})</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">未登录</span>
                  )}
                </div>

                {authState.isAuthenticated && authState.user ? (
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                        {authState.user.name[0] || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-100">{authState.user.name}</div>
                        <div className="text-[10px] text-slate-400">{authState.user.email} · {authState.user.tenantId}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSSOLogout}
                      className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      退出登录
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400">
                      社区预览版未实现企业登录。请通过 Harness 服务自身的认证方式连接。
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        disabled
                        onClick={() => handleSSOLogin('feishu')}
                        className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isDark ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-sky-400' : 'border-slate-200 bg-white hover:bg-slate-100 text-sky-600'
                        }`}
                      >
                        <span>🕊️ 飞书 SSO</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        onClick={() => handleSSOLogin('wework')}
                        className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isDark ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-emerald-400' : 'border-slate-200 bg-white hover:bg-slate-100 text-emerald-600'
                        }`}
                      >
                        <span>💬 企业微信</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        onClick={() => handleSSOLogin('okta')}
                        className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isDark ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-purple-400' : 'border-slate-200 bg-white hover:bg-slate-100 text-purple-600'
                        }`}
                      >
                        <span>🌐 Okta / OIDC</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Enterprise DLP Engine */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-emerald-400" />
                    <span className="font-semibold text-xs">文本规则测试（不会拦截聊天或网络请求）</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dlpSettings.enabled}
                      onChange={(e) => setDlpSettings({ ...dlpSettings, enabled: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-300">开启前置拦截</span>
                  </label>
                </div>

                {dlpSettings.enabled && (
                  <div className="space-y-3 pt-1">
                    {/* Mode selection */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'mask', label: '🛡️ 掩码脱敏 (Mask)', desc: '自动替换敏感信息' },
                        { id: 'warn', label: '⚠️ 仅警示 (Warn)', desc: '弹窗告警用户' },
                        { id: 'block', label: '🚫 强阻断 (Block)', desc: '严禁包含违规内容' },
                      ].map(({ id, label, desc }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDlpSettings({ ...dlpSettings, mode: id as any })}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                            dlpSettings.mode === id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                              : isDark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <div className="font-semibold text-[11px]">{label}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">{desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Checkboxes */}
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dlpSettings.scanApiKeys}
                          onChange={(e) => setDlpSettings({ ...dlpSettings, scanApiKeys: e.target.checked })}
                          className="rounded border-slate-700 text-emerald-500"
                        />
                        <span>API 密钥与私钥证书</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dlpSettings.scanPii}
                          onChange={(e) => setDlpSettings({ ...dlpSettings, scanPii: e.target.checked })}
                          className="rounded border-slate-700 text-emerald-500"
                        />
                        <span>手机号与身份证号 (PII)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dlpSettings.scanInternalIps}
                          onChange={(e) => setDlpSettings({ ...dlpSettings, scanInternalIps: e.target.checked })}
                          className="rounded border-slate-700 text-emerald-500"
                        />
                        <span>企业 RFC1918 内网 IP</span>
                      </label>
                    </div>

                    {/* Real-time DLP Probe Sandbox */}
                    <div className={`p-3 rounded-lg border space-y-2 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div className="text-[11px] font-semibold text-slate-300">DLP 规则实时检测沙箱</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dlpTestInput}
                          onChange={(e) => setDlpTestInput(e.target.value)}
                          placeholder="输入待测试文本，如: 联调 Key 是 sk-1234567890abcdef1234567890abcdef"
                          className={`flex-1 px-3 py-1.5 rounded border text-xs font-mono ${
                            isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleTestDlp}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm cursor-pointer"
                        >
                          扫描
                        </button>
                      </div>

                      {dlpTestResult && (
                        <div className={`p-2.5 rounded border text-[11px] font-mono leading-relaxed ${
                          dlpTestResult.hasSensitiveData
                            ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                            : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        }`}>
                          <div className="flex items-center justify-between font-semibold mb-1">
                            <span>{dlpTestResult.hasSensitiveData ? `🚨 发现 ${dlpTestResult.matches.length} 处敏感数据 (${dlpTestResult.auditAction.toUpperCase()})` : '✅ 未检测到敏感信息'}</span>
                          </div>
                          <div>脱敏产物: {dlpTestResult.maskedText}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Team Workspace Asset Sync */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Download size={16} className="text-purple-400" />
                    <span className="font-semibold text-xs">团队工作区资产导出与漫游 (Team Asset Sync)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportTeamBundle}
                    className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy size={12} />
                    <span>导出配置包</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  将当前团队全部工作区配置与 Prompt 模版导出为标准化资产包，发给团队成员或在新电脑上直接恢复。
                </p>

                {teamSyncMsg && (
                  <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-sky-400" />
                    <span>{teamSyncMsg}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder="粘贴团队配置包 JSON 内容后点击「一键导入并合并」..."
                    className={`w-full p-2.5 rounded border text-xs font-mono ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!importJsonText.trim()}
                      onClick={handleImportTeamBundle}
                      className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Upload size={12} />
                      <span>一键导入并合并团队工作区</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/90'
          }`}
        >
          <div className="text-[11px] font-mono">
            {savedSuccess ? (
              <span className="text-emerald-500 font-semibold">✅ 设置已保存！正在切换...</span>
            ) : saveError ? (
              <span className="text-rose-500">❌ {saveError}</span>
            ) : status.state === 'running' ? (
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>当前服务运行中</span>
            ) : (
              <span className="text-slate-400">服务未运行</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              取消
            </button>

            {status.state === 'running' && settings.mode === 'managed' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="px-3 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} className={saving ? 'animate-spin' : ''} />
                <span>保存并重启服务</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="px-4 py-1.5 rounded-md text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium flex items-center gap-1.5 shadow-md shadow-sky-900/30 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? '正在保存...' : '保存设置'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
