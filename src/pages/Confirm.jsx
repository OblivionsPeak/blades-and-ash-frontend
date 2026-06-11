import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { apptItems } from '../utils';

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

        {appointment && (() => {
          const items = apptItems(appointment);
          const subtotal = items.reduce((s, it) => s + (it.price_cents || 0), 0);
          const total = appointment.total_cents != null ? appointment.total_cents : subtotal;
          const discount = subtotal - total;
          const money = c => `$${(c / 100).toFixed(2)}`;
          return (
            <div style={styles.summary}>
              {items.map((it, i) => (
                <div key={it.service_id || i} style={styles.itemRow}>
                  <span style={{ fontSize: 14 }}>{it.name}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{it.price_cents != null ? money(it.price_cents) : ''}</span>
                </div>
              ))}
              <div style={{ height: 8 }} />
              <Row label="Stylist" value={appointment.staff?.full_name || '—'} />
              <Row label="Date" value={appointment.start_time ? format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy') : '—'} />
              <Row label="Time" value={appointment.start_time ? format(new Date(appointment.start_time), 'h:mm a') : '—'} />
              {discount > 0 && <Row label="Subtotal" value={money(subtotal)} />}
              {discount > 0 && <Row label="Discount" value={`−${money(discount)}`} accent />}
              {appointment.total_cents != null && <Row label="Total" value={money(total)} bold />}
              <Row label="Status" value={appointment.status || 'confirmed'} />
            </div>
          );
        })()}

        <div style={styles.policyBox}>
          <strong style={{ color: '#D8BC7E', fontSize: 13 }}>Cancellation policy</strong>
          <p style={styles.policyText}>
            Cancellations within 48 hours of your appointment are charged 50% of the service.
            No-shows are charged 100% of the service.
          </p>
        </div>

        <div style={styles.actions}>
          <Link to="/profile" style={styles.btn}>View My Appointments</Link>
          <Link to="/book" style={styles.btnOutline}>Book Another</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2A2A2A' }}>
      <span style={{ color: '#9A938A', fontSize: 14 }}>{label}</span>
      <span style={{
        fontWeight: bold ? 800 : 600,
        fontSize: bold ? 15 : 14,
        color: accent ? '#9ad9b4' : (bold ? '#D8BC7E' : '#EDE7DB'),
      }}>{value}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 64px)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    background: '#16161A', borderRadius: 20, padding: 48,
    maxWidth: 480, width: '100%', textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
  },
  icon: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#0E0E10', color: '#C8A24B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, fontWeight: 700, margin: '0 auto 24px',
  },
  title: { fontFamily: "'Cormorant', serif", fontSize: 32, color: '#EDE7DB', marginBottom: 12 },
  sub: { color: '#9A938A', fontSize: 15, lineHeight: 1.6, marginBottom: 32 },
  summary: { textAlign: 'left', marginBottom: 24 },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2A2A2A' },
  policyBox: {
    textAlign: 'left', background: '#1E1E22', border: '1px solid #2A2A2A',
    borderRadius: 10, padding: '14px 16px', marginBottom: 32,
  },
  policyText: { margin: '6px 0 0', color: '#9A938A', fontSize: 12.5, lineHeight: 1.6 },
  actions: { display: 'flex', flexDirection: 'column', gap: 12 },
  btn: {
    padding: '14px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B',
    fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'block',
    fontFamily: "'Jost', sans-serif",
  },
  btnOutline: {
    padding: '14px', borderRadius: 999, border: '2px solid #2A2A2A',
    color: '#9A938A', fontSize: 15, fontWeight: 500, textDecoration: 'none', display: 'block',
  },
};
