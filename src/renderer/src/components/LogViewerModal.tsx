import React, { useState, useEffect, useRef } from 'react'
import type { LogEntry } from '@shared-types/index.js'
import {
  X,
  Search,
  Copy,
  Trash2,
  Check,
  ArrowDown,
  Terminal,
} from 'lucide-react'

interface Props {
  isOpen: boolean
  isDark?: boolean
  onClose: () => void
}

export const LogViewerModal: React.FC<Props> = ({ isOpen, isDark: isDarkProp, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const isDark =
    typeof isDarkProp === 'boolean'
      ? isDarkProp
      : typeof document !== 'undefined'
      ? !document.documentElement.classList.contains('light')
      : true

  useEffect(() => {
    if (!isOpen || !window.dshDesktop) return

    // Load existing logs
    void window.dshDesktop.getLogs().then(setLogs)

    // Subscribe to real-time logs
    const unsubscribe = window.dshDesktop.onServerLog((newLog) => {
      setLogs((prev) => [...prev.slice(-999), newLog])
    })

    return () => unsubscribe()
  }, [isOpen])

  useEffect(() => {
    if (autoScroll && isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll, isOpen])

  if (!isOpen) return null

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        log.level.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleCopy = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`
      )
      .join('\n')
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.clearLogs().then(() => setLogs([]))
    }
  }

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0')
  }

  const getLevelStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return isDark
          ? 'text-rose-400 bg-rose-950/40 border-rose-800/50'
          : 'text-rose-700 bg-rose-50 border-rose-200'
      case 'warn':
        return isDark
          ? 'text-amber-400 bg-amber-950/40 border-amber-800/50'
          : 'text-amber-700 bg-amber-50 border-amber-200'
      case 'info':
      default:
        return isDark
          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200'
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in no-drag ${
        isDark ? 'bg-black/75' : 'bg-slate-900/40'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full max-w-5xl h-[85vh] flex flex-col rounded-xl overflow-hidden shadow-2xl border transition-colors ${
          isDark
            ? 'bg-[#090d16] border-slate-800 text-slate-100'
            : 'bg-white border-slate-300 text-slate-900 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/90'
          }`}
        >
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-sky-500" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              HarnessFrame 实时服务日志
            </h2>
            <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ({filteredLogs.length} 条记录)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索日志..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1 text-xs rounded-md border focus:outline-none focus:border-sky-500 w-36 sm:w-48 transition-all ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Level Filters */}
            <div
              className={`flex items-center p-0.5 rounded-md border text-xs ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors cursor-pointer ${
                    filterLevel === lvl
                      ? 'bg-sky-600 text-white font-medium shadow-xs'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'all' ? '全部' : lvl}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                autoScroll
                  ? isDark
                    ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                    : 'bg-sky-50 text-sky-600 border-sky-200'
                  : isDark
                  ? 'bg-slate-950 text-slate-400 border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title={autoScroll ? '自动滚动已开启' : '自动滚动已暂停'}
            >
              <ArrowDown size={13} />
            </button>

            <button
              onClick={handleCopy}
              className={`p-1.5 rounded text-xs border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="复制日志"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>

            <button
              onClick={handleClear}
              className={`p-1.5 rounded text-xs border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border-slate-800'
                  : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200'
              }`}
              title="清空日志"
            >
              <Trash2 size={13} />
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded text-xs transition-colors ml-1 cursor-pointer ${
                isDark
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
                  : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Log Viewer Body */}
        <div
          className={`flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-1 transition-colors ${
            isDark
              ? 'bg-[#070b13] text-slate-200 selection:bg-sky-900 selection:text-sky-100'
              : 'bg-[#f8fafc] text-slate-800 border-t border-slate-100 selection:bg-sky-100 selection:text-sky-900'
          }`}
        >
          {filteredLogs.length === 0 ? (
            <div className={`h-full flex items-center justify-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              暂无日志输出或无匹配筛选结果
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2.5 py-0.5 px-1.5 rounded transition-colors group ${
                  isDark ? 'hover:bg-slate-900/60' : 'hover:bg-slate-200/60'
                }`}
              >
                <span className={`select-none flex-shrink-0 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {formatTime(log.timestamp)}
                </span>
                <span
                  className={`text-[10px] uppercase px-1 py-0.2 rounded border flex-shrink-0 font-medium ${getLevelStyle(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>
                <span className={`flex-shrink-0 text-[11px] select-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  [{log.source}]
                </span>
                <span className={`flex-1 break-all whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}
