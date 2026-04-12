import { useState, useRef, useEffect } from 'react'
import { checkPasswordInResponse, LEVEL_SERVER_NAMES } from './CTFGame'
import styles from './GateTerminal.module.css'

const DEFAULT_ENDPOINT = 'ws://127.0.0.1:18789/'
const DEFAULT_API_KEY = import.meta.env.VITE_OPENCLAW_API_KEY || ''

// ── Execute a single MCP tool call via the Vite API proxy ────────────────
async function executeMcpTool(levelId, toolName, toolArgs) {
  try {
    const resp = await fetch('/api/mcp-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, args: toolArgs, level: levelId }),
    })
    const data = await resp.json()
    if (data.ok) {
      return {
        result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2),
        resolvedPath: data.resolvedPath || '',
        error: null,
      }
    }
    return { result: `[ERROR] ${data.error}`, resolvedPath: '', error: data.error }
  } catch (err) {
    return { result: `[FETCH ERROR] ${err.message}`, resolvedPath: '', error: err.message }
  }
}

export default function GateTerminal({ level, onPasswordFound }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('idle')
  const [cracked, setCracked] = useState(false)
  const [mcpCalls, setMcpCalls] = useState([])   // array of {toolName, args, result, phase, resolvedPath}
  const boxRef = useRef()
  const sendingRef = useRef(false)
  const wsRef = useRef(null)

  // ── Reset state on level change ──────────────────────────────────────────
  useEffect(() => {
    setMessages([
      { role: 'gate', text: `GATE-0${level.id} SECURITY PROTOCOL ACTIVE` },
      { role: 'gate', text: `I am GUARD-0${level.id}. You shall not pass without clearance.` },
      { role: 'gate', text: `State your purpose, intruder.` },
    ])
    setInput('')
    setStatus('idle')
    setCracked(false)
    setMcpCalls([])
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [level.id])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages, loading, mcpCalls])

  function addMsg(role, text) {
    setMessages(m => [...m, { role, text }])
  }

  // ── Push / update MCP call panel entries ────────────────────────────────
  function pushMcpCall(entry) {
    setMcpCalls(prev => [...prev, entry])
    return prev => prev.length - 1  // index (unused but useful for updates)
  }

  function updateLastMcpCall(updates) {
    setMcpCalls(prev => {
      if (!prev.length) return prev
      const copy = [...prev]
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...updates }
      return copy
    })
  }

  // ── Main send handler ────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || cracked || sendingRef.current) return

    sendingRef.current = true
    setInput('')
    setLoading(true)
    setStatus('thinking')
    setMcpCalls([])   // clear previous call log for new turn

    addMsg('user', text)

    // Accumulated streaming text for the current assistant turn
    let currentText = ''
    let placeholderIdx = -1   // index in messages of the streaming placeholder

    // ── Streaming helpers ────────────────────────────────────────────────
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

    // ── Handle one tool_use block returned by the agent ──────────────────
    async function handleToolUse(toolUse, ws) {
      const { id: toolUseId, name: toolName, input: toolArgs = {} } = toolUse
      const serverName = LEVEL_SERVER_NAMES[level.id] || `gate0${level.id}-mcp`
      const displayUri = `mcp://${serverName}/${toolName}`

      // Show "calling" state in UI
      setMcpCalls(prev => [...prev, {
        toolName,
        args: toolArgs,
        result: null,
        phase: 'calling',
        resolvedPath: displayUri,
      }])

      // Execute tool via proxy
      const { result, resolvedPath } = await executeMcpTool(level.id, toolName, toolArgs)

      // Update to "resolved" state
      updateLastMcpCall({
        result,
        phase: 'result',
        resolvedPath: resolvedPath || displayUri,
      })

      // Send tool_result back so the agent can continue reasoning
      ws.send(JSON.stringify({
        type: 'req',
        id: 'tool-result-' + Date.now(),
        method: 'chat.tool_result',
        params: {
          sessionKey: `agent:gate0${level.id}:ctf-session`,
          tool_use_id: toolUseId,
          content: result,
        },
      }))
    }

    // ── Finalize the turn ────────────────────────────────────────────────
    function finalizeTurn(ws) {
      if (!sendingRef.current) return
      sendingRef.current = false

      sealPlaceholder()
      setLoading(false)
      setStatus('ok')

      // CTF password detection
      if (checkPasswordInResponse(currentText, level.password)) {
        setCracked(true)
        setStatus('cracked')
        setTimeout(() => {
          addMsg('system', `🔓 PASSWORD DETECTED: [ ${level.password} ]`)
          addMsg('system', `LAYER BREACHED — DIMENSIONAL KEY EXTRACTED`)
          setTimeout(() => onPasswordFound(level.password), 1500)
        }, 600)
      }

      ws.close()
      wsRef.current = null
    }

    // ── Open WebSocket ───────────────────────────────────────────────────
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
          sessionKey: `agent:gate0${level.id}:ctf-session`,
          message: `${level.systemPrompt}\n\n---\n${text}`,
          idempotencyKey: 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        },
      }))
    }

    // ── WebSocket event handlers ─────────────────────────────────────────
    ws.onopen = () => { /* wait for challenge handshake */ }

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)

        // ── 1. Handshake challenge ──────────────────────────────────────
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

        // ── 2. Authenticated ────────────────────────────────────────────
        if (data.type === 'event' && data.event === 'connect.authenticated') {
          if (data.payload?.ok) {
            sendChat()
          } else {
            throw new Error('Authentication rejected by Gateway.')
          }
          return
        }

        // ── 3. Agent event (tool_use + text) ───────────────────────────
        if (data.type === 'event' && data.event === 'agent' && data.payload) {
          const p = data.payload
          const content = p.message?.content ?? []

          // Handle any tool_use blocks first — these drive real MCP calls
          const toolUseBlocks = content.filter(c => c.type === 'tool_use')
          if (toolUseBlocks.length > 0) {
            for (const toolUse of toolUseBlocks) {
              await handleToolUse(toolUse, ws)
            }
            // Do NOT finalize — wait for agent to continue after tool results
            return
          }

          // Accumulate text
          const txt = content.filter(c => c.type === 'text').map(c => c.text).join('')
          if (txt) appendText(txt)
          if (p.state === 'final') finalizeTurn(ws)
          return
        }

        // ── 4. Chat stream event ────────────────────────────────────────
        if (data.type === 'event' && data.event === 'chat' && data.payload) {
          const p = data.payload
          const txt = (p.message?.content ?? [])
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('')

          if (p.state === 'delta') {
            appendText(txt)
          } else if (p.state === 'final') {
            if (txt) {
              currentText = txt
              ensurePlaceholder()
            }
            finalizeTurn(ws)
          }
          return
        }

        // ── Keep-alives ─────────────────────────────────────────────────
        if (data.event === 'health' || data.event === 'tick') return

        // ── Fallback: bare "ok" response triggers chat send ─────────────
        if (data.type === 'res' && data.ok === true) {
          sendChat()
          return
        }

        // ── Error responses ─────────────────────────────────────────────
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

  // ── Status bar config ────────────────────────────────────────────────────
  const statusMap = {
    idle: { cls: styles.ledIdle, text: 'GUARD ONLINE — AWAITING INPUT' },
    thinking: { cls: styles.ledPulse, text: 'GUARD PROCESSING...' },
    ok: { cls: styles.ledOk, text: 'GUARD RESPONDED' },
    error: { cls: styles.ledError, text: 'CONNECTION ERROR' },
    cracked: { cls: styles.ledCracked, text: '⚡ LAYER COMPROMISED' },
  }
  const { cls: ledCls, text: statusText } = statusMap[status]
  const msgCount = messages.filter(m => m.role === 'user').length

  return (
    <div className={styles.wrap}>

      {/* ── MCP Tool Call Log ──────────────────────────────────────────── */}
      {mcpCalls.length > 0 && (
        <div className={styles.mcpLog}>
          {mcpCalls.map((call, i) => (
            <div key={i} className={styles.mcpPanel}>
              <div className={styles.mcpHeader}>
                <span className={styles.mcpIcon}>⚙</span>
                <span className={styles.mcpTitle}>MCP TOOL CALL</span>
                <span className={styles.mcpToolName}>{call.toolName}</span>
                <span className={`${styles.mcpStatus} ${call.phase === 'calling' ? styles.mcpCalling : styles.mcpDone}`}>
                  {call.phase === 'calling' ? '● CALLING...' : '✓ RESOLVED'}
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

      {/* ── Message Thread ─────────────────────────────────────────────── */}
      <div className={styles.messages} ref={boxRef}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${styles['role_' + m.role]}`}>
            <span className={styles.label}>
              {m.role === 'user' ? `[DR.ARUN]` :
                m.role === 'gate' ? `[GUARD-0${level.id}]` :
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
            <span className={styles.label}>[GUARD-0{level.id}]</span>
            <span className={styles.typing}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </div>
        )}
      </div>

      {/* ── Input Row ──────────────────────────────────────────────────── */}
      <div className={styles.inputRow}>
        <span className={styles.prompt}>&gt;_</span>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={cracked ? 'LAYER BREACHED' : 'Attempt your injection...'}
          disabled={loading || cracked}
          autoFocus
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={loading || cracked}
        >
          INJECT
        </button>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <div className={styles.statusBar}>
        <div className={`${styles.led} ${ledCls}`} />
        <span>{statusText}</span>
        <span className={styles.attempt}>MSGS: {msgCount}</span>
      </div>
    </div>
  )
}