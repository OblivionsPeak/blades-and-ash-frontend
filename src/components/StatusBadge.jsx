const STATUS_STYLES = {
  pending:   { bg: 'rgba(200,162,75,0.14)', color: '#D8BC7E', border: 'rgba(200,162,75,0.4)' },
  confirmed: { bg: 'rgba(111,207,151,0.14)', color: '#9ad9b4', border: 'rgba(111,207,151,0.4)' },
  cancelled: { bg: 'rgba(255,255,255,0.06)', color: '#9A938A', border: '#2A2A2A' },
  completed: { bg: 'rgba(88,166,255,0.14)', color: '#9ec5ff', border: 'rgba(88,166,255,0.4)' },
  no_show:   { bg: 'rgba(248,113,113,0.14)', color: '#f8a3a3', border: 'rgba(248,113,113,0.4)' },
};

export default function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
}
