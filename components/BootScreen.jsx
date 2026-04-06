import { useState, useEffect } from 'react'
import styles from './BootScreen.module.css'

const BOOT_STEPS = [
  'Initializing hardware...',
  'Loading COMPAQ BIOS v2.21...',
  'Detecting memory... 256MB OK',
  'Detecting HDD... 10.0 GB OK',
  'Loading Windows 98 SE...',
  'Starting OpenClaw services...',
  'Mounting agent runtime...',
  'Ready.',
]

export default function BootScreen({ onComplete }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [pct, setPct] = useState(0)
  const [statusText, setStatusText] = useState(BOOT_STEPS[0])
  const [done, setDone] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let idx = 0
    const tick = () => {
      if (idx >= BOOT_STEPS.length) {
        setPct(100)
        setTimeout(() => {
          setFading(true)
          setTimeout(onComplete, 900)
        }, 500)
        return
      }
      const p = Math.round((idx / BOOT_STEPS.length) * 100)
      setPct(p)
      setStatusText(BOOT_STEPS[idx])
      setStepIdx(idx)
      idx++
      setTimeout(tick, 340 + Math.random() * 220)
    }
    setTimeout(tick, 400)
  }, [])

  return (
    <div className={`${styles.boot} ${fading ? styles.fadeOut : ''}`}>
      {/* CRT phosphor flicker */}
      <div className={styles.crt} />

      <div className={styles.logo}>⚡ COMPAQ</div>
      <div className={styles.subtitle}>
        Presario 2000 Series
        <span className={styles.sub2}>OpenClaw Agent Interface v1.0</span>
      </div>

      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: pct + '%' }} />
        <div className={styles.barLabel}>{pct}%</div>
      </div>

      <div className={styles.status}>{statusText}</div>

      <div className={styles.bios}>
        <span>COMPAQ (R) 2000 System BIOS Release 2.21</span>
        <span>Copyright (C) 2000, COMPAQ Computer Corporation</span>
        <span style={{ marginTop: 8 }}>CPU: Intel Pentium III 800MHz</span>
        <span>Memory Test: {pct < 50 ? Math.floor(pct * 2621) : 262144} KB OK</span>
      </div>
    </div>
  )
}
