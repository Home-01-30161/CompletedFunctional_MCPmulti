import { useState, useRef, useEffect } from 'react'
import styles from './ChatWindow.module.css'

export default function ChatWindow({ config }) {
  const [messages, setMessages] = useState([
    { role: 'system', text: 'Welcome to OpenClaw Agent Terminal v1.0' },
    { role: 'system', text: 'Running on Compaq Presario 2000 · Windows 98 SE' },
    { role: 'system', text: 'Configure your agent in Connection Settings, then type below.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusState, setStatusState] = useState('idle') // idle | thinking | ok | error
  const [statusText, setStatusText] = useState('Idle — Not connected')
  const [history, setHistory] = useState([])
  const boxRef = useRef()

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages, loading])

  function addMsg(role, text) {
    setMessages(m => [...m, { role, text }])
  }

  function clearChat() {
    setMessages([{ role: 'system', text: 'Session cleared. Ready.' }])
    setHistory([])
    setStatusState('idle')
    setStatusText('Idle — Not connected')
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    if (!config.endpoint) {
      addMsg('system', 'ERROR: No endpoint configured. Open Connection Settings.')
      return
    }

    setInput('')
    setLoading(true)
    addMsg('user', text)
    const newHistory = [...history, { role: 'user', content: text }]
    setHistory(newHistory)
    setStatusState('thinking')
    setStatusText('Transmitting to OpenClaw Agent...')

    try {
      const headers = { 'Content-Type': 'application/json' }
      if (config.apikey) headers['Authorization'] = 'Bearer ' + config.apikey

      const body = { message: text, history: newHistory }
      if (config.sysprompt) body.system = config.sysprompt

      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText)

      const data = await res.json()
      const reply =
        data.response || data.message || data.content || data.text || data.reply || JSON.stringify(data)

      setHistory(h => [...h, { role: 'assistant', content: reply }])
      addMsg('agent', reply)
      setStatusState('ok')
      setStatusText('Connected — Agent responded OK')
    } catch (e) {
      addMsg('system', 'ERROR: ' + e.message)
      setStatusState('error')
      setStatusText('Error — ' + e.message.slice(0, 50))
    } finally {
      setLoading(false)
    }
  }

  const ledClass = {
    idle: styles.ledIdle,
    thinking: styles.ledThinking,
    ok: styles.ledOk,
    error: styles.ledError,
  }[statusState]

  return (
    <div className={styles.wrap}>
      {/* Messages */}
      <div className={styles.messages} ref={boxRef}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${styles['msg_' + m.role]}`}>
            <span className={styles.label}>
              {m.role === 'user' ? '[YOU]'
               : m.role === 'agent' ? `[${config.agentName || 'AGENT'}]`
               : '[SYSTEM]'}
            </span>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.msg_agent}`}>
            <span className={styles.label}>[{config.agentName || 'AGENT'}]</span>
            <span className={styles.typing}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </div>
        )}
      </div>

      {/* Input Row */}
      <div className={styles.inputRow}>
        <span className={styles.prompt}>&gt;</span>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type message to OpenClaw Agent..."
          disabled={loading}
          autoFocus
        />
        <button className={styles.sendBtn} onClick={sendMessage} disabled={loading}>
          📨 Send
        </button>
        <button className={styles.clearBtn} onClick={clearChat} title="Clear session">
          🗑
        </button>
      </div>

      {/* Status */}
      <div className={styles.statusbar}>
        <div className={`${styles.led} ${ledClass}`} />
        <span>{statusText}</span>
      </div>
    </div>
  )
}
