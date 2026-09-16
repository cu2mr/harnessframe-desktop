import React, { useState, useEffect, useRef } from 'react'
import type { ServerStatus } from '@shared-types/index.js'
import {
  X,
  ExternalLink,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react'

export const FloatingDeskPet: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus>({
    state: 'starting',
    mode: 'managed',
    port: 8080,
    url: null,
    pid: null,
    startedAt: null,
    error: null,
  })

  const [isListening, setIsListening] = useState(false)
  const [speech, setSpeech] = useState<string>('嗨！我是你的 Codex 编程伴侣小云~')
  const [isSpeechOpen, setIsSpeechOpen] = useState(true)
  const [eyeExpression, setEyeExpression] = useState<'wink' | 'blink' | 'happy' | 'focus'>('wink')
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ensure body and html backgrounds are 100% transparent for desktop floating
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    const root = document.getElementById('root')
    if (root) {
      root.style.background = 'transparent'
    }

    if (window.dshDesktop) {
      void window.dshDesktop.getServerStatus().then(setStatus)
      const unsub = window.dshDesktop.onServerStatusChange((newStatus) => {
        setStatus(newStatus)
      })
      return () => {
        unsub()
      }
    }
  }, [])

  // Dynamic eye blinking animation
  useEffect(() => {
    const interval = setInterval(() => {
      setEyeExpression('blink')
      setTimeout(() => {
        setEyeExpression('wink')
      }, 300)
    }, 4500)
    return () => clearInterval(interval)
  }, [])

  const triggerSpeech = (text: string, duration = 5000) => {
    setSpeech(text)
    setIsSpeechOpen(true)
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
    speechTimeoutRef.current = setTimeout(() => {
      setIsSpeechOpen(false)
    }, duration)
  }

  const handleVoiceWaveClick = () => {
    setIsListening((prev) => !prev)
    if (!isListening) {
      setEyeExpression('happy')
      triggerSpeech('正在倾听您的编程思路... 说出卡壳的逻辑或需求吧！', 6000)
    } else {
      setEyeExpression('wink')
      triggerSpeech('小云收到！按住我可以随意拖动到屏幕任意角落哦~', 4000)
    }
  }

  const handlePetBodyClick = () => {
    const quotes = [
      '主人加油！代码像行云流水，逻辑越来越清晰啦~',
      '遇到复杂的异步状态？试试把它拆成两个纯函数！',
      '服务器在 8080 端口稳定守护，长任务跑完我会提醒你~',
      '写代码累了要多眨眼，站起来喝杯水活动活动腰椎！',
      '随时双击我或点击按钮呼出主窗口进行深度 AI 对话~',
    ]
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]
    setEyeExpression('happy')
    triggerSpeech(randomQuote)
    setTimeout(() => setEyeExpression('wink'), 1500)
  }

  const handleOpenMainWindow = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.focusMainWindow()
    }
  }

  const handleCloseFloatingPet = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.toggleFloatingPet()
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-2 select-none overflow-hidden relative group">
      {/* Top Floating Speech Bubble */}
      {isSpeechOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            handleOpenMainWindow()
          }}
          className="no-drag mb-1 px-3 py-1.5 rounded-xl border border-sky-400/40 bg-slate-900/90 backdrop-blur-md text-sky-200 text-[11px] leading-tight text-center shadow-xl animate-fade-in cursor-pointer max-w-[200px]"
        >
          <span>{speech}</span>
          <div className="w-2 h-2 rotate-45 mx-auto -mb-2 mt-1 border-r border-b bg-slate-900 border-sky-400/40" />
        </div>
      )}

      {/* Main Pixel Cloud Robot Character (Draggable Region) */}
      <div
        onClick={handlePetBodyClick}
        onDoubleClick={handleOpenMainWindow}
        className="drag flex flex-col items-center cursor-grab active:cursor-grabbing transition-transform duration-300 hover:scale-105 active:scale-95"
        style={{ WebkitAppRegion: 'drag' } as any}
        title="Codex 桌面悬浮小伴侣 · 按住拖拽，双击呼出主控制台"
      >
        {/* Pixel Cloud Robot SVG Visual (High Fidelity Pixel Art Match) */}
        <div className="relative animate-bounce-slow">
          <svg
            width="112"
            height="116"
            viewBox="0 0 112 116"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="filter drop-shadow-lg"
          >
            {/* Outer Pixel Border: Cloud Lobe Shape */}
            <path
              d="M 28 20 H 40 V 12 H 72 V 20 H 84 V 32 H 96 V 64 H 88 V 76 H 76 V 84 H 68 V 92 H 72 V 104 H 60 V 96 H 52 V 104 H 40 V 92 H 44 V 84 H 32 V 76 H 24 V 64 H 16 V 32 H 28 V 20 Z"
              fill="#18233c"
            />

            {/* Cloud Main Body: Vibrant Pixel Blue */}
            <path
              d="M 32 24 H 44 V 16 H 68 V 24 H 80 V 36 H 92 V 60 H 84 V 72 H 72 V 80 H 64 V 88 H 68 V 100 H 64 V 92 H 48 V 100 H 44 V 88 H 40 V 80 H 28 V 72 H 20 V 36 H 32 V 24 Z"
              fill="#4f86f7"
            />

            {/* Head Highlights / Fluffy Shading */}
            <path
              d="M 36 24 H 44 V 20 H 64 V 24 H 76 V 32 H 84 V 44 H 80 V 36 H 72 V 28 H 48 V 24 H 36 Z"
              fill="#7ba7ff"
            />

            {/* Face CRT Monitor Outer Border */}
            <rect x="30" y="32" width="52" height="38" rx="10" fill="#111827" />

            {/* Face CRT Screen (Dark Navy Glass) */}
            <rect x="33" y="35" width="46" height="32" rx="7" fill="#1b243b" />

            {/* Glowing Pixel Eye Prompt Expression: left ">", right "-" or "_" or "^" */}
            <g fill="#46efff">
              {/* Left Eye: Pixel Prompt ">" */}
              <rect x="42" y="44" width="4" height="4" />
              <rect x="46" y="48" width="4" height="4" />
              <rect x="42" y="52" width="4" height="4" />

              {/* Right Eye: Animated based on eyeExpression */}
              {eyeExpression === 'blink' ? (
                // Blinking closed eye: flat horizontal dash
                <rect x="58" y="50" width="12" height="3" rx="1.5" />
              ) : eyeExpression === 'happy' ? (
                // Smiling happy winking eye: "^"
                <>
                  <rect x="58" y="50" width="4" height="3" />
                  <rect x="62" y="46" width="4" height="3" />
                  <rect x="66" y="50" width="4" height="3" />
                </>
              ) : (
                // Default wink / prompt cursor: "-" / "_"
                <rect x="58" y="50" width="10" height="4" rx="1" />
              )}
            </g>

            {/* Torso Symbol: Cyan Prompt Logo on Chest "> -" */}
            <g fill="#ffffff" opacity="0.9">
              <path d="M 50 78 L 54 81 L 50 84" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="57" y1="81" x2="62" y2="81" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Left & Right Arms (Hanging cute) */}
            <rect x="22" y="52" width="8" height="18" rx="4" fill="#3c6edc" />
            <rect x="82" y="52" width="8" height="18" rx="4" fill="#3c6edc" />

            {/* Left & Right Feet */}
            <rect x="42" y="94" width="8" height="8" rx="3" fill="#3c6edc" />
            <rect x="62" y="94" width="8" height="8" rx="3" fill="#3c6edc" />
          </svg>
        </div>
      </div>

      {/* Floating Action Controls on Hover */}
      <div className="no-drag absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-sm p-1 rounded-lg border border-slate-700/60 shadow-lg">
        <button
          onClick={handleOpenMainWindow}
          className="p-1 rounded text-slate-400 hover:text-sky-400 transition-colors"
          title="聚焦主控制台"
        >
          <ExternalLink size={12} />
        </button>
        <button
          onClick={handleCloseFloatingPet}
          className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
          title="关闭悬浮宠物"
        >
          <X size={12} />
        </button>
      </div>

      {/* Circular Voice/Audio Waveform Button (Matching Screenshot Exact Design) */}
      <div className="no-drag mt-2 flex flex-col items-center">
        <button
          onClick={handleVoiceWaveClick}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
            isListening
              ? 'bg-sky-500 text-white scale-110 ring-4 ring-sky-400/40 shadow-sky-500/50'
              : 'bg-white hover:bg-slate-50 text-slate-900 hover:scale-105 border border-slate-200 shadow-lg'
          }`}
          title={isListening ? '点击停止倾听' : '点击开启小云语音倾听模式'}
        >
          {/* Audio Waveform Bars (Pixel / Vector bars) */}
          <div className="flex items-center gap-[3px] h-5 justify-center">
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-white h-4 animate-wave-1'
                  : 'bg-slate-900 h-2'
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-white h-5 animate-wave-2'
                  : 'bg-slate-900 h-3.5'
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-white h-6 animate-wave-3'
                  : 'bg-slate-900 h-5'
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-white h-4 animate-wave-2'
                  : 'bg-slate-900 h-3'
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-white h-2.5 animate-wave-1'
                  : 'bg-slate-900 h-1.5'
              }`}
            />
          </div>
        </button>
      </div>
    </div>
  )
}
