import React, { useState, useEffect } from 'react'
import {
  Search,
  Terminal,
  Settings,
  RotateCcw,
  ExternalLink,
  Power,
  BookOpen,
  FolderOpen,
  Sparkles,
  Command,
  Sun,
  Moon,
  Shield,
} from 'lucide-react'
import logoImg from '../assets/logo.png'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  shortcut?: string
  category: 'server' | 'navigation' | 'help'
  action: () => void
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onOpenLogs: () => void
  onOpenSettings: () => void
  onOpenEnterprise?: () => void
  onReload: () => void
  onRestartServer: () => void
  onOpenBrowser: () => void
  onSelectDirectory: () => void
  onToggleTheme?: () => void
  currentTheme?: 'dark' | 'light' | 'system'
}

export const CommandPalette: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenLogs,
  onOpenSettings,
  onOpenEnterprise,
  onReload,
  onRestartServer,
  onOpenBrowser,
  onSelectDirectory,
  onToggleTheme,
  currentTheme,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const isMac = window.dshDesktop?.platform === 'darwin'
  const cmdKey = isMac ? '⌘' : 'Ctrl+'

  const commands: CommandItem[] = [
    {
      id: 'reload',
      title: '刷新页面视图 (Reload)',
      subtitle: '重新加载当前 DeepSeek Harness 界面',
      icon: <RotateCcw size={16} className="text-sky-400" />,
      shortcut: `${cmdKey}R`,
      category: 'navigation',
      action: () => {
        onReload()
        onClose()
      },
    },
    {
      id: 'logs',
      title: '查看实时服务日志 (View Logs)',
      subtitle: '实时流式监控 DeepSeek Harness 后台输出',
      icon: <Terminal size={16} className="text-emerald-400" />,
      shortcut: `${cmdKey}L`,
      category: 'server',
      action: () => {
        onOpenLogs()
        onClose()
      },
    },
    {
      id: 'restart',
      title: '重启本地后台服务 (Restart Server)',
      subtitle: '停止并重新拉起 deepseek-harness 进程',
      icon: <Power size={16} className="text-amber-400" />,
      shortcut: `${cmdKey}⇧R`,
      category: 'server',
      action: () => {
        onRestartServer()
        onClose()
      },
    },
    {
      id: 'browser',
      title: '在系统默认浏览器中打开 (Open in Browser)',
      subtitle: '将当前会话交接至 Chrome / Safari / Edge',
      icon: <ExternalLink size={16} className="text-sky-400" />,
      shortcut: `${cmdKey}⇧O`,
      category: 'navigation',
      action: () => {
        onOpenBrowser()
        onClose()
      },
    },
    {
      id: 'workspace',
      title: '选择工作区目录 (Select Workspace Directory)',
      subtitle: '通过系统原生对话框选择项目工作空间',
      icon: <FolderOpen size={16} className="text-indigo-400" />,
      category: 'navigation',
      action: () => {
        onSelectDirectory()
        onClose()
      },
    },
    {
      id: 'theme',
      title: '切换浅色 / 深色界面外观 (Toggle Theme)',
      subtitle: '快速在浅色清爽风格与深色极客模式之间切换',
      icon: <Sun size={16} className="text-amber-500" />,
      shortcut: `${cmdKey}T`,
      category: 'help',
      action: () => {
        onToggleTheme?.()
        onClose()
      },
    },
    {
      id: 'enterprise-security',
      title: '实验工具与认证状态 (Preview Tools)',
      subtitle: 'SSO 实现状态 / 文本规则测试 / 团队配置导入导出',
      icon: <Shield size={16} className="text-emerald-400" />,
      shortcut: `${cmdKey}E`,
      category: 'help',
      action: () => {
        onOpenEnterprise?.()
        onClose()
      },
    },
    {
      id: 'settings',
      title: '打开偏好设置 (Preferences)',
      subtitle: '配置运行模式、服务端口、主题外观与 Node.js 路径',
      icon: <Settings size={16} className="text-slate-400" />,
      shortcut: `${cmdKey},`,
      category: 'help',
      action: () => {
        onOpenSettings()
        onClose()
      },
    },
    {
      id: 'docs',
      title: '查阅 DeepSeek Harness 官方文档',
      subtitle: '了解插件机制、Agent Preset 与配置架构',
      icon: <BookOpen size={16} className="text-blue-400" />,
      category: 'help',
      action: () => {
        if (window.dshDesktop) {
          void window.dshDesktop.openExternalUrl('https://github.com/deepseek-ai/deepseek-harness')
        }
        onClose()
      },
    },
  ]

  const isDark = typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true

  const filtered = commands.filter((cmd) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q))
    )
  })

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filtered, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 animate-fade-in no-drag ${
        isDark ? 'bg-black/75' : 'bg-slate-900/40'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full max-w-xl rounded-xl overflow-hidden shadow-2xl border flex flex-col transition-colors ${
          isDark
            ? 'bg-[#090d16] border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className={`flex items-center gap-3 px-4 py-3.5 border-b transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/90'
        }`}>
          <Search size={18} className="text-sky-500 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="键入命令或快速搜索操作..."
            className={`w-full bg-transparent text-sm focus:outline-none ${
              isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
            }`}
          />
          <div className={`flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded border ${
            isDark ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-200 bg-white'
          }`}>
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">
              未找到匹配命令
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? isDark
                      ? 'bg-sky-950/60 border border-sky-800/60 text-slate-100 shadow-xs'
                      : 'bg-sky-50 border border-sky-200 text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-300 hover:bg-slate-900/60 border border-transparent'
                    : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-md ${
                      selectedIndex === idx
                        ? isDark ? 'bg-sky-900/50' : 'bg-sky-100'
                        : isDark ? 'bg-slate-900' : 'bg-slate-100'
                    }`}
                  >
                    {cmd.icon}
                  </div>
                  <div>
                    <div className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{cmd.title}</div>
                    {cmd.subtitle && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{cmd.subtitle}</div>
                    )}
                  </div>
                </div>

                {cmd.shortcut && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'text-slate-400 bg-slate-900/80 border-slate-800'
                      : 'text-slate-600 bg-white border-slate-200 shadow-2xs'
                  }`}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Command Footer */}
        <div className={`px-4 py-2 border-t flex items-center justify-between text-[11px] font-mono transition-colors ${
          isDark ? 'border-slate-800 bg-slate-950 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 执行</span>
          </div>
          <div className="flex items-center gap-1.5">
            <img src={logoImg} alt="HarnessFrame" className="w-3.5 h-3.5 object-contain" />
            <span>HarnessFrame</span>
          </div>
        </div>
      </div>
    </div>
  )
}
