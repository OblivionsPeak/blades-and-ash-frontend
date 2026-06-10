import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Confirm() {
  const { id } = useParams();
  const { session } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    api.getAppointment(id, session.access_token)
      .then(data => setAppointment(data.appointment || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, session]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>✓</div>
        <h1 style={styles.title}>You're booked!</h1>
        <p style={styles.sub}>Your appointment has been confirmed. We'll send you a reminder before your visit.</p>

        {appointment && (
          <div style={styles.summary}>
            <Row label="Service" value={appointment.service?.name || '—'} />
            <Row label="Stylist" value={appointment.staff?.full_name || '—'} />
            <Row label="Date" value={appointment.start_time ? format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy') : '—'} />
            <Row label="Time" value={appointment.start_time ? format(new Date(appointment.start_time), 'h:mm a') : '—'} />
            <Row label="Status" value={appointment.status || 'confirmed'} />
          </div>
        )}

        <div style={styles.actions}>
          <Link to="/profile" style={styles.btn}>View My Appointments</Link>
          <Link to="/book" style={styles.btnOutline}>Book Another</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EDE9' }}>
      <span style={{ color: '#888', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 64px)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 20, padding: 48,
    maxWidth: 480, width: '100%', textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
  },
  icon: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#0D0D0D', color: '#C9A84C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, fontWeight: 700, margin: '0 auto 24px',
  },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 32, color: '#0D0D0D', marginBottom: 12 },
  sub: { color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 },
  summary: { textAlign: 'left', marginBottom: 32 },
  actions: { display: 'flex', flexDirection: 'column', gap: 12 },
  btn: {
    padding: '14px', borderRadius: 999, background: '#0D0D0D', color: '#C9A84C',
    fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'block',
    fontFamily: "'Inter', sans-serif",
  },
  btnOutline: {
    padding: '14px', borderRadius: 999, border: '2px solid #E0DCDA',
    color: '#666', fontSize: 15, fontWeight: 500, textDecoration: 'none', display: 'block',
  },
};
