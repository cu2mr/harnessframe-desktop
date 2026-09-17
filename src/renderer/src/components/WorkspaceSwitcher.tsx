import React, { useState, useRef, useEffect } from 'react'
import type { AppLanguage, WorkspaceProfile } from '@shared-types/index.js'
import {
  ChevronDown,
  Plus,
  Check,
  Laptop,
  Cloud,
  Terminal,
  Code2,
  Settings2,
} from 'lucide-react'

interface Props {
  workspaces: WorkspaceProfile[]
  activeId: string
  isDark?: boolean
  language?: AppLanguage
  onSwitch: (id: string) => void
  onAddWorkspace: () => void
  onEditWorkspace?: (ws: WorkspaceProfile) => void
  onOpenChange?: (open: boolean) => void
}

export const WorkspaceSwitcher: React.FC<Props> = ({
  workspaces,
  activeId,
  isDark = true,
  language = 'zh-CN',
  onSwitch,
  onAddWorkspace,
  onEditWorkspace,
  onOpenChange,
}) => {
  const en = language === 'en'
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeWs = workspaces.find((w) => w.id === activeId) || workspaces[0]
  const activeColor = activeWs?.colorBadge || (activeWs?.mode === 'managed' ? '#38bdf8' : '#10b981')

  const setMenuOpen = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleOpenTerminal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    if (window.dshDesktop) {
      void window.dshDesktop.openInTerminal(activeWs?.workingDirectory)
    }
  }

  const handleOpenVSCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    if (window.dshDesktop) {
      void window.dshDesktop.openInEditor(activeWs?.workingDirectory)
    }
  }

  return (
    <>
      {/* Backdrop to cover window and intercept outside clicks */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="relative inline-block text-left no-drag z-50" ref={menuRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!isOpen)
          }}
          className={`no-drag px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border shadow-xs ${
            isOpen
              ? isDark
                ? 'bg-slate-800 text-slate-100 border-sky-500/60 ring-2 ring-sky-500/20'
                : 'bg-white text-slate-900 border-sky-500/60 ring-2 ring-sky-500/20'
              : isDark
              ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-800/80 hover:border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
          }`}
        >
          {/* Active colored badge */}
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: activeColor }}
          />

          {activeWs?.mode === 'managed' ? (
            <Laptop size={12} className="text-sky-400 shrink-0" />
          ) : (
            <Cloud size={12} className="text-emerald-400 shrink-0" />
          )}

          <span className="truncate max-w-[130px] font-sans text-xs">
            {activeWs?.name || (en ? 'Select workspace' : '选择工作区')}
          </span>

          <ChevronDown
            size={12}
            className={`transition-transform duration-200 shrink-0 text-slate-400 ${
              isOpen ? 'rotate-180 text-sky-400' : ''
            }`}
          />
        </button>

        {/* Floating Dropdown Menu */}
        {isOpen && (
          <div
            className={`no-drag absolute left-0 top-full mt-1.5 w-64 rounded-xl border shadow-2xl z-50 overflow-hidden animate-fade-in backdrop-blur-md ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/80'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
            }`}
          >
            {/* Header section */}
            <div
              className={`px-3 py-2 border-b flex items-center justify-between text-[11px] font-medium ${
                isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
              }`}
            >
              <span>{en ? 'Workspaces / instances' : '工作空间 / 实例环境'}</span>
              <span className="text-[10px] font-mono opacity-70">{workspaces.length} {en ? 'instances' : '个环境'}</span>
            </div>

            {/* Workspace items list */}
            <div className="p-1.5 space-y-0.5 max-h-56 overflow-y-auto">
              {workspaces.map((ws) => {
                const isSelected = ws.id === activeId
                const itemColor = ws.colorBadge || (ws.mode === 'managed' ? '#38bdf8' : '#10b981')

                return (
                  <div
                    key={ws.id}
                    onClick={() => {
                      onSwitch(ws.id)
                      setMenuOpen(false)
                    }}
                    className={`group px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? isDark
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-sky-50 text-sky-900 font-medium'
                        : isDark
                        ? 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: itemColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{ws.name}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {ws.mode === 'managed'
                            ? (en ? `Local engine · :${ws.managedPort || 8080}` : `本地引擎 · :${ws.managedPort || 8080}`)
                            : (en ? `Remote attach · ${ws.remoteUrl || 'Cloud cluster'}` : `远程直连 · ${ws.remoteUrl || '云端集群'}`)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {onEditWorkspace && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpen(false)
                            onEditWorkspace(ws)
                          }}
                          title={en ? 'Edit this workspace' : '编辑此工作区配置'}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            isDark
                              ? 'hover:bg-slate-700 text-slate-400'
                              : 'hover:bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Settings2 size={12} />
                        </button>
                      )}
                      {isSelected && <Check size={14} className="text-sky-500" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Actions Footer */}
            <div
              className={`p-1.5 border-t space-y-0.5 ${
                isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onAddWorkspace()
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs transition-colors cursor-pointer ${
                  isDark
                    ? 'hover:bg-slate-800 text-sky-400 hover:text-sky-300'
                    : 'hover:bg-slate-100 text-sky-700 hover:text-sky-900'
                }`}
              >
                <Plus size={13} />
                <span>{en ? 'New workspace / instance...' : '新建工作空间 / 实例...'}</span>
              </button>

              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={handleOpenTerminal}
                  title={en ? 'Open current project in terminal' : '在系统终端中打开当前工程目录'}
                  className={`flex-1 px-2 py-1 rounded text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                    isDark
                      ? 'border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal size={11} className="text-emerald-500" />
                  <span>{en ? 'Terminal' : '终端打开'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenVSCode}
                  title={en ? 'Open project in VS Code' : '在 VS Code 中打开工程'}
                  className={`flex-1 px-2 py-1 rounded text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                    isDark
                      ? 'border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 size={11} className="text-sky-500" />
                  <span>VS Code</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
