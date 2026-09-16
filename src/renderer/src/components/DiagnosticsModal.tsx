import React, { useState, useEffect } from 'react'
import type { DiagnosticReport } from '@shared-types/index.js'
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Zap,
  ShieldCheck,
  Cpu,
  Globe,
  GitBranch,
  Radio,
} from 'lucide-react'

interface Props {
  isOpen: boolean
  isDark?: boolean
  onClose: () => void
  onRestartNeeded?: () => void
}

export const DiagnosticsModal: React.FC<Props> = ({
  isOpen,
  isDark = true,
  onClose,
  onRestartNeeded,
}) => {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [healing, setHealing] = useState(false)
  const [healMessage, setHealMessage] = useState<string | null>(null)

  const fetchDiagnostics = async () => {
    if (!window.dshDesktop) return
    setLoading(true)
    setHealMessage(null)
    try {
      const res = await window.dshDesktop.runDiagnostics()
      setReport(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void fetchDiagnostics()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAutoHeal = async () => {
    if (!window.dshDesktop) return
    setHealing(true)
    setHealMessage(null)
    try {
      const res = await window.dshDesktop.autoHealEnvironment()
      setHealMessage(res.message)
      await fetchDiagnostics()
      if (res.success && onRestartNeeded) {
        onRestartNeeded()
      }
    } finally {
      setHealing(false)
    }
  }

  const handleKillPort = async (port: number) => {
    if (!window.dshDesktop) return
    setHealing(true)
    try {
      const ok = await window.dshDesktop.killPortProcess(port)
      if (ok) {
        setHealMessage(`端口 :${port} 占用进程已成功释放！`)
        await fetchDiagnostics()
      }
    } finally {
      setHealing(false)
    }
  }

  const handleKillZombies = async () => {
    if (!window.dshDesktop?.killZombieProcesses) return
    setHealing(true)
    try {
      const ok = await window.dshDesktop.killZombieProcesses()
      if (ok) {
        setHealMessage('后台孤儿僵尸进程已成功清理！')
        await fetchDiagnostics()
      }
    } finally {
      setHealing(false)
    }
  }

  const getItemIcon = (id: string) => {
    switch (id) {
      case 'port-check':
        return <Radio size={16} />
      case 'node-runtime':
      case 'engine-integrity':
        return <Cpu size={16} />
      case 'network-probe':
        return <Globe size={16} />
      case 'git-context':
        return <GitBranch size={16} />
      case 'config-integrity':
        return <ShieldCheck size={16} />
      case 'zombie-check':
        return <Zap size={16} />
      default:
        return <Activity size={16} />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <CheckCircle2 size={15} />
            <span>正常</span>
          </span>
        )
      case 'warn':
        return (
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <AlertTriangle size={15} />
            <span>提示</span>
          </span>
        )
      case 'fail':
        return (
          <span className="flex items-center gap-1 text-rose-400 font-medium">
            <XCircle size={15} />
            <span>异常</span>
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-slate-400">
            <RefreshCw size={14} className="animate-spin" />
            <span>检测中</span>
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={onClose} />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-xl rounded-xl border shadow-2xl z-10 flex flex-col max-h-[85vh] ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">环境健康自检与智能诊断修复向导</h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                实时排查端口冲突、运行环境与网络连通度
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              title="重新体检"
              className={`p-1.5 rounded-md transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Heal Message Banner */}
          {healMessage && (
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0 text-sky-400" />
              <span className="flex-1">{healMessage}</span>
            </div>
          )}

          {/* Checklist Items */}
          <div className="space-y-2.5">
            {report?.items.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                  item.status === 'fail'
                    ? isDark
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : 'bg-rose-50 border-rose-200'
                    : item.status === 'warn'
                    ? isDark
                      ? 'bg-amber-950/20 border-amber-800/40'
                      : 'bg-amber-50 border-amber-200'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-slate-400">{getItemIcon(item.id)}</span>
                    <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{item.title}</span>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                <p className={`text-[11px] leading-relaxed pl-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {item.detail}
                </p>

                {/* Conflict Action */}
                {item.actionType === 'kill-port' && item.actionData?.port && (
                  <div className="pl-6 pt-1.5">
                    <button
                      onClick={() => handleKillPort(item.actionData.port)}
                      disabled={healing}
                      className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Zap size={12} />
                      <span>强制释放冲突端口 (:{item.actionData.port})</span>
                    </button>
                  </div>
                )}

                {/* Zombie Process Cleanup Action */}
                {item.actionType === 'kill-zombies' && (
                  <div className="pl-6 pt-1.5">
                    <button
                      onClick={handleKillZombies}
                      disabled={healing}
                      className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Zap size={12} />
                      <span>一键清理孤儿僵尸进程</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recommendation */}
          {report?.recommendedAction && (
            <div className={`p-3 rounded-lg border flex items-center gap-2 ${
              isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertTriangle size={15} className="shrink-0 text-amber-400" />
              <span>{report.recommendedAction}</span>
            </div>
          )}
        </div>

        {/* Footer with One-Click Auto Heal */}
        <div className={`p-4 px-6 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="text-[11px] text-slate-500">
            {report?.canAutoHeal ? '检测到异常项；可在检查配置后重启当前连接' : '全部环境体检项运转良好'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg border text-xs cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              关闭
            </button>

            <button
              onClick={handleAutoHeal}
              disabled={healing}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-sky-900/30 cursor-pointer disabled:opacity-50"
            >
              {healing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              <span>重启当前连接</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
