import React from 'react'
import type { ServerStatus } from '@shared-types/index.js'
import { Terminal, Settings } from 'lucide-react'
import logoImg from '../assets/logo.png'

interface Props {
  status: ServerStatus
  isDark?: boolean
  onOpenLogs: () => void
  onOpenSettings: () => void
}

export const LoadingSplash: React.FC<Props> = ({
  status,
  isDark = true,
  onOpenLogs,
  onOpenSettings,
}) => {
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-8 select-none animate-fade-in transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer glowing animated ring */}
        <div
          className="w-24 h-24 rounded-full animate-spin-slow border-2 border-dashed border-sky-500/40"
          style={{ boxShadow: isDark ? '0 0 35px rgba(56, 189, 248, 0.2)' : '0 0 25px rgba(14, 165, 233, 0.15)' }}
        />
        {/* Inner pulsing logo */}
        <div
          className={`absolute w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg p-2 animate-pulse ${
            isDark
              ? 'bg-slate-900/90 border border-sky-500/30 shadow-sky-950/60'
              : 'bg-white border border-sky-500/30 shadow-sky-100'
          }`}
        >
          <img src={logoImg} alt="HarnessFrame" className="w-full h-full object-contain" />
        </div>
      </div>

      <h1 className={`text-lg font-semibold tracking-wide mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        正在启动 HarnessFrame...
      </h1>

      <p
        className={`text-xs max-w-md text-center leading-relaxed mb-6 font-mono ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {status.mode === 'managed'
          ? `正在拉起本地引擎并绑定端口 :${status.port}，请稍候...`
          : `正在尝试连接远程服务目标 ${status.url || ''}...`}
      </p>

      {/* Quick Troubleshooting Links */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenLogs}
          className={`px-3 py-1.5 rounded-md text-xs border flex items-center gap-1.5 transition-colors cursor-pointer ${
            isDark
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
          }`}
        >
          <Terminal size={13} className="text-emerald-500" />
          <span>查看实时启动日志</span>
        </button>

        <button
          onClick={onOpenSettings}
          className={`px-3 py-1.5 rounded-md text-xs border flex items-center gap-1.5 transition-colors cursor-pointer ${
            isDark
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
          }`}
        >
          <Settings size={13} className="text-sky-500" />
          <span>配置端口与模式</span>
        </button>
      </div>
    </div>
  )
}
