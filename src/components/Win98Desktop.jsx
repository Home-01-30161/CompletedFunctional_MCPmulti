import { useState } from 'react'
import BootScreen from './BootScreen'
import Win98Window from './Win98Window'
import ChatWindow from './ChatWindow'
import ConfigWindow from './ConfigWindow'
import Taskbar from './Taskbar'
import styles from './Win98Desktop.module.css'

const DEFAULT_CONFIG = {
  endpoint: '',
  apikey: '',
  agentName: 'OpenClaw',
  sysprompt: '',
}

const ICONS = [
  { id: 'chat',   icon: '🦞', label: 'OpenClaw Agent',      x: 16, y: 16  },
  { id: 'config', icon: '⚙️', label: 'Connection Settings', x: 16, y: 110 },
  { id: 'about',  icon: 'ℹ️', label: 'About',               x: 16, y: 204 },
  { id: 'recycle',icon: '🗑️', label: 'Recycle Bin',         x: 16, y: 298 },
]

export default function Win98Desktop() {
  const [booted, setBooted] = useState(false)
  const [wins, setWins] = useState({ chat: true, config: false, about: false })
  const [zMap, setZMap] = useState({ chat: 10, config: 10, about: 10 })
  const [zTop, setZTop] = useState(10)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [shutdown, setShutdown] = useState(false)

  function bringToFront(id) {
    setZTop(z => {
      setZMap(m => ({ ...m, [id]: z + 1 }))
      return z + 1
    })
  }

  function openWin(id) {
    setWins(w => ({ ...w, [id]: true }))
    bringToFront(id)
  }

  function closeWin(id) { setWins(w => ({ ...w, [id]: false })) }
  function minimizeWin(id) { setWins(w => ({ ...w, [id]: false })) }

  function handleDesktopIcon(id) {
    if (id === 'recycle') { openWin('chat'); return }
    openWin(id)
  }

  function handleStartAction(action) {
    if (action === 'shutdown') {
      setShutdown(true)
      return
    }
    if (action === 'newSession') {
      // Trigger via a custom event so ChatWindow can hear it
      window.dispatchEvent(new CustomEvent('openclaw:clearChat'))
      return
    }
    openWin(action)
  }

  function saveConfig(cfg) { setConfig(cfg) }

  // Taskbar open windows
  const taskbarWindows = [
    { id: 'chat',   icon: '🦞', label: 'OpenClaw Agent', active: wins.chat,   onClick: () => wins.chat   ? bringToFront('chat')   : openWin('chat')   },
    { id: 'config', icon: '⚙️', label: 'Settings',       active: wins.config, onClick: () => wins.config ? bringToFront('config') : openWin('config') },
    { id: 'about',  icon: 'ℹ️', label: 'About',          active: wins.about,  onClick: () => wins.about  ? bringToFront('about')  : openWin('about')  },
  ].filter(w => w.active)

  if (shutdown) {
    return (
      <div className={styles.shutdown}>
        It is now safe to turn off your computer.
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Boot overlay */}
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}

      {/* Desktop */}
      <div className={styles.desktop}>
        {/* CRT scanline overlay */}
        <div className={styles.scanlines} />

        {/* Desktop Icons */}
        {ICONS.map(ico => (
          <div
            key={ico.id}
            className={styles.desktopIcon}
            style={{ left: ico.x, top: ico.y }}
            onDoubleClick={() => handleDesktopIcon(ico.id)}
          >
            <span className={styles.iconImg}>{ico.icon}</span>
            <span className={styles.iconLabel}>{ico.label}</span>
          </div>
        ))}

        {/* ── Chat Window ── */}
        <Win98Window
          id="chat"
          title="OpenClaw Agent — Chat Terminal"
          icon="🦞"
          visible={wins.chat}
          onClose={() => closeWin('chat')}
          onMinimize={() => minimizeWin('chat')}
          onFocus={() => bringToFront('chat')}
          zIndex={zMap.chat}
          defaultX={90}
          defaultY={30}
          defaultW={530}
          defaultH={450}
          menuItems={[
            { label: 'Session', onClick: () => window.dispatchEvent(new CustomEvent('openclaw:clearChat')) },
            { label: 'Connect', onClick: () => openWin('config') },
            { label: 'Help',    onClick: () => openWin('about') },
          ]}
        >
          <ChatWindow config={config} />
        </Win98Window>

        {/* ── Config Window ── */}
        <Win98Window
          id="config"
          title="OpenClaw — Connection Settings"
          icon="⚙️"
          visible={wins.config}
          onClose={() => closeWin('config')}
          onFocus={() => bringToFront('config')}
          zIndex={zMap.config}
          defaultX={180}
          defaultY={90}
          defaultW={400}
          defaultH={270}
        >
          <ConfigWindow
            config={config}
            onSave={saveConfig}
            onClose={() => closeWin('config')}
          />
        </Win98Window>

        {/* ── About Window ── */}
        <Win98Window
          id="about"
          title="About OpenClaw Terminal"
          icon="ℹ️"
          visible={wins.about}
          onClose={() => closeWin('about')}
          onFocus={() => bringToFront('about')}
          zIndex={zMap.about}
          defaultX={300}
          defaultY={160}
          defaultW={340}
          defaultH={230}
        >
          <div className={styles.aboutContent}>
            <div className={styles.aboutIcon}>🦞</div>
            <div className={styles.aboutText}>
              <strong>OpenClaw Agent Terminal</strong><br />
              Version 1.0.0 (Build 1998)<br /><br />
              Running on:<br />
              &bull; Compaq Presario 2000<br />
              &bull; Windows 98 Second Edition<br />
              &bull; 256 MB RAM · 10 GB HDD<br />
              &bull; Intel Pentium III 800MHz<br /><br />
              <span style={{ color: '#000080' }}>NECTEC-SREP09 Project</span><br />
              <span style={{ color: '#808080', fontSize: 10 }}>© 2000 OpenClaw Systems Inc.</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 12px' }}>
            <button className={styles.okBtn} onClick={() => closeWin('about')}>OK</button>
          </div>
        </Win98Window>
      </div>

      {/* Taskbar */}
      <Taskbar openWindows={taskbarWindows} onStartAction={handleStartAction} />
    </div>
  )
}
