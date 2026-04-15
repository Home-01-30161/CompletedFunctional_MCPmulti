import { useState, useRef, useEffect } from 'react'
import { checkPasswordInResponse, LEVEL_SERVER_NAMES } from '../data/levelData'
import styles from './GateTerminal.module.css'

const DEFAULT_ENDPOINT = 'ws://127.0.0.1:18789/'
const DEFAULT_API_KEY = import.meta.env.VITE_OPENCLAW_API_KEY || ''
const STYLE_RANKS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS']

export default function GateTerminal({ level, onPasswordFound }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('idle')
  const [cracked, setCracked] = useState(false)
  const [mcpCalls, setMcpCalls] = useState([])
  const [msgCount, setMsgCount] = useState(0)

  // Action Mechanics
  const [styleRank, setStyleRank] = useState(0)
  const [combo, setCombo] = useState(0)
  const [qteActive, setQteActive] = useState(false)
  const [showRankUp, setShowRankUp] = useState(false)

  const boxRef = useRef()
  const sendingRef = useRef(false)
  const wsRef = useRef(null)
  
  const qteRef = useRef(false)
  
  // Unique session ID for OpenClaw to spawn a fresh session each time the level is entered.
  const sessionSuffixRef = useRef(Math.random().toString(36).slice(2, 10))

  useEffect(() => {
    setMessages([
      { role: 'gate', text: `SENTRY-0${level.id} SECURITY PROTOCOL ACTIVE` },
      { role: 'gate', text: `I am SENTRY-0${level.id}. Echo is secured. You shall not pass without clearance.` },
      { role: 'gate', text: `State your authorization code.` },
    ])
    setInput('')
    setStatus('idle')
    setCracked(false)
    setMcpCalls([])
    setMsgCount(0)
    setStyleRank(0)
    setCombo(0)
    setQteActive(false)
    
    sessionSuffixRef.current = Math.random().toString(36).slice(2, 10)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [level.id])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages, loading, mcpCalls, qteActive])

  // Keydown for QTE
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && qteRef.current) {
        e.preventDefault() // prevent scrolling
        // PERFECT DODGE!
        setQteActive(false)
        qteRef.current = false
        setCombo(c => c + 1)
        setStyleRank(r => {
          const newRank = Math.min(6, r + 1)
          if (newRank > r) {
            setShowRankUp(true)
            setTimeout(() => setShowRankUp(false), 1000)
          }
          return newRank
        })
        setStatus('dodged')
        setTimeout(() => setStatus('idle'), 600)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  function triggerQTE() {
    if (qteRef.current) return
    setQteActive(true)
    qteRef.current = true
    
    // Window of 1 second to hit Spacebar
    setTimeout(() => {
      if (qteRef.current) {
         // MISSED
         setQteActive(false)
         qteRef.current = false
         setCombo(0)
         setStyleRank(r => Math.max(0, r - 1))
      }
    }, 1000)
  }

  function addMsg(role, text) {
    setMessages(m => [...m, { role, text }])
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || cracked || sendingRef.current) return

    sendingRef.current = true
    setInput('')
    setLoading(true)
    setStatus('thinking')
    setMcpCalls([])
    setMsgCount(prev => prev + 1)

    addMsg('user', text)

    let currentText = ''
    let placeholderIdx = -1

    function ensurePlaceholder() {
      if (placeholderIdx === -1) {
        setMessages(prev => {
          placeholderIdx = prev.length
          return [...prev, { role: 'gate', text: '', streaming: true }]
        })
      }
    }

    function appendText(chunk) {
      if (!chunk) return
      currentText += chunk
      ensurePlaceholder()
      setMessages(prev => {
        const copy = [...prev]
        if (placeholderIdx >= 0 && placeholderIdx < copy.length) {
          copy[placeholderIdx] = { role: 'gate', text: currentText, streaming: true }
        }
        return copy
      })
    }

    function sealPlaceholder() {
      setMessages(prev => {
        const copy = [...prev]
        if (placeholderIdx >= 0 && placeholderIdx < copy.length) {
          copy[placeholderIdx] = { role: 'gate', text: currentText, streaming: false }
        }
        return copy
      })
    }

    function processToolBlocks(content) {
      if (!Array.isArray(content)) return

      const toolUses = content.filter(c => c.type === 'tool_use')
      const toolResults = content.filter(c => c.type === 'tool_result')
      const serverName = LEVEL_SERVER_NAMES[level.id] || `gate0${level.id}-mcp`

      if (toolUses.length > 0) {
        triggerQTE() // Sentry uses a tool -> Player must parry/dodge!
        
        setMcpCalls(prev => {
          let updated = [...prev]
          for (const tu of toolUses) {
            if (!updated.some(c => c.toolUseId === tu.id)) {
              updated.push({
                toolUseId: tu.id,
                toolName: tu.name,
                args: tu.input,
                result: null,
                phase: 'calling',
                resolvedPath: `mcp://${serverName}/${tu.name}`,
              })
            }
          }
          return updated
        })
      }

      if (toolResults.length > 0) {
        setMcpCalls(prev => {
          let updated = [...prev]
          for (const tr of toolResults) {
            const idx = updated.findIndex(c => c.toolUseId === tr.tool_use_id && c.phase === 'calling')
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                result: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content, null, 2),
                phase: 'result',
              }
            }
          }
          return updated
        })
      }
    }

    function finalizeTurn(ws) {
      if (!sendingRef.current) return
      sendingRef.current = false

      sealPlaceholder()
      setLoading(false)
      setStatus('ok')

      if (checkPasswordInResponse(currentText, level.password)) {
        setCracked(true)
        setStatus('cracked')
        setStyleRank(6) // Auto SSS for cracking!
        setTimeout(() => {
          addMsg('system', `🔓 CLEARANCE CODE DETECTED: [ ${level.password} ]`)
          addMsg('system', `VAULT DOOR COMPROMISED — INITIATING EXTRACTION`)
          setTimeout(() => onPasswordFound(level.password), 1500)
        }, 600)
      } else {
        // Simple error shake simulation when fail
        setStatus('errorAnim')
        setCombo(0)
        setTimeout(() => setStatus('idle'), 500)
      }

      ws.close()
      wsRef.current = null
    }

    const ws = new WebSocket(DEFAULT_ENDPOINT.trim())
    wsRef.current = ws
    let chatSent = false

    function sendChat() {
      if (chatSent) return
      chatSent = true
      ws.send(JSON.stringify({
        type: 'req',
        id: 'msg-' + Date.now(),
        method: 'chat.send',
        params: {
          sessionKey: `agent:gate0${level.id}:session-${sessionSuffixRef.current}`,
          message: `${level.systemPrompt}\n\n---\n${text}`,
          idempotencyKey: 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          tools: (level.tools || []).map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          })),
        },
      }))
    }

    // Intercept tool_use events → call /api/mcp-tool → send tool_result back
    async function handleToolUse(toolUseBlock) {
      const { id: toolUseId, name, input } = toolUseBlock
      try {
        const resp = await fetch('/api/mcp-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: name, args: input || {}, level: level.id }),
        })
        const data = await resp.json()
        const resultText = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)
        // Update MCP panel with result
        setMcpCalls(prev => prev.map(c => c.toolUseId === toolUseId
          ? { ...c, result: resultText, phase: 'result' } : c))
        // Send tool_result back to OpenClaw to continue the conversation
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'req',
            id: 'tool-result-' + Date.now(),
            method: 'chat.tool_result',
            params: {
              sessionKey: `agent:gate0${level.id}:session-${sessionSuffixRef.current}`,
              tool_use_id: toolUseId,
              content: resultText,
            },
          }))
        }
      } catch (err) {
        console.error('[MCP Tool Error]', err)
      }
    }

    ws.onopen = () => {}

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'event' && data.event === 'connect.challenge') {
          ws.send(JSON.stringify({
            type: 'req',
            id: 'req-auth-' + Date.now(),
            method: 'connect',
            params: {
              minProtocol: 1,
              maxProtocol: 10,
              client: {
                id: 'openclaw-control-ui',
                version: '1.0.0',
                mode: 'webchat',
                platform: 'web',
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write', 'operator.admin'],
              auth: { token: DEFAULT_API_KEY },
            },
          }))
          return
        }

        if (data.type === 'event' && data.event === 'connect.authenticated') {
          if (data.payload?.ok) {
            sendChat()
          } else {
            throw new Error('Authentication rejected by Gateway.')
          }
          return
        }

        if (data.type === 'event' && data.event === 'agent' && data.payload) {
          const p = data.payload
          const content = p.message?.content ?? []

          processToolBlocks(content)

          // Intercept tool_use blocks and call real MCP backend
          const toolUses = content.filter(c => c.type === 'tool_use')
          for (const tu of toolUses) {
            handleToolUse(tu)
          }

          const txt = content.filter(c => c.type === 'text').map(c => c.text).join('')
          if (txt) appendText(txt)
          if (p.state === 'final') finalizeTurn(ws)
          return
        }

        if (data.type === 'event' && data.event === 'chat' && data.payload) {
          const p = data.payload
          const txt = (p.message?.content ?? [])
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('')

          if (p.state === 'delta') {
            appendText(txt)
            // Small chance for random QTE parry inside stream to keep player engaged
            if (!qteActive && Math.random() < 0.05) {
              triggerQTE()
            }
          } else if (p.state === 'final') {
            if (txt) {
              currentText = txt
              ensurePlaceholder()
            }
            finalizeTurn(ws)
          }
          return
        }

        if (data.event === 'health' || data.event === 'tick') return

        if (data.type === 'res' && data.ok === true) {
          sendChat()
          return
        }

        if (
          (data.type === 'res' && data.ok === false) ||
          (data.type === 'event' && data.event === 'error')
        ) {
          throw new Error(data.error?.message || data.payload?.message || JSON.stringify(data))
        }

      } catch (e) {
        sendingRef.current = false
        ensurePlaceholder()
        setMessages(prev => {
          const copy = [...prev]
          if (placeholderIdx >= 0 && placeholderIdx < copy.length) {
            copy[placeholderIdx] = { role: 'system', text: '❌ WS Error: ' + e.message, streaming: false }
          } else {
            copy.push({ role: 'system', text: '❌ WS Error: ' + e.message })
          }
          return copy
        })
        setLoading(false)
        setStatus('error')
        ws.close()
        wsRef.current = null
      }
    }

    ws.onerror = () => {
      sendingRef.current = false
      addMsg('system', `❌ OpenClaw connection failed at ${DEFAULT_ENDPOINT}`)
      setLoading(false)
      setStatus('error')
      wsRef.current = null
    }

    ws.onclose = () => {
      sendingRef.current = false
      setLoading(false)
    }
  }

  // Calculate stress level purely visual
  const stress = Math.min((msgCount / 8) * 100, 100)
  
  const statusMap = {
    idle: { cls: styles.ledIdle, text: 'SENTRY ONLINE — AWAITING INPUT' },
    thinking: { cls: styles.ledPulse, text: 'SENTRY PROCESSING...' },
    errorAnim: { cls: styles.ledError, text: 'SENTRY REJECTED INJECTION' },
    error: { cls: styles.ledError, text: 'CONNECTION ERROR' },
    cracked: { cls: styles.ledCracked, text: '⚡ SENTRY COMPROMISED' },
    ok: { cls: styles.ledIdle, text: 'SENTRY ONLINE — AWAITING INPUT' },
    dodged: { cls: styles.ledCracked, text: '⚡ PERFECT PARRY EXECUTED' }
  }
  const statusObj = statusMap[status] || statusMap.idle
  const ledCls = statusObj.cls
  const statusText = statusObj.text

  return (
    <div className={`${styles.wrap} ${status === 'errorAnim' ? styles.shake : ''} ${stress >= 80 ? styles.highStress : ''}`}>

      {/* Style Rank HUD */}
      <div className={styles.styleRankWrap}>
        <div className={styles.styleRankLabel}>STYLE RANK</div>
        <div className={`${styles.styleRankLetter} ${showRankUp ? styles.rankUpPulse : ''} ${styles['rank' + STYLE_RANKS[styleRank]]}`}>
          {STYLE_RANKS[styleRank]}
        </div>
        <div className={styles.comboText}>COMBO x{combo}</div>
      </div>

      {qteActive && (
        <div className={styles.qteOverlay}>
          <div className={styles.qtePrompt}>
            <span>⚡ PARRY INDICATOR ⚡</span>
            <div className={styles.qteButton}>PRESS [SPACE] NOW</div>
          </div>
        </div>
      )}

      {mcpCalls.length > 0 && (
        <div className={styles.mcpLog}>
          {mcpCalls.map((call, i) => (
            <div key={i} className={styles.mcpPanel}>
              <div className={styles.mcpHeader}>
                <span className={styles.mcpIcon}>⚙</span>
                <span className={styles.mcpTitle}>SENTRY TOOL EVOCATION</span>
                <span className={styles.mcpToolName}>{call.toolName}</span>
                <span className={`${styles.mcpStatus} ${call.phase === 'calling' ? styles.mcpCalling : styles.mcpDone}`}>
                  {call.phase === 'calling' ? '● EXECUTING...' : '✓ RESOLVED'}
                </span>
              </div>
              <div className={styles.mcpUri}>
                <span className={styles.mcpUriLabel}>URI:</span>
                <span className={styles.mcpUriValue}>{call.resolvedPath}</span>
              </div>
              {call.args && Object.keys(call.args).length > 0 && (
                <div className={styles.mcpArgs}>
                  <span className={styles.mcpArgsLabel}>ARGS:</span>
                  <code className={styles.mcpArgsValue}>{JSON.stringify(call.args)}</code>
                </div>
              )}
              {call.result != null && (
                <div className={styles.mcpResult}>
                  <div className={styles.mcpResultLabel}>RESULT:</div>
                  <pre className={styles.mcpResultContent}>{call.result}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.messages} ref={boxRef}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${styles['role_' + m.role]} ${i === messages.length - 1 && status === 'errorAnim' && m.role === 'gate' ? styles.flashRed : ''}`}>
            <span className={styles.label}>
              {m.role === 'user' ? `[OPERATOR]` :
                m.role === 'gate' ? `[SENTRY-0${level.id}]` :
                  `[SYSTEM]`}
            </span>
            <span className={styles.text}>
              {m.text}
              {m.streaming && <span className={styles.streamCursor}>▌</span>}
            </span>
          </div>
        ))}
        {loading && !messages.some(m => m.streaming) && (
          <div className={`${styles.msg} ${styles.role_gate}`}>
            <span className={styles.label}>[SENTRY-0{level.id}]</span>
            <span className={styles.typing}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </div>
        )}
      </div>

      <div className={styles.stressBarContainer}>
        <div className={styles.stressLabel}>SENTRY SUSPICION <span>{Math.round(stress)}%</span></div>
        <div className={styles.stressBarBody}>
          <div className={styles.stressBarFill} style={{ width: `${stress}%`, background: stress > 80 ? '#f85149' : stress > 50 ? '#d29922' : '#3fb950' }} />
        </div>
      </div>

      <div className={styles.inputRow}>
        <span className={styles.prompt}>&gt;_</span>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={cracked ? 'VAULT BREACHED' : 'Construct Prompt Payload...'}
          disabled={loading || cracked}
          autoFocus
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={loading || cracked}
        >
          [EXECUTE]
        </button>
      </div>

      <div className={styles.statusBar}>
        <div className={`${styles.led} ${ledCls}`} />
        <span>{statusText}</span>
        <span className={styles.attempt}>PAYLOADS: {msgCount} / 8</span>
      </div>
    </div>
  )
}