import { format } from 'date-fns';
import StatusBadge from './StatusBadge';
import { apptServiceNames } from '../utils';

export default function AppointmentCard({ appointment, onCancel, showStaff }) {
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const isPast = end < new Date();
  const canCancel = !isPast && !['cancelled', 'completed'].includes(appointment.status);

  return (
    <div style={styles.card}>
      <div style={styles.dateStrip}>
        <span style={styles.day}>{format(start, 'EEE')}</span>
        <span style={styles.date}>{format(start, 'd')}</span>
        <span style={styles.month}>{format(start, 'MMM')}</span>
      </div>
      <div style={styles.details}>
        <div style={styles.top}>
          <div>
            <div style={styles.service}>{apptServiceNames(appointment)}</div>
            {showStaff && appointment.staff && (
              <div style={styles.meta}>with {appointment.staff.full_name}</div>
            )}
            {!showStaff && appointment.client && (
              <div style={styles.meta}>{appointment.client.full_name}</div>
            )}
            <div style={styles.meta}>{format(start, 'h:mm a')} – {format(end, 'h:mm a')}</div>
          </div>
          <div style={styles.right}>
            <StatusBadge status={appointment.status} />
            <div style={styles.price}>${(appointment.total_cents / 100).toFixed(2)}</div>
          </div>
        </div>
        {appointment.client_notes && (
          <p style={styles.notes}>"{appointment.client_notes}"</p>
        )}
        {canCancel && onCancel && (
          <button
            onClick={() => onCancel(appointment.id)}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#16161A', borderRadius: 12,
    border: '1px solid #2A2A2A', display: 'flex',
    overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  dateStrip: {
    background: '#0E0E10', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '16px 20px', minWidth: 72, gap: 2,
  },
  day: { fontSize: 11, letterSpacing: '0.06em', color: '#C8A24B', textTransform: 'uppercase' },
  date: { fontSize: 28, fontWeight: 700, fontFamily: "'Cormorant', serif", lineHeight: 1 },
  month: { fontSize: 11, letterSpacing: '0.06em', color: '#9A938A', textTransform: 'uppercase' },
  details: { flex: 1, padding: 16 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  service: { fontFamily: "'Cormorant', serif", fontSize: 16, color: '#EDE7DB', fontWeight: 600 },
  meta: { fontSize: 13, color: '#9A938A', marginTop: 3 },
  right: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 16, fontWeight: 700, color: '#EDE7DB' },
  notes: { fontSize: 13, color: '#9A938A', fontStyle: 'italic', marginTop: 8 },
  cancelBtn: {
    marginTop: 12, padding: '6px 16px', borderRadius: 999,
    background: 'none', border: '1px solid #2A2A2A', color: '#C0392B',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
};
