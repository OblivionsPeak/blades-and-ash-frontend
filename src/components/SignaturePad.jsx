import { useEffect, useRef, useState } from 'react';

// Draw-to-sign box. Works with mouse, touch, and pen via pointer events.
// Calls onChange(dataUrl | null) after every stroke / clear — the data URL is
// a PNG with a white background so it reads the same in the admin view and
// in the emailed copy.
export default function SignaturePad({ onChange, disabled = false, height = 180 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the bitmap to the CSS box × devicePixelRatio so strokes stay crisp
  // on phones. Re-run on resize; existing ink is preserved by re-drawing the
  // snapshot into the resized canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const snapshot = hasInk ? canvas.toDataURL('image/png') : null;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
      if (snapshot) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = snapshot;
      }
    }

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e) {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    // A tap with no movement still leaves a dot, so a signature can't be
    // "signed" with zero ink but a short mark counts.
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    if (!hasInk) setHasInk(true);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end(e) {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
    emit();
  }

  function emit() {
    const canvas = canvasRef.current;
    // Flatten onto white: the pad itself is white, but the bitmap is
    // transparent, and a transparent PNG on a dark admin page is unreadable.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    onChange?.(out.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
    onChange?.(null);
  }

  return (
    <div>
      <div style={{ ...styles.box, opacity: disabled ? 0.6 : 1 }}>
        <canvas
          ref={canvasRef}
          style={{ ...styles.canvas, height, touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          aria-label="Signature pad — draw your signature here"
        />
        <div style={styles.baseline} aria-hidden="true" />
        {!hasInk && <span style={styles.placeholder}>Sign here</span>}
      </div>
      <div style={styles.row}>
        <span style={styles.hint}>Use your finger, stylus, or mouse.</span>
        <button type="button" onClick={clear} disabled={disabled || !hasInk} className="btn btn-ghost btn-sm">
          Clear
        </button>
      </div>
    </div>
  );
}

const styles = {
  box: {
    position: 'relative', background: '#fff', borderRadius: 10,
    border: '1px solid #2A2A2A', overflow: 'hidden',
  },
  canvas: { display: 'block', width: '100%' },
  baseline: {
    position: 'absolute', left: 24, right: 24, bottom: 34,
    borderTop: '1px dashed #bbb', pointerEvents: 'none',
  },
  placeholder: {
    position: 'absolute', left: 0, right: 0, top: '38%', textAlign: 'center',
    color: '#bbb', fontFamily: "'Cormorant', serif", fontStyle: 'italic', fontSize: 22,
    pointerEvents: 'none',
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 },
  hint: { fontSize: 12, color: '#9A938A' },
};
