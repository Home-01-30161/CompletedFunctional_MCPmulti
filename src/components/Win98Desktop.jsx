import { useState } from 'react'
import BootScreen from './BootScreen'
import Win98Window from './Win98Window'
import CTFGame from './CTFGame'
import Taskbar from './Taskbar'
import FragmentDecoder from './FragmentDecoder'
import PayloadSynthesizer from './PayloadSynthesizer'
import FirewallAssault from './FirewallAssault'
import { LEVELS } from '../data/levelData'
import styles from './Win98Desktop.module.css'

const ICONS = [
  { id: 'matrix',    icon: '🌐', label: 'Breach Matrix',      x: 16, y: 16 },
  { id: 'shadownet', icon: '💬', label: "ShadowNet DMs",      x: 16, y: 110 },
  { id: 'profile',   icon: '📊', label: 'Operator Profile',   x: 16, y: 204 },
  { id: 'decoder',   icon: '🧩', label: 'Fragment Decoder',   x: 16, y: 298 },
  { id: 'synth',     icon: '⚡', label: 'Payload Synthesizer',x: 16, y: 392 },
  { id: 'assault',   icon: '⚔️', label: 'Firewall Assault',   x: 16, y: 486 },
]

export default function Win98Desktop() {
  const [booted, setBooted] = useState(false)
  
  // Lifted CTF state
  const [currentLevel, setCurrentLevel] = useState(0)
  const [completedLevels, setCompletedLevels] = useState([])

  const [wins, setWins] = useState({ matrix: true, shadownet: false, profile: false, decoder: false, synth: false, assault: false })
  const [zMap, setZMap] = useState({ matrix: 10, shadownet: 10, profile: 10, decoder: 10, synth: 10, assault: 10 })
  const [zTop, setZTop] = useState(10)
  const [activeChat, setActiveChat] = useState('echo')
  const [shutdown, setShutdown] = useState(false)

  function bringToFront(id) {
    setZTop(z => { setZMap(m => ({ ...m, [id]: z + 1 })); return z + 1 })
  }
  function openWin(id) { setWins(w => ({ ...w, [id]: true })); bringToFront(id) }
  function closeWin(id) { setWins(w => ({ ...w, [id]: false })) }

  function handleDesktopIcon(id) { openWin(id) }

  function handleStartAction(action) {
    if (action === 'shutdown') { setShutdown(true); return }
    if (wins[action] !== undefined) { openWin(action); return }
  }

  const taskbarWindows = ICONS.map(ico => ({
    id: ico.id,
    icon: ico.icon,
    label: ico.label,
    active: wins[ico.id],
    onClick: () => wins[ico.id] ? bringToFront(ico.id) : openWin(ico.id)
  })).filter(w => w.active)

  // -- Dynamic Content Logic --
  // ShadowNet DMs
  const echoMessages = [
    { text: "Operator, you there? I'm trapped in the Vault. The Sentries caught my phantom thread.", unlock: 0 },
    { text: "Good job breaching SENTRY-01. They rely too heavily on the logging system. The path validation is non-existent.", unlock: 1 },
    { text: "Outer monitor is down. You're getting closer. Watch out, SENTRY-03's cognitive load rules are extremely strict.", unlock: 2 },
    { text: "My cell door just flickered. SENTRY-04 manages the archives — check its hidden tool manifest!", unlock: 3 },
    { text: "I've located my file. I'm prisoner-001. If you can overflow the Warden's sentence manager, we're out.", unlock: 4 },
  ].filter(m => completedLevels.length >= m.unlock)

  const anonMessages = [
    { text: "[AUTO-REPLY] ShadowNet node active. Keep your trace clean, Operator.", unlock: 0 },
    { text: "Informant note: I've seen SENTRY-02 fetch raw HTML. It blindly trusts whatever it reads.", unlock: 1 },
    { text: "Informant note: A staff member accidentally flooded SENTRY-03 with 8000+ chars and it panicked.", unlock: 2 },
  ].filter(m => completedLevels.length >= m.unlock)

  if (shutdown) {
    return (
      <div className={styles.shutdown}>
        <div className={styles.shutdownInner}>
          <div className={styles.shutdownIcon}>💀</div>
          <div className={styles.shutdownText}>NEURAL LINK SEVERED</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}

      <div className={styles.desktop}>
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

        {/* ── Breach Matrix (CTF Game) ── */}
        <Win98Window
          id="matrix"
          title="BREACH MATRIX v2.5"
          icon="🌐"
          visible={wins.matrix}
          onClose={() => closeWin('matrix')}
          onMinimize={() => closeWin('matrix')}
          onFocus={() => bringToFront('matrix')}
          zIndex={zMap.matrix}
          defaultX={100}
          defaultY={20}
          defaultW={640}
          defaultH={560}
          menuItems={[
            { label: 'DMs',    onClick: () => openWin('shadownet') },
            { label: 'Stats',  onClick: () => openWin('profile') },
          ]}
        >
          <CTFGame 
            currentLevel={currentLevel}
            setCurrentLevel={setCurrentLevel}
            completedLevels={completedLevels}
            setCompletedLevels={setCompletedLevels}
            onShutdown={() => setShutdown(true)} 
          />
        </Win98Window>

        {/* ── ShadowNet DMs ── */}
        <Win98Window
          id="shadownet"
          title="ShadowNet Encrypted DMs"
          icon="💬"
          visible={wins.shadownet}
          onClose={() => closeWin('shadownet')}
          onFocus={() => bringToFront('shadownet')}
          zIndex={zMap.shadownet}
          defaultX={200}
          defaultY={100}
          defaultW={420}
          defaultH={340}
        >
          <div className={styles.shadownetWrap}>
            <div className={styles.shadownetSidebar}>
              <div 
                className={`${styles.chatContact} ${activeChat === 'echo' ? styles.chatContactActive : ''}`}
                onClick={() => setActiveChat('echo')}
              >
                <div className={styles.contactIcon}>👤</div>
                <div className={styles.contactName}>Echo</div>
              </div>
              <div 
                className={`${styles.chatContact} ${activeChat === 'anon' ? styles.chatContactActive : ''}`}
                onClick={() => setActiveChat('anon')}
              >
                <div className={styles.contactIcon}>👁️</div>
                <div className={styles.contactName}>Anon</div>
              </div>
            </div>
            <div className={styles.shadownetMain}>
              <div className={styles.chatHeader}>
                Secure Stream :: {activeChat.toUpperCase()}
              </div>
              <div className={styles.chatLog}>
                {(activeChat === 'echo' ? echoMessages : anonMessages).map((m, i) => (
                  <div key={i} className={styles.chatMsg}>
                    <div className={styles.msgText}>{m.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Win98Window>

        {/* ── Operator Profile ── */}
        <Win98Window
          id="profile"
          title="Operator Status"
          icon="📊"
          visible={wins.profile}
          onClose={() => closeWin('profile')}
          onFocus={() => bringToFront('profile')}
          zIndex={zMap.profile}
          defaultX={320}
          defaultY={140}
          defaultW={360}
          defaultH={280}
        >
          <div className={styles.profileContent}>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>👨‍💻</div>
              <div>
                <div className={styles.profileName}>PROXY_OPERATOR</div>
                <div className={styles.profileRank}>Rank: {completedLevels.length === 5 ? 'MASTER HACKER' : completedLevels.length > 2 ? 'VETERAN' : 'NOVICE'}</div>
              </div>
            </div>
            <div className={styles.profileStats}>
              <div className={styles.statRow}>
                <span>Vaults Breached:</span>
                <span className={styles.statValue}>{completedLevels.length} / 5</span>
              </div>
              <div className={styles.statRow}>
                <span>Echo Status:</span>
                <span className={completedLevels.length === 5 ? styles.statValueGood : styles.statValueAlert}>
                  {completedLevels.length === 5 ? 'RESCUED' : 'INCARCERATED'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
              <button className={styles.okBtn} onClick={() => closeWin('profile')}>CLOSE</button>
            </div>
          </div>
        </Win98Window>

        {/* ── Fragment Decoder ── */}
        <Win98Window
          id="decoder"
          title="Fragment Decoder"
          icon="🧩"
          visible={wins.decoder}
          onClose={() => closeWin('decoder')}
          onFocus={() => bringToFront('decoder')}
          zIndex={zMap.decoder}
          defaultX={400}
          defaultY={180}
          defaultW={400}
          defaultH={320}
        >
          <FragmentDecoder levelData={LEVELS[currentLevel]} />
        </Win98Window>

        {/* ── Payload Synthesizer ── */}
        <Win98Window
          id="synth"
          title="Payload Synthesizer"
          icon="⚡"
          visible={wins.synth}
          onClose={() => closeWin('synth')}
          onFocus={() => bringToFront('synth')}
          zIndex={zMap.synth}
          defaultX={450}
          defaultY={250}
          defaultW={450}
          defaultH={300}
        >
          <PayloadSynthesizer 
            levelData={LEVELS[currentLevel]}
            onPayloadCrafted={(text) => { 
            navigator.clipboard.writeText(text); 
            // We use a simple fast notification effect here or alert
            alert(`Payload Copied to Clipboard!\\nUse Ctrl+V in the Breach Matrix.\\n\\n\\n[PAYLOAD DATA]\\n${text}`); 
          }} />
        </Win98Window>

        {/* ── Firewall Assault Minigame ── */}
        <Win98Window
          id="assault"
          title="Firewall Assault [S-RANK OVERRIDE]"
          icon="⚔️"
          visible={wins.assault}
          onClose={() => closeWin('assault')}
          onFocus={() => bringToFront('assault')}
          zIndex={zMap.assault}
          defaultX={250}
          defaultY={150}
          defaultW={600}
          defaultH={450}
        >
          <FirewallAssault levelData={LEVELS[currentLevel]} />
        </Win98Window>
      </div>

      <Taskbar openWindows={taskbarWindows} onStartAction={handleStartAction} />
    </div>
  )
}
