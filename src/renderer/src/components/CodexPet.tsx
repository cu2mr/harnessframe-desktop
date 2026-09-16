import React, { useState, useEffect, useRef } from 'react'
import type { ServerStatus, PetType, PetMood, PetState } from '@shared-types/index.js'
import {
  Sparkles,
  Heart,
  Cookie,
  HelpCircle,
  Volume2,
  RefreshCw,
  Send,
  Bot,
  Zap,
  Coffee,
  CheckCircle2,
} from 'lucide-react'

interface Props {
  status: ServerStatus
  isDark?: boolean
  mode?: 'panel' | 'compact' | 'floating'
  onClick?: () => void
  onSendToChat?: (text: string) => void
}

const PET_PROFILES: Record<
  PetType,
  {
    name: string
    title: string
    icon: string
    color: string
    defaultSpeech: string
    snack: string
  }
> = {
  robot: {
    name: '小云 (Codex Cloud Bot)',
    title: 'Codex 桌面悬浮机器人',
    icon: '🤖',
    color: '#4f86f7',
    defaultSpeech: '嗨！我是你的 Codex 编程桌面悬浮伴侣小云~',
    snack: '⚡ 纯净算力包',
  },
  cat: {
    name: '纳米米 (Cyber Kitty)',
    title: '赛博代码伴侣猫',
    icon: '🐱',
    color: '#38bdf8',
    defaultSpeech: '喵~ 主人写代码手速好快！我在键盘旁陪着你~',
    snack: '🐟 赛博小鱼干',
  },
  dog: {
    name: '旺财 (Robo Shiba)',
    title: '活力调试柴犬',
    icon: '🐶',
    color: '#f59e0b',
    defaultSpeech: '汪汪！今天的单元测试写了吗？保持专注，加油！',
    snack: '🍖 机械骨头棒',
  },
  duck: {
    name: '嘎嘎鸭 (Rubber Duck)',
    title: '橡皮鸭调试大师',
    icon: '🦆',
    color: '#eab308',
    defaultSpeech: '嘎！卡壳了吗？请对着我把代码逻辑一行行念一遍吧！',
    snack: '🍞 吐司面包屑',
  },
  owl: {
    name: '灵羽 (Think Owl)',
    title: '架构守望者',
    icon: '🦉',
    color: '#a855f7',
    defaultSpeech: '呼~ 架构的奥秘在于低耦合。发现性能瓶颈随时唤我。',
    snack: '🫐 智慧魔法果',
  },
}

const RANDOM_QUOTES: Record<PetType, string[]> = {
  robot: [
    '按住我可以自由拖动到桌面任意位置哦~',
    '遇到复杂的异步状态？试试把它拆成两个纯函数！',
    '点击下方的声波按钮，随时跟我说说话吧！',
    '服务运行时，我会根据本地状态陪你一起工作。',
  ],
  cat: [
    '喵呜~ 刚刚的代码缩进很整齐，奖励你一个摸头！',
    '服务器运转平稳，今天又是没有 Bug 的美妙一天~',
    '累了吗？按 ⌘+B 看看侧边栏，或者休息一下喝杯水喵~',
    '代码像猫毛一样优雅，逻辑像猫爪一样轻盈！',
  ],
  dog: [
    '汪！刚才跑测试全绿了！主人太厉害啦！',
    '如果遇到困难，先把问题拆成可以单独验证的小步骤！',
    '按 ⌘+1~9 可以瞬间切换你的工作空间哦！',
    '站起来伸个懒腰吧！久坐对腰椎不好汪~',
  ],
  duck: [
    '嘎嘎！经典小鸭调试法则：把 Bug 说清楚，问题就解决了一半！',
    '仔细看看，变量名是不是拼写错误或者异步没 await？',
    '这个接口的入参可能是 null 吗？空指针异常可是常客！',
    '对我讲一遍，通常能更快发现遗漏的前提条件。',
  ],
  owl: [
    '呼~ 好的架构是演化出来的，不必追求第一版就尽善尽美。',
    'WebContentsView 图层已经协同收缩，多任务并行效率倍增。',
    '内存占用良好，V8 垃圾回收周期非常平缓。',
    '遇到复杂的业务流，不妨拆解为有限状态机。',
  ],
}

export const CodexPet: React.FC<Props> = ({
  status,
  isDark = true,
  mode = 'panel',
  onClick,
  onSendToChat,
}) => {
  const [petState, setPetState] = useState<PetState>(() => {
    try {
      const saved = localStorage.getItem('dsh_pet_state')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      type: 'robot',
      name: '小云',
      level: 1,
      exp: 60,
      hunger: 90,
      affinity: 85,
      enabled: true,
    }
  })

  const [mood, setMood] = useState<PetMood>('idle')
  const [speech, setSpeech] = useState<string>(PET_PROFILES[petState.type].defaultSpeech)
  const [isSpeechVisible, setIsSpeechVisible] = useState(true)
  const [isFeeding, setIsFeeding] = useState(false)
  const [duckInput, setDuckInput] = useState('')
  const [duckReply, setDuckReply] = useState<string | null>(null)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dsh_pet_state', JSON.stringify(petState))
    } catch {}
  }, [petState])

  // React to server status
  useEffect(() => {
    if (status.state === 'running') {
      setMood('coding')
      triggerSpeech(
        petState.type === 'duck'
          ? '嘎！Harness 服务在 8080 端口平稳运行，随时为你调试！'
          : '服务运行中，我已经戴好眼镜陪你一起敲代码啦！'
      )
    } else if (status.state === 'error') {
      setMood('alert')
      triggerSpeech('检测到服务异常，可以按 ⌘+D 打开诊断面板检查详情。')
    } else if (status.state === 'stopped') {
      setMood('sleeping')
      triggerSpeech('呼噜噜... 服务已休眠，我也先打个盹 Zzz...')
    } else {
      setMood('idle')
    }
  }, [status.state, petState.type])

  // React to native companion mood triggers from main IPC
  useEffect(() => {
    if (!window.dshDesktop?.onCompanionMoodTrigger) return
    const cleanup = window.dshDesktop.onCompanionMoodTrigger((data) => {
      if (data.mood) {
        setMood(data.mood)
      }
      if (data.reason) {
        triggerSpeech(data.reason, 5000)
      }
    })
    return cleanup
  }, [])

  // System idle auto-rest detection (5 minutes inactivity)
  useEffect(() => {
    let idleTimer: NodeJS.Timeout
    const resetIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        setMood('sleeping')
        triggerSpeech('主人专注思考好久了，我也打个盹休息会儿 Zzz...', 4000)
      }, 5 * 60 * 1000)
    }
    resetIdle()
    window.addEventListener('mousemove', resetIdle)
    window.addEventListener('keydown', resetIdle)
    return () => {
      clearTimeout(idleTimer)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
    }
  }, [])

  const triggerSpeech = (text: string, duration = 6000) => {
    setSpeech(text)
    setIsSpeechVisible(true)
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
    speechTimeoutRef.current = setTimeout(() => {
      setIsSpeechVisible(false)
    }, duration)
  }

  const handlePetClick = () => {
    const quotes = RANDOM_QUOTES[petState.type]
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]
    setMood('happy')
    triggerSpeech(randomQuote)

    // Increase affinity and exp
    setPetState((prev) => {
      const nextExp = prev.exp + 10
      const nextLevel = nextExp >= 100 ? prev.level + 1 : prev.level
      return {
        ...prev,
        affinity: Math.min(100, prev.affinity + 5),
        exp: nextExp >= 100 ? nextExp - 100 : nextExp,
        level: nextLevel,
      }
    })

    setTimeout(() => {
      if (status.state === 'running') setMood('coding')
      else if (status.state === 'stopped') setMood('sleeping')
      else setMood('idle')
    }, 2000)
  }

  const handleFeed = () => {
    setIsFeeding(true)
    setMood('happy')
    triggerSpeech(`好吃好吃！饱食度满满，精力充沛~ (+15 EXP)`)

    setPetState((prev) => {
      const nextExp = prev.exp + 15
      const nextLevel = nextExp >= 100 ? prev.level + 1 : prev.level
      return {
        ...prev,
        hunger: Math.min(100, prev.hunger + 20),
        exp: nextExp >= 100 ? nextExp - 100 : nextExp,
        level: nextLevel,
      }
    })

    setTimeout(() => {
      setIsFeeding(false)
      if (status.state === 'running') setMood('coding')
      else setMood('idle')
    }, 1500)
  }

  const handleDuckDebugSubmit = () => {
    if (!duckInput.trim()) return
    const text = duckInput.trim()
    setDuckInput('')

    // Socratic duck questioning
    let response = ''
    if (text.includes('报错') || text.includes('error') || text.includes('crash')) {
      response = `🦆 嘎！小鸭提问：报错是在哪一行抛出的？相关的参数入参是否有打印 console.log / 断点检查？`
    } else if (text.includes('状态') || text.includes('state') || text.includes('不更新')) {
      response = `🦆 嘎！小鸭提问：组件是否处于异步闭包中读取了旧的 state？或者依赖项数组没有包含该变量？`
    } else {
      response = `🦆 嘎！小鸭倾听中：“${text.slice(0, 24)}...”。请思考：如果把这个逻辑拆成两个简单的小函数，哪一步最容易出意外？`
    }

    setDuckReply(response)
    triggerSpeech(response, 8000)
  }

  const handleSendDuckToAi = () => {
    if (!duckReply) return
    if (onSendToChat) {
      onSendToChat(`【小鸭调试法倾诉】我遇到了以下代码疑问：${duckReply}，请帮我分析原因并给出修复方案。`)
    }
  }

  const currentProfile = PET_PROFILES[petState.type]

  // Compact Mode (for HeaderBar pill)
  if (mode === 'compact') {
    const handleCompactClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      handlePetClick()
      if (onClick) {
        onClick()
      }
    }

    return (
      <div className="relative no-drag">
        <div
          onClick={handleCompactClick}
          className={`no-drag px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 select-none ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 hover:border-amber-500/60 text-slate-200'
              : 'bg-white border-slate-200 hover:border-amber-400 text-slate-800 shadow-2xs'
          }`}
          title={`${currentProfile.name} (Lv.${petState.level}) · ${speech ? `「${speech}」 · ` : ''}点击呼出伴写侧边栏`}
        >
          <span className="text-sm relative leading-none">
            {currentProfile.icon}
            {mood === 'coding' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            {mood === 'happy' && (
              <span className="absolute -top-1.5 -right-1.5 text-[10px] animate-bounce">💖</span>
            )}
          </span>
          <span className="text-[10px] font-medium font-mono text-amber-400 font-bold">Lv.{petState.level}</span>
        </div>
      </div>
    )
  }

  // Full Panel Mode (for Codex SidePanel)
  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col gap-3.5 transition-all select-none ${
        isDark
          ? 'bg-slate-950/70 border-slate-800/80 text-slate-200'
          : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
      }`}
    >
      {/* Top Pet Profile & Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl p-1 rounded-lg bg-sky-500/10 border border-sky-500/20">
            {currentProfile.icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold">{currentProfile.name}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Lv.{petState.level}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">{currentProfile.title}</div>
          </div>
        </div>

        {/* Pet Switcher Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
          {(['robot', 'duck', 'cat', 'dog', 'owl'] as PetType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setPetState((prev) => ({ ...prev, type: t }))
                triggerSpeech(PET_PROFILES[t].defaultSpeech)
              }}
              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors cursor-pointer ${
                petState.type === t
                  ? isDark
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'bg-sky-50 text-sky-700 border border-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={PET_PROFILES[t].name}
            >
              {PET_PROFILES[t].icon}
            </button>
          ))}
        </div>
      </div>

      {/* Pop out to Desktop Floating Pet Button */}
      <button
        onClick={() => {
          if (window.dshDesktop) {
            void window.dshDesktop.toggleFloatingPet()
          }
        }}
        className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-xs ${
          isDark
            ? 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-300'
            : 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base animate-pulse">🤖</span>
          <span className="font-semibold">开启桌面悬浮小宠物</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">
          独立置顶 ➔
        </span>
      </button>

      {/* Animated Pet Stage & Speech Bubble */}
      <div
        className={`relative p-5 rounded-xl border flex flex-col items-center justify-center overflow-hidden min-h-[140px] ${
          isDark
            ? 'bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/80'
            : 'bg-gradient-to-b from-slate-50 to-slate-100/60 border-slate-200'
        }`}
      >
        {/* Floating Speech Bubble */}
        {isSpeechVisible && (
          <div
            className={`absolute top-2 left-4 right-4 p-2 rounded-xl text-[11px] leading-snug border transition-all animate-fade-in shadow-lg z-10 ${
              isDark
                ? 'bg-slate-900/95 border-sky-500/30 text-sky-200'
                : 'bg-white/95 border-sky-300 text-sky-900'
            }`}
          >
            <div className="flex items-start gap-1.5">
              <span className="text-sky-400 shrink-0 mt-0.5">💬</span>
              <span className="flex-1">{speech}</span>
            </div>
            {/* Bubble arrow */}
            <div
              className={`w-2 h-2 rotate-45 mx-auto -mb-3 mt-1 border-r border-b ${
                isDark ? 'bg-slate-900 border-sky-500/30' : 'bg-white border-sky-300'
              }`}
            />
          </div>
        )}

        {/* Animated Mascot Character */}
        <div
          onClick={handlePetClick}
          className="cursor-pointer group flex flex-col items-center transition-transform active:scale-95 pt-4"
        >
          <div className="text-5xl relative transition-transform duration-300 group-hover:scale-110">
            {currentProfile.icon}

            {/* Mood particle effects */}
            {mood === 'coding' && (
              <span className="absolute -top-1 -right-2 text-sm animate-bounce">⚡</span>
            )}
            {mood === 'happy' && (
              <span className="absolute -top-2 -right-1 text-sm animate-ping">💖</span>
            )}
            {mood === 'sleeping' && (
              <span className="absolute -top-2 -right-3 text-xs font-mono text-indigo-400 font-bold animate-pulse">
                Zzz...
              </span>
            )}
            {isFeeding && (
              <span className="absolute -bottom-2 -right-2 text-sm animate-bounce">✨</span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <span>
              {mood === 'coding'
                ? '💻 专注敲代码中'
                : mood === 'sleeping'
                ? '💤 休眠打盹中'
                : mood === 'alert'
                ? '⚠️ 警惕排查'
                : '🐾 悠闲陪伴'}
            </span>
            <span className="text-slate-600">· 点击抚摸</span>
          </div>
        </div>
      </div>

      {/* Pet Stats & Progress Bars */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div
          className={`p-2 rounded-lg border ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex justify-between text-slate-400 mb-1">
            <span>经验成长</span>
            <span>{petState.exp}/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-500"
              style={{ width: `${petState.exp}%` }}
            />
          </div>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex justify-between text-slate-400 mb-1">
            <span>亲密度</span>
            <span>{petState.affinity}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${petState.affinity}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pet Action Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleFeed}
          disabled={isFeeding}
          className={`flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDark
              ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
          }`}
        >
          <Cookie size={13} className="text-amber-400" />
          <span>投喂点心</span>
        </button>

        <button
          onClick={handlePetClick}
          className={`flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDark
              ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
          }`}
        >
          <Heart size={13} className="text-rose-400" />
          <span>抚摸互动</span>
        </button>
      </div>

      {/* Rubber Duck Debugging Interactive Box */}
      <div
        className={`p-3 rounded-xl border text-xs space-y-2 ${
          isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
          <div className="flex items-center gap-1">
            <span>🦆</span>
            <span>小鸭调试法 (Rubber Duck Debugging)</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">
          当思路卡壳时，向你的桌面宠物描述问题，往往能瞬间自悟 Bug 所在！
        </p>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={duckInput}
            onChange={(e) => setDuckInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDuckDebugSubmit()
            }}
            placeholder="把卡住的逻辑讲给小鸭听..."
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-amber-500 ${
              isDark
                ? 'bg-slate-950 border-slate-700/80 text-slate-100'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
          <button
            onClick={handleDuckDebugSubmit}
            disabled={!duckInput.trim()}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Send size={13} />
          </button>
        </div>

        {duckReply && onSendToChat && (
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
              小鸭已提供引导思考
            </span>
            <button
              onClick={handleSendDuckToAi}
              className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Bot size={11} />
              <span>转入 AI 深度解答</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
