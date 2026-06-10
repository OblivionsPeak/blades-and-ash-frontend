export default function StaffCard({ staff, selected, onSelect }) {
  const initials = staff.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div
      onClick={() => onSelect && onSelect(staff)}
      style={{
        ...styles.card,
        ...(selected ? styles.cardSelected : {}),
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div style={styles.avatar}>{initials}</div>
      <div>
        <div style={styles.name}>{staff.full_name}</div>
        <div style={styles.role}>{staff.role === 'admin' ? 'Owner / Stylist' : 'Stylist'}</div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff', borderRadius: 12,
    border: '2px solid #E0DCDA',
    padding: 20, display: 'flex', alignItems: 'center', gap: 16,
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardSelected: {
    border: '2px solid #C8A24B',
    boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
    background: '#FFFDF7',
  },
  avatar: {
    width: 52, height: 52, borderRadius: '50%',
    background: '#0E0E10', color: '#C8A24B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Cormorant', serif", fontSize: 18, fontWeight: 700,
    flexShrink: 0,
  },
  name: { fontFamily: "'Cormorant', serif", fontSize: 16, color: '#0E0E10' },
  role: { fontSize: 13, color: '#888', marginTop: 2 },
};
