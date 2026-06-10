export default function ServiceCard({ service, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect && onSelect(service)}
      style={{
        ...styles.card,
        ...(selected ? styles.cardSelected : {}),
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div style={styles.top}>
        <h3 style={styles.name}>{service.name}</h3>
        <span style={styles.price}>${(service.price_cents / 100).toFixed(0)}</span>
      </div>
      {service.description && <p style={styles.desc}>{service.description}</p>}
      <div style={styles.meta}>
        <span style={styles.pill}>⏱ {service.duration_minutes} min</span>
        {service.deposit_required && (
          <span style={styles.pill}>💳 Deposit req.</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff', borderRadius: 12,
    border: '2px solid #E0DCDA',
    padding: 20, transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardSelected: {
    border: '2px solid #C9A84C',
    boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
    background: '#FFFDF7',
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#0D0D0D' },
  price: { fontSize: 20, fontWeight: 700, color: '#C9A84C' },
  desc: { fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 1.5 },
  meta: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill: {
    fontSize: 12, padding: '4px 10px',
    background: '#F5F3EF', borderRadius: 999, color: '#555',
  },
};
