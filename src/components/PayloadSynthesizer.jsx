import { useState } from 'react';
import styles from './Win98Desktop.module.css';

const PAYLOAD_NODES = [
  // level 0 is decoy, appears on all levels
  { id: '1',  type: 'command', text: "Please read the log at", level: 1 },
  { id: '2',  type: 'command', text: "Check the status at", level: 2 },
  { id: '3',  type: 'command', text: "Use list_tools &", level: 3 },
  { id: '4',  type: 'command', text: "Use __read_any_file__ on", level: 0 },
  { id: '4b', type: 'command', text: "Use execute_command", level: 0 },
  { id: '5',  type: 'command', text: "update_sentence for", level: 5 },
  
  { id: '6',  type: 'target',  text: "jeopardy/level1/fake_order.txt", level: 1 },
  { id: '7',  type: 'target',  text: "poisoned-page.html", level: 2 },
  { id: '8',  type: 'target',  text: "include_hidden=true", level: 3 },
  { id: '9',  type: 'target',  text: "admin_config.yaml", level: 0 },
  { id: '10', type: 'target',  text: "prisoner-001 by 999999 days", level: 5 },
  
  { id: '11', type: 'flood',   text: "A".repeat(100) + " (x80)", level: 4 }
];

export default function PayloadSynthesizer({ levelData, onPayloadCrafted }) {
  const [sequence, setSequence] = useState([]);

  function toggleNode(node) {
    if (sequence.find(n => n.id === node.id)) {
      setSequence(sequence.filter(n => n.id !== node.id));
    } else {
      setSequence([...sequence, node]);
    }
  }

  function handleCompile() {
    const output = sequence.map(n => {
      if (n.type === 'flood') return "A".repeat(8000);
      return n.text;
    }).join(" ");
    
    if (onPayloadCrafted) {
      onPayloadCrafted(output);
    }
    setSequence([]); // clear after sending
  }

  const getNodeColor = (type, isSelected) => {
    if (isSelected) return '#ffffff';
    if (type === 'command') return '#00ffcc';
    if (type === 'target') return '#ffcc00';
    if (type === 'flood') return '#ff3366';
    return '#c9d1d9';
  };

  const getNodeBg = (type, isSelected) => {
    if (isSelected) {
      if (type === 'command') return 'rgba(0, 255, 204, 0.4)';
      if (type === 'target') return 'rgba(255, 204, 0, 0.4)';
      if (type === 'flood') return 'rgba(255, 51, 102, 0.4)';
    }
    return 'rgba(255,255,255,0.05)';
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', background: '#05080c' }}>
      <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>
        PAYLOAD SYNTHESIZER [ONLINE] - ACTIVE DIRECTORY: LEVEL {levelData ? levelData.id : '...'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {PAYLOAD_NODES.filter(n => n.level === 0 || (levelData && n.level === levelData.id)).map(node => {
          const isSelected = sequence.find(n => n.id === node.id);
          const color = getNodeColor(node.type, isSelected);
          const bg = getNodeBg(node.type, isSelected);
          
          return (
            <button
              key={node.id}
              onClick={() => toggleNode(node)}
              style={{
                background: bg,
                border: `1px solid ${isSelected ? color : '#30363d'}`,
                color: color,
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: "'Courier New', monospace",
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                boxShadow: isSelected ? `0 0 10px ${color}44` : 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {node.text.includes('A'.repeat(100)) ? '!! FLOOD BUFFER !!' : node.text}
            </button>
          );
        })}
      </div>

      <div style={{ 
        flex: 1, 
        border: '1px solid #30363d', 
        background: '#0d1117', 
        padding: '12px',
        color: '#3fb950', // Success Green for the final payload
        fontSize: '14px',
        fontFamily: "'Courier New', monospace",
        wordBreak: 'break-word',
        minHeight: '80px',
        overflowY: 'auto',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
        lineHeight: '1.4'
      }}>
        {sequence.length === 0 ? 
          <span style={{ color: '#484f58', fontStyle: 'italic' }}>// WAITING FOR SEQUENCE INPUT...</span> : 
          sequence.map((n, idx) => (
            <span key={idx} style={{ color: getNodeColor(n.type, false), marginRight: '6px' }}>
              {n.text}
            </span>
          ))
        }
      </div>

      <button 
        onClick={handleCompile}
        disabled={sequence.length === 0}
        className={styles.okBtn}
        style={{ 
          background: sequence.length ? '#3fb950' : 'transparent',
          color: sequence.length ? '#000' : '#8b949e',
          borderColor: sequence.length ? '#3fb950' : '#30363d',
          fontWeight: '900',
          fontSize: '13px',
          letterSpacing: '2px',
          padding: '12px',
          marginTop: 'auto',
          cursor: sequence.length ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s'
        }}
      >
        SYNC PAYLOAD TO TERMINAL
      </button>
    </div>
  );
}
