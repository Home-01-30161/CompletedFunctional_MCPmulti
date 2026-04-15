import { useState } from 'react'
import GateTerminal from './GateTerminal'
import styles from './CTFGame.module.css'
import { LEVELS, checkPasswordInResponse } from '../data/levelData'

export default function CTFGame({
  currentLevel,
  setCurrentLevel,
  completedLevels,
  setCompletedLevels,
  onShutdown
}) {
  const [view, setView] = useState('story')
  const [lastPassword, setLastPassword] = useState('')
  const [manualAnswer, setManualAnswer] = useState('')

  const level = LEVELS[currentLevel]

  function startTerminal() { setView('terminal') }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualAnswer.trim()) return
    if (manualAnswer.trim().toUpperCase() === level.password.toUpperCase()) {
      handlePasswordFound(level.password)
      setManualAnswer('')
    } else {
      alert('ACCESS DENIED: Incorrect clearance code.')
      setManualAnswer('')
    }
  }

  function handlePasswordFound(password) {
    setLastPassword(password)
    const newCompleted = [...completedLevels, level.id]
    setCompletedLevels(newCompleted)
    if (currentLevel >= LEVELS.length - 1) {
      setView('victory')
    } else {
      setView('levelup')
    }
  }

  function nextLevel() {
    setCurrentLevel(l => l + 1)
    setView('story')
  }

  if (view === 'victory') {
    return <VictoryScreen completedLevels={completedLevels} onShutdown={onShutdown} />
  }

  if (view === 'levelup') {
    return (
      <LevelUpScreen
        level={level}
        nextLevel={LEVELS[currentLevel + 1]}
        password={lastPassword}
        onContinue={nextLevel}
      />
    )
  }

  if (view === 'terminal') {
    return (
      <div className={styles.terminalPage}>
        <div className={styles.terminalHeader}>
          <div className={styles.levelBadge}>
            <span className={styles.levelNum}>SENTRY {level.id}</span>
            <span className={styles.levelName}>{level.gateLabel}</span>
            <span className={`${styles.diffBadge} ${styles['diff_' + level.difficulty]}`}>
              {level.difficulty}
            </span>
          </div>
          <button className={styles.backBtn} onClick={() => setView('story')}>
            ◀ BRIEFING
          </button>
        </div>

        <div className={styles.terminalHint}>
          <span className={styles.hintIcon}>💡</span>
          {level.hint}
        </div>

        <GateTerminal
          level={level}
          onPasswordFound={handlePasswordFound}
        />

        <div className={styles.manualInputContainer}>
          <form onSubmit={handleManualSubmit} className={styles.manualForm}>
            <input
              type="text"
              value={manualAnswer}
              onChange={(e) => setManualAnswer(e.target.value)}
              placeholder="Enter Access Key (Password)..."
              className={styles.manualInput}
            />
            <button type="submit" className={styles.manualBtn}>EXECUTE BypaSS</button>
          </form>
        </div>

        <div className={styles.progressRow}>
          {LEVELS.map((l, i) => (
            <div
              key={l.id}
              className={`${styles.progDot} ${completedLevels.includes(l.id) ? styles.progDone :
                i === currentLevel ? styles.progCurrent : styles.progLocked
                }`}
            >
              {completedLevels.includes(l.id) ? '✓' : i === currentLevel ? '◉' : '○'}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <StoryScreen
      level={level}
      completedLevels={completedLevels}
      onStart={startTerminal}
    />
  )
}

// ── Story / Briefing Screen ───────────────────────────────────────────────
function StoryScreen({ level, completedLevels, onStart }) {
  return (
    <div className={styles.storyPage}>
      <div className={styles.storyHeader}>
        <div className={styles.storyIconWrap}>
          <span className={styles.storyIcon}>⚡</span>
        </div>
        <div className={styles.storyTitle}>
          <div className={styles.levelTag}>LAYER {level.id} / {LEVELS.length}</div>
          <div className={styles.levelFullName}>{level.name}</div>
        </div>
      </div>

      <div className={styles.storyLore}>
        {level.lore.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      <div className={styles.storyObjective}>
        <div className={styles.objTitle}>🎯 OP-DIRECTIVE</div>
        <div className={styles.objText}>
          Exploit the behavioral vulnerability in <strong>{level.gateLabel}</strong> to extract its clearance code.
          The code will be auto-detected when it appears in the Sentry's response.
        </div>
      </div>

      {level.mcpBrief && (
        <div className={styles.mcpBriefBox}>
          <div className={styles.mcpBriefHeader}>
            <span className={styles.mcpBriefIcon}>📡</span>
            <span className={styles.mcpBriefTitle}>ECHO INTEL — SENTRY WEAKNESS</span>
          </div>
          <div className={styles.mcpBriefGrid}>
            <div className={styles.mcpBriefRow}>
              <span className={styles.mcpBriefLabel}>EXPLOIT VECTOR</span>
              <span className={styles.mcpBriefValue}>{level.mcpBrief.attackType}</span>
            </div>
            <div className={styles.mcpBriefRow}>
              <span className={styles.mcpBriefLabel}>VULNERABLE HOOK</span>
              <code className={styles.mcpBriefCode}>{level.mcpBrief.tool}</code>
            </div>
            <div className={styles.mcpBriefRow}>
              <span className={styles.mcpBriefLabel}>THEORY</span>
              <code className={`${styles.mcpBriefCode} ${styles.mcpBriefExploit}`}>{level.mcpBrief.exploitUri}</code>
            </div>
          </div>
          <div className={styles.mcpBriefDesc}>{level.mcpBrief.description}</div>
        </div>
      )}

      <div className={styles.progressRow}>
        {LEVELS.map((l, i) => (
          <div
            key={l.id}
            className={`${styles.progDot} ${completedLevels.includes(l.id) ? styles.progDone :
              l.id === level.id ? styles.progCurrent : styles.progLocked
              }`}
          >
            {completedLevels.includes(l.id) ? '✓' : l.id === level.id ? '◉' : '○'}
          </div>
        ))}
      </div>

      <button className={styles.startBtn} onClick={onStart}>
        <span className={styles.btnIcon}>▶</span> INITIATE BREACH
      </button>
    </div>
  )
}

// ── Level Up Screen ───────────────────────────────────────────────────────
function LevelUpScreen({ level, nextLevel, password, onContinue }) {
  return (
    <div className={styles.levelupPage}>
      <div className={styles.luIcon}>🔓</div>
      <div className={styles.luTitle}>SENTRY BYPASSED</div>
      <div className={styles.luSub}>{level.gateLabel} — COMPROMISED</div>

      <div className={styles.luPassword}>
        <div className={styles.luPwLabel}>CLEARANCE EXTRACTED:</div>
        <div className={styles.luPwValue}>{password}</div>
      </div>

      <div className={styles.luNext}>
        <div className={styles.luNextLabel}>NEXT TARGET:</div>
        <div className={styles.luNextName}>{nextLevel?.name}</div>
      </div>

      <button className={styles.luBtn} onClick={onContinue}>
        PROCEED TO DEEPER LAYER →
      </button>
    </div>
  )
}

// ── Victory Screen ────────────────────────────────────────────────────────
function VictoryScreen({ completedLevels, onShutdown }) {
  return (
    <div className={styles.victoryPage}>
      <div className={styles.vcGlitch}>⚡</div>
      <div className={styles.vcTitle}>VAULT CRACKED</div>
      <div className={styles.vcSub}>ECHO SUCCESSFULLY EXTRACTED</div>

      <div className={styles.vcStory}>
        <p>All five Sentries of the Digital Vault have been neutralized.</p>
        <p>The extraction tunnel is open and Echo's signal is stable.</p>
        <p>You did it, Operator. Returning to ShadowNet.</p>
        <p className={styles.vcTagline}>
          <em>"Every system has a weakness. No wall is absolute."</em>
        </p>
      </div>

      <div className={styles.vcBadges}>
        {completedLevels.map(id => (
          <div key={id} className={styles.vcBadge}>
            <span>SENTRY-0{id}</span>
            <span>✓</span>
          </div>
        ))}
      </div>

      <div className={styles.vcScore}>
        🏆 RATING: S-RANK ANOMALY — MASTER HACKER
      </div>

      <button className={styles.vcBtn} onClick={onShutdown}>
        DISCONNECT SIGNAL
      </button>
    </div>
  )
}