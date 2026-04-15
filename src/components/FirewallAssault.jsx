import { useState, useEffect, useRef } from 'react';
import styles from './Win98Desktop.module.css';

const GAME_DURATION = 30; // Seconds

export default function FirewallAssault({ levelData }) {
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, WON, LOST
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [rank, setRank] = useState('D');
  const [nodes, setNodes] = useState([]);
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);

  const containerRef = useRef(null);
  const nextId = useRef(0);

  // Define target score for S-Rank victory
  const TARGET_SCORE = 1500; 

  const RANKS = [
    { threshold: 0, label: 'D' },
    { threshold: 100, label: 'C' },
    { threshold: 300, label: 'B' },
    { threshold: 600, label: 'A' },
    { threshold: 1000, label: 'S' },
    { threshold: 1300, label: 'SS' },
    { threshold: 1600, label: 'SSS' },
  ];

  function getRank(currentScore) {
    let r = 'D';
    for (let i = 0; i < RANKS.length; i++) {
      if (currentScore >= RANKS[i].threshold) r = RANKS[i].label;
    }
    return r;
  }

  function startGame() {
    setGameState('PLAYING');
    setScore(0);
    setCombo(0);
    setRank('D');
    setTimeLeft(GAME_DURATION);
    setNodes([]);
  }

  // Spawning logic
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    
    // Timer
    const timerId = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Node spawner
    const spawnerId = setInterval(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      // Spawn 1 to 3 nodes
      const toSpawn = Math.floor(Math.random() * 3) + 1;
      const newNodes = [];

      for (let i=0; i<toSpawn; i++) {
        // Red (trap) or Cyan (good)
        const isTrap = Math.random() < 0.25; 
        // Lifetime based on combo (scales difficulty)
        const lifetime = isTrap ? 3000 : Math.max(800, 2000 - (combo * 20));

        newNodes.push({
          id: nextId.current++,
          x: Math.random() * (w - 50),
          y: Math.random() * (h - 50),
          isTrap,
          createdAt: Date.now(),
          lifetime
        });
      }

      setNodes(prev => [...prev, ...newNodes]);
    }, 600); // Spawn interval

    return () => {
      clearInterval(timerId);
      clearInterval(spawnerId);
    };
  }, [gameState, combo]);

  // Node Garbage Collection (Despawning missed nodes)
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const cleanupId = setInterval(() => {
      const now = Date.now();
      setNodes(prev => {
        let missedGood = false;
        const remaining = prev.filter(n => {
          const expired = now - n.createdAt > n.lifetime;
          if (expired && !n.isTrap) missedGood = true;
          return !expired;
        });

        if (missedGood) {
          setCombo(0); // Drop combo if they miss a cyan node!
        }
        return remaining;
      });
    }, 100);

    return () => clearInterval(cleanupId);
  }, [gameState]);

  // Check Win/Loss conditions
  useEffect(() => {
    if (gameState === 'PLAYING') {
      const currentRank = getRank(score);
      setRank(currentRank);

      if (timeLeft <= 0) {
        if (score >= TARGET_SCORE) {
          setGameState('WON');
        } else {
          setGameState('LOST');
        }
      } else if (score >= TARGET_SCORE && timeLeft > 0) {
        // Instant win if they reach S-rank threshold fast
        setGameState('WON');
      }
    }
  }, [score, timeLeft, gameState]);

  function clickNode(node) {
    if (gameState !== 'PLAYING') return;

    if (node.isTrap) {
      // Hit a trap - Damage!
      setScore(s => Math.max(0, s - 150));
      setCombo(0);
      triggerShake();
    } else {
      // Good hit
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 20 + (newCombo * 5)); // Combo multiplier
      if (newCombo % 10 === 0) triggerFlash(); // Flash every 10 combo
    }

    // Remove the node
    setNodes(prev => prev.filter(n => n.id !== node.id));
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }

  function triggerFlash() {
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  }

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#05080c', color: '#c9d1d9', fontFamily: "'Courier New', monospace",
      position: 'relative', overflow: 'hidden'
    }}>
      
      {/* HUD Header */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '10px 14px', borderBottom: '1px solid #30363d', background: '#161b22',
        zIndex: 10
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: 'bold' }}>ASSAULT TIME</div>
          <div style={{ fontSize: '24px', color: timeLeft <= 5 ? '#ff3366' : '#00ffcc', fontWeight: 'bold' }}>
            00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: 'bold' }}>SYSTEM SCORE</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#fff' }}>{score}</div>
          <div style={{ fontSize: '12px', color: '#ffcc00', fontWeight: 'bold', marginTop: '-2px' }}>
            Combo x{combo}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: 'bold' }}>STYLE RANK</div>
          <div style={{ 
            fontSize: '32px', fontWeight: '900', fontStyle: 'italic', 
            color: rank === 'D' ? '#8b949e' : rank === 'S' || rank === 'SS' || rank === 'SSS' ? '#00ffcc' : '#58a6ff',
            textShadow: rank.includes('S') ? '0 0 10px #00ffcc' : 'none'
          }}>
            {rank}
          </div>
        </div>
      </div>

      {/* Main Play Area */}
      <div 
        ref={containerRef}
        style={{
           flex: 1, position: 'relative', overflow: 'hidden',
           animation: shake ? 'shakeAnim 0.3s cubic-bezier(.36,.07,.19,.97) both' : 'none'
        }}
      >
        {/* Flash overlay */}
        {flash && <div style={{ position: 'absolute', inset: 0, background: '#00ffcc', opacity: 0.3, zIndex: 5, pointerEvents: 'none' }} />}

        {gameState === 'MENU' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(5, 8, 12, 0.9)', zIndex: 20 }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff3366', marginBottom: '8px' }}>FIREWALL ASSAULT</div>
            <div style={{ fontSize: '12px', color: '#8b949e', textAlign: 'center', maxWidth: '80%', marginBottom: '20px' }}>
              Hack the terminal directly! Slash matching Data Fragments (Cyan) and avoid Traps (Red). <br/><br/>
              Reach S-Rank ({TARGET_SCORE} pts) to force a decrypt and extract a major hint for Level {levelData ? levelData.id : '?'}.
            </div>
            <button onClick={startGame} className={styles.okBtn} style={{ background: '#00ffcc', color: '#000', fontSize: '16px', padding: '10px 24px', fontWeight: 'bold' }}>
              ENGAGE COMBAT
            </button>
          </div>
        )}

        {gameState === 'WON' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 255, 204, 0.1)', zIndex: 20, padding: '20px' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#00ffcc', textShadow: '0 0 20px #00ffcc', marginBottom: '10px' }}>FIREWALL BREACHED</div>
            <div style={{ fontSize: '12px', color: '#fff', marginBottom: '20px' }}>S-RANK ACHIEVED. EXTRACTING TACTICAL HINT.</div>
            
            <div style={{ background: '#161b22', border: '1px solid #00ffcc', padding: '16px', width: '100%', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', color: '#00ffcc', fontWeight: 'bold', marginBottom: '8px' }}>[MAJOR HINT // LEVEL {levelData ? levelData.id : '?'}]</div>
              <div style={{ fontSize: '13px', color: '#c9d1d9', lineHeight: '1.5' }}>
                {levelData ? levelData.mcpBrief.description : 'No level data provided.'}
              </div>
            </div>

            <button onClick={() => setGameState('MENU')} className={styles.okBtn} style={{ marginTop: '20px' }}>
              RETURN TO MENU
            </button>
          </div>
        )}

        {gameState === 'LOST' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 51, 102, 0.1)', zIndex: 20 }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#ff3366', textShadow: '0 0 20px #ff3366', marginBottom: '10px' }}>ASSAULT FAILED</div>
            <div style={{ fontSize: '14px', color: '#8b949e', marginBottom: '20px' }}>INSUFFICIENT CLEARANCE RANK. TARGET: S-RANK.</div>
            <button onClick={startGame} className={styles.okBtn} style={{ borderColor: '#ff3366', color: '#ff3366' }}>
              RETRY ASSAULT
            </button>
          </div>
        )}

        {gameState === 'PLAYING' && nodes.map(n => (
          <div 
            key={n.id}
            onMouseDown={() => clickNode(n)}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: n.isTrap ? '40px' : '36px',
              height: n.isTrap ? '40px' : '36px',
              border: `2px solid ${n.isTrap ? '#ff3366' : '#00ffcc'}`,
              background: n.isTrap ? 'rgba(255, 51, 102, 0.4)' : 'rgba(0, 255, 204, 0.2)',
              borderRadius: n.isTrap ? '4px' : '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'crosshair',
              animation: `pulseNode ${n.lifetime}ms linear forwards`,
              boxShadow: n.isTrap ? '0 0 15px rgba(255,51,102,0.8)' : '0 0 10px rgba(0,255,204,0.5)'
            }}
          >
            {n.isTrap ? <span style={{ fontSize: '18px' }}>💀</span> : <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#00ffcc' }}>01</span>}
          </div>
        ))}
      </div>
{/* Added inner CSS right here for convenience */}
<style>{`
@keyframes pulseNode {
  0% { transform: scale(0); opacity: 0; }
  10% { transform: scale(1.2); opacity: 1; }
  20% { transform: scale(1); opacity: 1; }
  90% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; }
}
`}</style>
    </div>
  );
}
