import React from 'react'
import type { AppLanguage, ServerStatus, WorkspaceProfile } from '@shared-types/index.js'
import { StatusIndicator } from './StatusIndicator.js'
import { WorkspaceSwitcher } from './WorkspaceSwitcher.js'
import {
  RotateCcw,
  ExternalLink,
  Terminal,
  Settings as SettingsIcon,
  Minus,
  Square,
  X,
  Search,
  Sun,
  Moon,
  Activity,
  PanelRight,
  PictureInPicture,
  Sparkles,
  Shield,
  Languages,
} from 'lucide-react'
import { CodexPet } from './CodexPet.js'
import logoImg from '../assets/logo.png'

interface Props {
  status: ServerStatus
  currentTheme?: 'dark' | 'light' | 'system'
  language?: AppLanguage
  workspaces?: WorkspaceProfile[]
  activeWorkspaceId?: string
  isSidePanelOpen?: boolean
  onToggleSidePanel?: () => void
  onTogglePiP?: () => void
  onCheckUpdates?: () => void
  onOpenPetTab?: () => void
  onSwitchWorkspace?: (id: string) => void
  onAddWorkspace?: () => void
  onEditWorkspace?: (ws: WorkspaceProfile) => void
  onWorkspaceMenuOpenChange?: (open: boolean) => void
  onOpenDiagnostics?: () => void
  onOpenEnterprise?: () => void
  onToggleTheme?: () => void
  onToggleLanguage?: () => void
  onOpenLogs: () => void
  onOpenSettings: () => void
  onReloadWebview: () => void
  onOpenCommandPalette?: () => void
}

export const HeaderBar: React.FC<Props> = ({
  status,
  currentTheme = 'dark',
  language = 'zh-CN',
  workspaces = [],
  activeWorkspaceId = 'ws-remote',
  isSidePanelOpen = false,
  onToggleSidePanel,
  onTogglePiP,
  onCheckUpdates,
  onOpenPetTab,
  onSwitchWorkspace,
  onAddWorkspace,
  onEditWorkspace,
  onWorkspaceMenuOpenChange,
  onOpenDiagnostics,
  onOpenEnterprise,
  onToggleTheme,
  onToggleLanguage,
  onOpenLogs,
  onOpenSettings,
  onReloadWebview,
  onOpenCommandPalette,
}) => {
  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac/i.test(navigator.userAgent) || window.dshDesktop?.platform === 'darwin')

  const isRunning = status.state === 'running'
  const en = language === 'en'

  const isDark =
    currentTheme === 'light'
      ? false
      : currentTheme === 'dark'
      ? true
      : typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
      : true

  const handleOpenBrowser = () => {
    if (status.url && window.dshDesktop) {
      void window.dshDesktop.openExternalUrl(status.url)
    }
  }

  const handleMinimize = () => window.dshDesktop?.minimizeWindow()
  const handleMaximize = () => window.dshDesktop?.maximizeWindow()
  const handleClose = () => window.dshDesktop?.closeWindow()

  const noDragStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as any
  const dragStyle: React.CSSProperties = { WebkitAppRegion: 'drag' } as any

  return (
    <header
      className={`relative z-20 w-full flex items-center justify-between px-3 border-b select-none transition-colors duration-200 ${
        isMac ? 'pl-[84px]' : 'pl-3'
      }`}
      style={{
        height: 'var(--titlebar-height)',
        backgroundColor: isDark ? '#090d16' : '#ffffff',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
        ...noDragStyle,
      }}
    >
      {/* Left side: Brand, Workspace Switcher & Status Indicator */}
      <div className="flex items-center gap-2.5 shrink-0" style={noDragStyle}>
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`w-6 h-6 rounded-md p-0.5 flex items-center justify-center transition-colors ${
              isDark
                ? 'bg-slate-900/80 border border-sky-500/30 shadow-sm'
                : 'bg-white border border-slate-200 shadow-xs'
            }`}
          >
            <img
              src={logoImg}
              alt="HarnessFrame"
              className="w-full h-full object-contain"
            />
          </div>
          <span
            className={`text-xs font-semibold tracking-wide font-sans transition-colors hidden xl:inline ${
              isDark ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            HarnessFrame
          </span>
        </div>

        <div className={`h-4 w-[1px] mx-0.5 hidden sm:block ${isDark ? 'bg-slate-800/80' : 'bg-slate-200'}`} />

        {/* Sleek Workspace Switcher */}
        {workspaces.length > 0 && onSwitchWorkspace && onAddWorkspace && (
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeId={activeWorkspaceId}
            isDark={isDark}
            language={language}
            onSwitch={onSwitchWorkspace}
            onAddWorkspace={onAddWorkspace}
            onEditWorkspace={onEditWorkspace}
            onOpenChange={onWorkspaceMenuOpenChange}
          />
        )}

        <div className="hidden lg:block">
          <StatusIndicator status={status} isDark={isDark} language={language} onClick={onOpenLogs} />
        </div>

        {/* Codex Mini Pet Pill */}
        <div className="hidden sm:block" style={noDragStyle}>
          <CodexPet status={status} isDark={isDark} mode="compact" onClick={onOpenPetTab} />
        </div>
      </div>

      {/* Draggable Spacer 1 (Left-Center) */}
      <div
        className="drag-region flex-1 h-full min-w-[16px] cursor-default"
        style={dragStyle}
        title={en ? 'Drag window' : '按住拖拽窗口'}
      />

      {/* Center: Quick Command Palette Trigger (Clickable) */}
      <div className="shrink-0 max-w-xs mx-2 hidden md:flex justify-center" style={noDragStyle}>
        <button
          onClick={onOpenCommandPalette}
          style={noDragStyle}
          className={`w-full max-w-[240px] flex items-center justify-between px-2.5 py-1 rounded-lg transition-all text-xs group shadow-xs cursor-pointer ${
            isDark
              ? 'bg-slate-900/70 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700'
              : 'bg-slate-100/90 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300'
          }`}
          title={en ? 'Open command palette (Cmd/Ctrl + K)' : '打开快捷命令面板 (Cmd/Ctrl + K)'}
        >
          <div className="flex items-center gap-1.5">
            <Search size={12} className={isDark ? 'text-slate-500 group-hover:text-sky-400' : 'text-slate-400 group-hover:text-sky-600'} />
            <span className={`text-[11px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{en ? 'Commands...' : '快捷命令...'}</span>
          </div>
          <kbd
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded border transition-colors ${
              isDark
                ? 'text-slate-500 bg-slate-800/90 border-slate-700/60 group-hover:text-slate-300'
                : 'text-slate-500 bg-white border-slate-200 shadow-2xs group-hover:text-slate-700'
            }`}
          >
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>

      {/* Draggable Spacer 2 (Center-Right) */}
      <div
        className="drag-region flex-1 h-full min-w-[16px] cursor-default"
        style={dragStyle}
        title={en ? 'Drag window' : '按住拖拽窗口'}
      />

      {/* Right side: Action toolbar & Windows frame controls */}
      <div className="flex items-center gap-1 shrink-0" style={noDragStyle}>
        {/* Status indicator on smaller screens */}
        <div className="lg:hidden mr-1">
          <StatusIndicator status={status} isDark={isDark} language={language} onClick={onOpenLogs} />
        </div>

        {/* Reload */}
        <button
          onClick={onReloadWebview}
          style={noDragStyle}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={en ? 'Reload view (Cmd/Ctrl + R)' : '刷新页面视图 (Cmd/Ctrl + R)'}
        >
          <RotateCcw size={14} />
        </button>

        {/* Open in Browser */}
        <button
          onClick={handleOpenBrowser}
          disabled={!isRunning || !status.url}
          style={noDragStyle}
          className={`p-1.5 rounded-md transition-colors ${
            isRunning && status.url
              ? isDark
                ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 cursor-pointer'
                : 'text-slate-600 hover:text-sky-600 hover:bg-slate-100 cursor-pointer'
              : 'text-slate-400/30 opacity-40 cursor-not-allowed'
          }`}
          title={en ? 'Open in default browser (Cmd/Ctrl + Shift + O)' : '在系统默认浏览器中打开 (Cmd/Ctrl + Shift + O)'}
        >
          <ExternalLink size={14} />
        </button>

        {/* Diagnostics & Self-Healing Button */}
        {onOpenDiagnostics && (
          <button
            onClick={onOpenDiagnostics}
            style={noDragStyle}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-800/80'
                : 'text-slate-600 hover:text-sky-600 hover:bg-slate-100'
            }`}
          title={en ? 'Diagnostics and repair' : '环境自检与智能诊断修复向导'}
          >
            <Activity size={14} />
          </button>
        )}

        {/* Log Viewer Button */}
        <button
          onClick={onOpenLogs}
          style={noDragStyle}
          className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 text-xs border cursor-pointer ${
            isDark
              ? 'text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 border-transparent hover:border-slate-700/60'
              : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/80 border-transparent hover:border-emerald-200'
          }`}
          title={en ? 'View service logs (Cmd/Ctrl + L)' : '查看实时后台服务日志 (Cmd/Ctrl + L)'}
        >
          <Terminal size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
          <span className="text-[11px] font-mono">{en ? 'Logs' : '日志'}</span>
        </button>

        <button
          onClick={onToggleLanguage}
          style={noDragStyle}
          className={`px-1.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${isDark ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/80' : 'text-slate-600 hover:text-sky-700 hover:bg-slate-100'}`}
          title={en ? 'Switch to Chinese' : '切换为 English'}
        >
          <Languages size={14} />
          <span className="text-[10px] font-medium">{en ? 'EN' : '中'}</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          style={noDragStyle}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isDark
              ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800/80'
              : 'text-slate-600 hover:text-amber-600 hover:bg-slate-100'
          }`}
          title={isDark ? (en ? 'Switch to light mode' : '切换至浅色模式') : (en ? 'Switch to dark mode' : '切换至深色模式')}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Picture-in-Picture Mini Monitoring Mode */}
        {onTogglePiP && (
          <button
            onClick={onTogglePiP}
            disabled={!isRunning || !status.url}
            style={noDragStyle}
            className={`p-1.5 rounded-md transition-colors ${
              isRunning && status.url
                ? isDark
                  ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 cursor-pointer'
                  : 'text-slate-600 hover:text-sky-600 hover:bg-slate-100 cursor-pointer'
                : 'text-slate-400/30 opacity-40 cursor-not-allowed'
            }`}
            title="画中画迷你监视模式 (置顶浮动监测任务执行进度)"
          >
            <PictureInPicture size={14} />
          </button>
        )}

        {/* Check for Updates */}
        {onCheckUpdates && (
          <button
            onClick={onCheckUpdates}
            style={noDragStyle}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/80'
                : 'text-slate-600 hover:text-amber-600 hover:bg-slate-100'
            }`}
            title="检查新版本更新"
          >
            <Sparkles size={14} />
          </button>
        )}

        {/* Preview tools and authentication status */}
        {onOpenEnterprise && (
          <button
            onClick={onOpenEnterprise}
            style={noDragStyle}
            className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 text-xs border cursor-pointer ${
              isDark
                ? 'text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/60 shadow-2xs'
                : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 shadow-2xs'
            }`}
            title="实验工具、认证状态与团队配置"
          >
            <Shield size={13} className="text-emerald-500" />
            <span className="text-[11px] font-medium hidden sm:inline">实验工具</span>
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          style={noDragStyle}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="偏好设置 (Cmd/Ctrl + ,)"
        >
          <SettingsIcon size={14} />
        </button>

        {/* Codex-style Side Panel Toggle Button */}
        {onToggleSidePanel && (
          <button
            onClick={onToggleSidePanel}
            style={noDragStyle}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isSidePanelOpen
                ? isDark
                  ? 'bg-slate-800 text-sky-400 border border-sky-500/40 shadow-xs'
                  : 'bg-sky-50 text-sky-700 border border-sky-300 shadow-xs'
                : isDark
                ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={isSidePanelOpen ? '收起侧边面板 (Cmd/Ctrl + B)' : '展开侧边生产力面板 (Cmd/Ctrl + B)'}
          >
            <PanelRight size={14} />
          </button>
        )}

        {/* Windows / Linux Frame Controls */}
        {!isMac && (
          <div className={`flex items-center gap-0.5 ml-2 pl-2 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`} style={noDragStyle}>
            <button
              onClick={handleMinimize}
              style={noDragStyle}
              className={`p-1.5 rounded transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              title="最小化"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={handleMaximize}
              style={noDragStyle}
              className={`p-1.5 rounded transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              title="最大化"
            >
              <Square size={12} />
            </button>
            <button
              onClick={handleClose}
              style={noDragStyle}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
              title="关闭"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
