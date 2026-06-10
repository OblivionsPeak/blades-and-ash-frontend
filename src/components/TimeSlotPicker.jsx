import { format, parseISO } from 'date-fns';

export default function TimeSlotPicker({ slots, selected, onSelect }) {
  if (!slots || slots.length === 0) {
    return <p style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No available times for this date.</p>;
  }

  return (
    <div style={styles.grid}>
      {slots.map(slot => {
        const date = parseISO(slot);
        const label = format(date, 'h:mm a');
        const isSelected = selected === slot;
        return (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            style={{ ...styles.slot, ...(isSelected ? styles.slotSelected : {}) }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  slot: {
    padding: '10px 4px', borderRadius: 8,
    border: '1.5px solid #E0DCDA',
    background: '#fff', color: '#0D0D0D',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.15s',
  },
  slotSelected: {
    background: '#0D0D0D', color: '#C9A84C',
    border: '1.5px solid #0D0D0D',
    fontWeight: 700,
  },
};
