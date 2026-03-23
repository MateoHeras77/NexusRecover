import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Send, X, Zap, GitCompare, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function CopilotChat() {
  const {
    chatOpen, toggleChat, chatMessages, chatLoading,
    sendChat, sendBriefing, sendWhatIf,
    optimizeResult, timelineStep,
  } = useStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const handleSend = () => {
    if (!input.trim() || chatLoading) return
    sendChat(input.trim())
    setInput('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!chatOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-20 right-4 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-sm font-medium shadow-lg transition-all z-50"
        data-tour="tour-copilot"
      >
        <Bot size={14} />
        Copilot
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 w-[480px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ maxHeight: '580px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/60 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">NexusRecover Copilot</span>
        </div>
        <button onClick={toggleChat} className="text-slate-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 px-2.5 py-2 border-b border-slate-700/40">
        <button
          onClick={sendBriefing}
          disabled={chatLoading}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700/60 hover:bg-slate-600/60 rounded text-xs text-slate-300 transition-colors disabled:opacity-40"
        >
          <Zap size={10} className="text-yellow-400" />
          Briefing
        </button>
        {timelineStep === 3 && optimizeResult && (
          <button
            onClick={sendWhatIf}
            disabled={chatLoading}
            className="flex items-center gap-1 px-2 py-1 bg-slate-700/60 hover:bg-slate-600/60 rounded text-xs text-slate-300 transition-colors disabled:opacity-40"
          >
            <GitCompare size={10} className="text-blue-400" />
            What-If
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 min-h-0">
        {chatMessages.length === 0 && (
          <div className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
            Ask about the disruption, specific flights, or why the optimizer made certain decisions.
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600/80 text-white rounded-br-sm'
                : 'bg-slate-700/60 text-slate-200 rounded-bl-sm'
            }`}>
              {msg.role === 'user' ? msg.content : (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    ul: ({ children }) => <ul className="mt-1 mb-1.5 space-y-0.5 pl-3">{children}</ul>,
                    ol: ({ children }) => <ol className="mt-1 mb-1.5 space-y-0.5 pl-3 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-300 before:content-['·'] before:mr-1.5 before:text-slate-500">{children}</li>,
                    h3: ({ children }) => <h3 className="text-white font-semibold mt-2 mb-1">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-slate-200 font-medium mt-1.5 mb-0.5">{children}</h4>,
                    code: ({ children }) => <code className="bg-slate-900/60 px-1 rounded text-blue-300 font-mono">{children}</code>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/60 rounded-lg rounded-bl-sm px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-t border-slate-700/40">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask the copilot..."
          className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/60 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatLoading}
          className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  )
}
