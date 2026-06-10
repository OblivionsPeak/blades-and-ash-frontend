const STATUS_STYLES = {
  pending:   { bg: '#FEF9E7', color: '#7D6608', border: '#F9E79F' },
  confirmed: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  cancelled: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  completed: { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  no_show:   { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
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
