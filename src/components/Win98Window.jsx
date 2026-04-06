import { useRef, useState, useEffect } from 'react'
import styles from './Win98Window.module.css'

export default function Win98Window({
  id,
  title,
  icon,
  visible,
  onClose,
  onMinimize,
  onFocus,
  zIndex,
  defaultX = 100,
  defaultY = 60,
  defaultW = 400,
  defaultH = 300,
  children,
  menuItems = [],
  statusBar = null,
  resizable = false,
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY })
  const [size, setSize] = useState({ w: defaultW, h: defaultH })
  const [maximized, setMaximized] = useState(false)
  const [savedRect, setSavedRect] = useState(null)
  const dragging = useRef(false)
  const dragStart = useRef({})
  const winRef = useRef()

  function handleTitleMouseDown(e) {
    if (maximized) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
    onFocus?.()
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      setPos({
        x: dragStart.current.ox + e.clientX - dragStart.current.mx,
        y: Math.max(0, dragStart.current.oy + e.clientY - dragStart.current.my),
      })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function toggleMaximize() {
    if (maximized) {
      setPos(savedRect.pos)
      setSize(savedRect.size)
      setMaximized(false)
    } else {
      setSavedRect({ pos, size })
      setPos({ x: 0, y: 0 })
      setSize({ w: window.innerWidth, h: window.innerHeight - 32 })
      setMaximized(true)
    }
  }

  if (!visible) return null

  const style = maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100vh - 32px)', zIndex }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex }

  return (
    <div
      className={styles.window}
      style={style}
      ref={winRef}
      onMouseDown={() => onFocus?.()}
    >
      {/* Title Bar */}
      <div className={styles.titlebar} onMouseDown={handleTitleMouseDown} onDblClick={toggleMaximize}>
        {icon && <span className={styles.titleIcon}>{icon}</span>}
        <span className={styles.titleText}>{title}</span>
        <div className={styles.controls}>
          {onMinimize && (
            <button className={styles.btn} onClick={e => { e.stopPropagation(); onMinimize() }} title="Minimize">
              <span>_</span>
            </button>
          )}
          <button className={styles.btn} onClick={e => { e.stopPropagation(); toggleMaximize() }} title="Maximize">
            <span>□</span>
          </button>
          {onClose && (
            <button className={`${styles.btn} ${styles.closeBtn}`} onClick={e => { e.stopPropagation(); onClose() }} title="Close">
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Menu Bar */}
      {menuItems.length > 0 && (
        <div className={styles.menubar}>
          {menuItems.map((item, i) => (
            <span key={i} className={styles.menuItem} onClick={item.onClick}>
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>
        {children}
      </div>

      {/* Status Bar */}
      {statusBar && (
        <div className={styles.statusbar}>
          {statusBar}
        </div>
      )}
    </div>
  )
}
