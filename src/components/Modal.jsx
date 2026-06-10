import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button onClick={onClose} style={styles.close} aria-label="Close">✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 16,
    width: '100%', maxWidth: 520,
    boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
    maxHeight: '90vh', overflow: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #E0DCDA',
  },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#0D0D0D' },
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: '#999', padding: 4, lineHeight: 1,
  },
  body: { padding: 24 },
};
