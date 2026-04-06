import { useState } from 'react'
import styles from './ConfigWindow.module.css'

export default function ConfigWindow({ config, onSave, onClose }) {
  const [form, setForm] = useState({ ...config })
  const [testStatus, setTestStatus] = useState('')

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function testConnection() {
    if (!form.endpoint) { setTestStatus('❌ Please enter an endpoint URL first.'); return }
    setTestStatus('🔌 Testing...')
    try {
      const res = await fetch(form.endpoint, {
        method: 'GET',
        headers: form.apikey ? { Authorization: 'Bearer ' + form.apikey } : {},
      })
      setTestStatus(`✅ Connected! Status: ${res.status}`)
    } catch (e) {
      setTestStatus('❌ Failed: ' + e.message)
    }
  }

  function save() {
    onSave(form)
    onClose()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.form}>
        <Row label="Agent Endpoint:">
          <input
            className={styles.input}
            type="text"
            placeholder="http://localhost:8000/chat"
            value={form.endpoint}
            onChange={e => set('endpoint', e.target.value)}
          />
        </Row>
        <Row label="API Key:">
          <input
            className={styles.input}
            type="password"
            placeholder="sk-..."
            value={form.apikey}
            onChange={e => set('apikey', e.target.value)}
          />
        </Row>
        <Row label="Agent Name:">
          <input
            className={styles.input}
            type="text"
            placeholder="OpenClaw"
            value={form.agentName}
            onChange={e => set('agentName', e.target.value)}
          />
        </Row>
        <Row label="System Prompt:">
          <input
            className={styles.input}
            type="text"
            placeholder="You are a helpful agent..."
            value={form.sysprompt}
            onChange={e => set('sysprompt', e.target.value)}
          />
        </Row>

        <div className={styles.btnRow}>
          <button className={styles.btn} onClick={testConnection}>🔌 Test</button>
          <button className={styles.btn} onClick={save}>💾 Save</button>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
        </div>
      </div>

      <div className={styles.statusbar}>
        <span>{testStatus || 'Enter your OpenClaw Agent connection details above.'}</span>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ width: 108, flexShrink: 0, fontFamily: 'Tahoma, Arial, sans-serif', fontSize: 11 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
