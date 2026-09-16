import React from 'react'
import type { ServerStatus } from '@shared-types/index.js'
import { Circle, Radio, Activity } from 'lucide-react'

interface Props {
  status: ServerStatus
  isDark?: boolean
  onClick?: () => void
}

export const StatusIndicator: React.FC<Props> = ({ status, isDark: isDarkProp, onClick }) => {
  const isDark =
    typeof isDarkProp === 'boolean'
      ? isDarkProp
      : typeof document !== 'undefined'
      ? !document.documentElement.classList.contains('light')
      : true

  const getStatusConfig = () => {
    switch (status.state) {
      case 'running':
        return {
          color: isDark ? '#10b981' : '#047857',
          bg: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
          border: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
          label: status.mode === 'managed' ? `运行中 :${status.port}` : '远程可访问',
          dotClass: 'animate-pulse',
        }
      case 'starting':
        return {
          color: isDark ? '#f59e0b' : '#b45309',
          bg: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
          border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
          label: status.error ? '重连中...' : status.mode === 'remote' ? '连接中...' : '启动中...',
          dotClass: 'animate-pulse',
        }
      case 'stopping':
        return {
          color: isDark ? '#f59e0b' : '#b45309',
          bg: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
          border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
          label: '停止中...',
          dotClass: '',
        }
      case 'error':
        return {
          color: isDark ? '#ef4444' : '#b91c1c',
          bg: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
          border: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
          label: '服务异常',
          dotClass: '',
        }
      case 'stopped':
      default:
        return {
          color: isDark ? '#64748b' : '#475569',
          bg: isDark ? 'rgba(100, 116, 139, 0.12)' : '#f1f5f9',
          border: isDark ? 'rgba(100, 116, 139, 0.3)' : '#e2e8f0',
          label: '已停止',
          dotClass: '',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <button
      onClick={onClick}
      className="no-drag flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        cursor: onClick ? 'pointer' : 'default',
      }}
      title="点击查看运行状态与服务日志"
    >
      <span
        className={`w-2 h-2 rounded-full ${config.dotClass}`}
        style={{ backgroundColor: config.color }}
      />
      <span className="font-mono tracking-tight">{config.label}</span>
    </button>
  )
}
