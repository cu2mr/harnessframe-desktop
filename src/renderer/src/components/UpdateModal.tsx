import React, { useState, useEffect } from 'react'
import type { UpdateCheckResult } from '@shared-types/index.js'
import { X, Sparkles, CheckCircle2, Download, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react'
import logoImg from '../assets/logo.png'

interface Props {
  isOpen: boolean
  isDark?: boolean
  onClose: () => void
}

export const UpdateModal: React.FC<Props> = ({ isOpen, isDark = true, onClose }) => {
  const [checking, setChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    if (isOpen) {
      handleCheckUpdates()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleCheckUpdates = async () => {
    setChecking(true)
    try {
      if (window.dshDesktop) {
        const res = await window.dshDesktop.checkForUpdates()
        setUpdateResult(res)
      } else {
        setUpdateResult({
          status: 'error',
          hasUpdate: false,
          currentVersion: '1.0.0',
          latestVersion: '1.0.0',
          releaseNotes: '桌面更新服务不可用。',
        })
      }
    } catch {
      setUpdateResult({
        status: 'error',
          hasUpdate: false,
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        releaseNotes: '网络检查超时，可稍后重试或访问官网下载。',
      })
    } finally {
      setChecking(false)
    }
  }

  const handleOpenRelease = () => {
    const url = updateResult?.releaseUrl
    if (!url) return
    if (window.dshDesktop) {
      void window.dshDesktop.openExternalUrl(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Logo" className="w-6 h-6 object-contain rounded-md" />
            <span className="font-semibold text-sm">版本与更新检查</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
                {checking ? (
                  <RefreshCw size={28} className="animate-spin text-sky-400" />
                ) : updateResult?.hasUpdate ? (
                  <Download size={28} className="text-amber-400 animate-bounce" />
                ) : (
                  <ShieldCheck size={32} className="text-emerald-400" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full text-[10px]">
                <CheckCircle2 size={12} />
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold tracking-tight">HarnessFrame</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                当前运行版本：<span className="font-mono font-semibold text-sky-400">v{updateResult?.currentVersion || '1.0.0'}</span>
              </p>
            </div>
          </div>

          {/* Status card */}
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1.5">
              <Sparkles size={14} />
              <span>{checking ? '正在检查' : updateResult?.hasUpdate ? '发现新版本可用' : updateResult?.status === 'current' ? '当前版本无需更新' : '尚未确认最新版本'}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              {updateResult?.releaseNotes || '社区预览版；本地引擎需另行安装。'}
            </p>
          </div>

          {/* Release info pill */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
            <span>分发通道: Community Preview</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              预览版本
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <button
            onClick={handleCheckUpdates}
            disabled={checking}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
            }`}
          >
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? '正在检查...' : '重新检查'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenRelease}
              disabled={!updateResult?.releaseUrl}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <span>发行日志</span>
              <ExternalLink size={12} />
            </button>
            <button
              onClick={onClose}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
