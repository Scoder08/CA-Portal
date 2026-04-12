import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageCircle, X, Send, Plus, Bot, User,
  Loader2, ChevronDown, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BASE = import.meta.env.VITE_API_URL || '/api'

const SUGGESTIONS = [
  "What's my tax liability this year?",
  "Explain Section 44ADA for me",
  "Show my unpaid invoices",
  "When is advance tax due?",
  "Do I need GST registration?",
  "How to claim DTAA relief on US income?",
]

// ---------------------------------------------------------------------------
// Markdown renderer — handles ```fenced code```, **bold**, *italic*,
// `inline code`, ---, # headings, - lists, blank lines
// ---------------------------------------------------------------------------

function parseInline(text, key) {
  const parts = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g
  let last = 0, match, i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] !== undefined)
      parts.push(<strong key={`${key}-b${i}`}>{match[1]}</strong>)
    else if (match[2] !== undefined)
      parts.push(<em key={`${key}-i${i}`}>{match[2]}</em>)
    else if (match[3] !== undefined)
      parts.push(
        <code key={`${key}-c${i}`}
          className="bg-ink-200/60 text-ink-700 rounded px-1 py-0.5 text-xs font-mono">
          {match[3]}
        </code>
      )
    last = regex.lastIndex
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function MarkdownContent({ content, isUser, streaming }) {
  const nodes = []
  let listItems = []

  // Split into fenced code blocks and plain text segments
  const segments = []
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0, fm
  while ((fm = fenceRe.exec(content)) !== null) {
    if (fm.index > lastIdx) segments.push({ type: 'text', value: content.slice(lastIdx, fm.index) })
    segments.push({ type: 'code', lang: fm[1] || '', value: fm[2] })
    lastIdx = fenceRe.lastIndex
  }
  if (lastIdx < content.length) segments.push({ type: 'text', value: content.slice(lastIdx) })

  const flushList = () => {
    if (listItems.length) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="mt-1 mb-1 pl-3 space-y-0.5 list-none">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  segments.forEach((seg, si) => {
    if (seg.type === 'code') {
      flushList()
      nodes.push(
        <pre key={`pre-${si}`} className="my-2 rounded-lg bg-ink-900 text-ink-100 text-xs font-mono p-3 overflow-x-auto whitespace-pre-wrap break-words">
          {seg.lang && (
            <span className="block text-[10px] text-ink-400 mb-1 uppercase tracking-wider">{seg.lang}</span>
          )}
          {seg.value.trimEnd()}
        </pre>
      )
      return
    }

    seg.value.split('\n').forEach((line, idx) => {
      const lineKey = `${si}-${idx}`
      if (/^---+$/.test(line.trim())) {
        flushList()
        nodes.push(<hr key={lineKey} className="my-2 border-ink-200" />)
        return
      }
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
      if (headingMatch) {
        flushList()
        const level = headingMatch[1].length
        const cls = level === 1
          ? 'font-bold text-base mt-2 mb-0.5'
          : level === 2
          ? 'font-semibold text-sm mt-1.5 mb-0.5'
          : 'font-semibold text-xs mt-1 mb-0.5 text-ink-600'
        nodes.push(<p key={lineKey} className={cls}>{parseInline(headingMatch[2], lineKey)}</p>)
        return
      }
      const listMatch = line.match(/^[-*•]\s+(.+)/)
      if (listMatch) {
        listItems.push(
          <li key={lineKey} className="flex gap-1.5 items-start">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-gold-500 flex-shrink-0" />
            <span>{parseInline(listMatch[1], lineKey)}</span>
          </li>
        )
        return
      }
      if (line.trim() === '') {
        flushList()
        nodes.push(<div key={lineKey} className="h-1.5" />)
        return
      }
      flushList()
      nodes.push(<p key={lineKey} className="leading-relaxed">{parseInline(line, lineKey)}</p>)
    })
  })
  flushList()

  return (
    <div className={`text-sm break-words space-y-0.5 ${isUser ? 'text-white' : 'text-ink-800'}`}>
      {nodes}
      {streaming && (
        <span className="inline-block w-1.5 h-3.5 bg-gold-400 ml-0.5 align-middle animate-pulse" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-2 items-end ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`
        w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
        ${isUser ? 'bg-ink-800 text-gold-400' : 'bg-gold-400/20 text-gold-600'}
      `}>
        {isUser ? <User size={11} /> : <Bot size={11} />}
      </div>
      <div className={`
        max-w-[82%] px-3 py-2 rounded-2xl
        ${isUser
          ? 'bg-ink-800 text-white rounded-br-sm'
          : 'bg-ink-50 border border-ink-100 text-ink-800 rounded-bl-sm'
        }
      `}>
        <MarkdownContent content={message.content} isUser={isUser} streaming={message.streaming} />
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-6 h-6 rounded-full bg-gold-400/20 flex items-center justify-center flex-shrink-0">
        <Bot size={11} className="text-gold-600" />
      </div>
      <div className="bg-ink-50 border border-ink-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
        <div className="flex gap-1 items-center">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({ onSuggestion }) {
  return (
    <div className="py-4 px-1">
      <div className="text-center mb-4">
        <div className="w-10 h-10 rounded-full bg-gold-400/20 flex items-center justify-center mx-auto mb-2">
          <Sparkles size={18} className="text-gold-500" />
        </div>
        <p className="text-sm font-semibold text-ink-800">CA Assistant</p>
        <p className="text-xs text-ink-400 mt-0.5">Tax, invoices, GST, FEMA — ask anything</p>
      </div>
      <div className="space-y-1.5">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="
              block w-full text-left text-xs px-3 py-2 rounded-xl
              border border-ink-100 text-ink-500
              hover:border-gold-400/60 hover:text-ink-800 hover:bg-gold-400/5
              transition-all duration-150
            "
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ChatWidget
// ---------------------------------------------------------------------------

export default function ChatWidget() {
  const token = localStorage.getItem('ca_token')
  if (!token) return null

  const [isOpen, setIsOpen]           = useState(false)
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId]     = useState(null)
  const [hasUnread, setHasUnread]     = useState(false)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const abortRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setHasUnread(false)
    }
  }, [isOpen])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function startNewChat() {
    abortRef.current?.abort()
    setSessionId(null)
    setMessages([])
    setInput('')
    setIsStreaming(false)
  }

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setIsStreaming(true)

    const userMsgId = Date.now()
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: trimmed }])

    const controller = new AbortController()
    abortRef.current = controller
    let firstToken = true

    try {
      const response = await fetch(`${BASE}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop()

        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          const payload = event.slice(6)

          if (payload === '[DONE]') break

          try {
            const parsed = JSON.parse(payload)
            if (parsed.type === 'meta' && parsed.session_id) {
              setSessionId(parsed.session_id)
              continue
            }
            if (parsed.type === 'error') {
              toast.error(parsed.error || 'Agent error')
              continue
            }
          } catch {
            // raw token
          }

          if (firstToken) {
            firstToken = false
            setMessages(prev => [
              ...prev,
              { id: Date.now(), role: 'assistant', content: payload, streaming: true },
            ])
          } else {
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant' && last.streaming) {
                return [...prev.slice(0, -1), { ...last, content: last.content + payload }]
              }
              return prev
            })
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      toast.error(err.message || 'Connection error. Please try again.')
      if (firstToken) {
        setMessages(prev => prev.filter(m => m.id !== userMsgId))
      }
    } finally {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, streaming: false }]
        }
        return prev
      })
      setIsStreaming(false)
      if (!isOpen) setHasUnread(true)
    }
  }, [isStreaming, sessionId, token, isOpen])

  function handleSend() { sendMessage(input) }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const showWelcome  = messages.length === 0
  const showThinking = isStreaming && (
    messages.length === 0 || messages[messages.length - 1]?.role === 'user'
  )

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close CA Assistant' : 'Open CA Assistant'}
        className="
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full btn-primary
          flex items-center justify-center
          shadow-lg shadow-gold-500/25
          hover:scale-105 active:scale-95
          transition-transform duration-150
        "
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {!isOpen && hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="
          fixed bottom-24 right-6 z-50
          w-[380px] max-h-[600px]
          flex flex-col
          bg-white border border-ink-200
          rounded-2xl shadow-2xl shadow-ink-900/20
          animate-fade-up overflow-hidden
        ">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-ink-800 text-white rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={17} className="text-gold-400" />
              <span className="font-semibold text-sm tracking-tight">CA Assistant</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-400/20 text-gold-300">AI</span>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button onClick={startNewChat} className="flex items-center gap-1 text-ink-300 hover:text-gold-400 transition-colors text-xs">
                  <Plus size={12} /> New
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-ink-300 hover:text-white transition-colors" aria-label="Minimise">
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {showWelcome
              ? <WelcomeScreen onSuggestion={sendMessage} />
              : messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
            }
            {showThinking && <ThinkingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-ink-100 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tax, GST, invoices…"
                rows={1}
                disabled={isStreaming}
                className="
                  flex-1 resize-none px-3 py-2
                  bg-ink-50 border border-ink-200 rounded-xl
                  text-sm text-ink-800 placeholder-ink-300
                  focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400
                  max-h-32 overflow-y-auto disabled:opacity-60 transition-colors
                "
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="btn-primary p-2.5 rounded-xl flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {isStreaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-ink-300 text-center mt-2 select-none">
              AI estimates only · verify with a practising CA
            </p>
          </div>
        </div>
      )}
    </>
  )
}
