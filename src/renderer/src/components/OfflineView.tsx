import React, { useState } from 'react'
import type { AppLanguage, ServerStatus } from '@shared-types/index.js'
import { AlertCircle, Play, Terminal, Settings, RefreshCw, Power, FolderPlus } from 'lucide-react'

interface Props {
  status: ServerStatus
  isDark?: boolean
  language?: AppLanguage
  onStartServer: () => void
  onOpenLogs: () => void
  onOpenSettings: () => void
  onSelectWorkspace?: (dir: string) => void
}

export const OfflineView: React.FC<Props> = ({
  status,
  isDark = true,
  language = 'zh-CN',
  onStartServer,
  onOpenLogs,
  onOpenSettings,
  onSelectWorkspace,
}) => {
  const en = language === 'en'
  const [starting, setStarting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const isError = status.state === 'error'

  const handleStart = async () => {
    setStarting(true)
    try {
      onStartServer()
    } finally {
      setTimeout(() => setStarting(false), 1000)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      // Electron adds 'path' property to File
      const fullPath = (file as any).path || file.name
      if (fullPath && onSelectWorkspace) {
        onSelectWorkspace(fullPath)
      }
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col items-center justify-center p-8 select-none animate-fade-in transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div
        className={`w-full max-w-lg p-8 rounded-2xl border flex flex-col items-center text-center shadow-2xl transition-all relative ${
          isDragging
            ? 'border-sky-500 ring-4 ring-sky-500/20 scale-[1.02]'
            : isDark
            ? 'bg-[#0f172a] border-slate-800 shadow-slate-950/80'
            : 'bg-white border-slate-200 shadow-slate-200/50'
        }`}
      >
        {isDragging ? (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-sky-500/10 border border-sky-500/30 text-sky-500 animate-bounce">
            <FolderPlus size={30} />
          </div>
        ) : (
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
              isError
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
                : isDark
                ? 'bg-slate-900/80 border border-slate-800 text-slate-400'
                : 'bg-slate-100 border border-slate-200 text-slate-500'
            }`}
          >
            {isError ? <AlertCircle size={28} /> : <Power size={28} />}
          </div>
        )}

        <h2 className={`text-base font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          {isDragging
            ? (en ? 'Drop to load the workspace directory' : '松开鼠标即可载入工作空间目录')
            : isError
            ? status.mode === 'remote'
              ? (en ? 'Remote server connection failed' : '远程服务器连接失败')
              : (en ? 'HarnessFrame service error' : 'HarnessFrame 后台服务异常')
            : status.mode === 'remote'
            ? (en ? 'Remote service is not connected' : '远程服务未连接')
            : (en ? 'HarnessFrame service is stopped' : 'HarnessFrame 服务已停止')}
        </h2>

        <p className={`text-xs mb-6 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isDragging
            ? (en ? 'Drop a local project folder to set the workspace context and start the service.' : '将本地工程目录拖入客户端，客户端将自动锁定上下文并启动服务。')
            : isError
            ? status.error || (status.mode === 'remote' ? (en ? 'The remote service is unavailable. Check the network or configuration.' : '目标远程服务不可达，请检查网络或配置。') : (en ? 'The background process exited unexpectedly. Check the logs.' : '后台进程遇到问题并退出，请查看日志排查。'))
            : status.mode === 'remote'
            ? (en ? `Remote Attach mode${status.url ? ` (${status.url})` : ''}. Use the button below to connect.` : `当前处于远程直连模式${status.url ? ` (${status.url})` : ''}。点击下方按钮尝试连接。`)
            : (en ? 'The local service is stopped. Drop a project folder or use the button below to start it.' : '当前本地后台服务处于停止状态。拖入项目文件夹或点击下方按钮即可一键启动服务。')}
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-900/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {starting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} className="fill-current" />
            )}
            <span>
              {isError
                ? status.mode === 'remote'
                  ? (en ? 'Reconnect remote' : '重新连接远程')
                  : (en ? 'Restart service' : '重新拉起服务')
                : status.mode === 'remote'
                ? (en ? 'Connect remote service' : '连接远程服务')
                : (en ? 'Start local service' : '启动本地服务')}
            </span>
          </button>

          <button
            onClick={onOpenLogs}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
            }`}
          >
            <Terminal size={14} className="text-emerald-500" />
            <span>{en ? 'View logs' : '查看日志'}</span>
          </button>

          <button
            onClick={onOpenSettings}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
            }`}
          >
            <Settings size={14} className="text-sky-500" />
            <span>{en ? 'Preferences' : '偏好设置'}</span>
          </button>
        </div>

        {/* Drag & Drop Hint */}
        <div className={`mt-5 pt-4 border-t w-full text-[11px] flex items-center justify-center gap-1.5 ${
          isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-400'
        }`}>
          <span>{en ? '💡 Tip: Drop a project folder here from Finder or File Explorer to import it.' : '💡 提示：可直接将 Finder / 资源管理器中的项目文件夹拖入此处快速导入'}</span>
        </div>
      </div>
    </div>
  )
}
