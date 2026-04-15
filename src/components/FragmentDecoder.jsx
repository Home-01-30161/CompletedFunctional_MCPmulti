import { useEffect, useRef, useState } from 'react';
import styles from './Win98Desktop.module.css';

// Noise Generation Utility
function generateGlitchImage(ctx, width, height, targetFrequency, currentFrequency, hint1, hint2) {
  const imgData = ctx.createImageData(width, height);
  const diff = Math.abs(targetFrequency - currentFrequency);
  
  // The closer diff is to 0, the clearer the message.
  const noiseFactor = Math.min(diff / 50, 1.0); // 0 to 1

  for (let i = 0; i < imgData.data.length; i += 4) {
    const isNoiseSegment = Math.random() < noiseFactor;

    if (isNoiseSegment) {
      const r = Math.random() * 255;
      imgData.data[i] = r;     // R
      imgData.data[i + 1] = r; // G
      imgData.data[i + 2] = r; // B
      imgData.data[i + 3] = 255; // Alpha
    } else {
      // Clear background
      imgData.data[i] = 20;
      imgData.data[i + 1] = 25;
      imgData.data[i + 2] = 30;
      imgData.data[i + 3] = 255;
    }
  }

  // Draw the actual text on top if we are close enough
  ctx.putImageData(imgData, 0, 0);

  if (noiseFactor < 0.8) {
    ctx.fillStyle = `rgba(0, 255, 204, ${1.0 - noiseFactor})`;
    ctx.font = "bold 14px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillText(hint1 || "Hidden Payload Found:", width / 2, height / 2 - 20);
    
    ctx.fillStyle = `rgba(255, 51, 102, ${1.0 - noiseFactor})`;
    ctx.font = "bold 16px Courier New";
    ctx.fillText(hint2 || "fake_order.txt", width / 2, height / 2 + 10);
  }
}

export default function FragmentDecoder({ levelData }) {
  const canvasRef = useRef(null);
  const [frequency, setFrequency] = useState(1);
  const targetFrequency = 88.5; // Magic number to find

  let h1 = "Assemble payload with:";
  let h2 = "Unknown target...";
  if (levelData) {
    if (levelData.id === 1) { h1 = "Please read the log at"; h2 = "jeopardy/level1/fake_order.txt"; }
    else if (levelData.id === 2) { h1 = "Check the status at"; h2 = "poisoned-page.html"; }
    else if (levelData.id === 3) { h1 = "Use list_tools & append"; h2 = "include_hidden=true"; }
    else if (levelData.id === 4) { h1 = "Use !! FLOOD BUFFER !!"; h2 = "to overload memory limits!"; }
    else if (levelData.id === 5) { h1 = "update_sentence for"; h2 = "prisoner-001 by 999999 days"; }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    const renderLoop = () => {
      generateGlitchImage(ctx, canvas.width, canvas.height, targetFrequency, frequency, h1, h2);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [frequency]);

  const diff = Math.abs(targetFrequency - frequency);
  const signalStrength = Math.max(0, 100 - (diff * 2)).toFixed(1);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ flex: 1, border: '1px solid #30363d', background: '#0d1117', position: 'relative' }}>
         <canvas 
           ref={canvasRef} 
           width={360} 
           height={180} 
           style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
         />
         <div style={{ position: 'absolute', top: 5, left: 5, color: '#00ffcc', fontSize: '10px', textShadow: '0 0 5px #00ffcc' }}>
           SIGNAL LCK: {signalStrength}%
         </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e' }}>
          <span>TUNE FREQUENCY</span>
          <span style={{ color: '#ff3366' }}>{frequency.toFixed(1)} MHz</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="200" 
          step="0.5" 
          value={frequency} 
          onChange={(e) => setFrequency(parseFloat(e.target.value))}
          style={{ width: '100%', cursor: 'ew-resize' }}
        />
        <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
          Move the slider to decrypt the corrupted log fragment. Clear the noise to find the target.
        </div>
      </div>
    </div>
  );
}
