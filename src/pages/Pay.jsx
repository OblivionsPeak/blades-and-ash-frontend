import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { format } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { apptServiceNames } from '../utils';
import PaymentForm from '../components/PaymentForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Customer-facing payment page. A signed-in client pays the outstanding balance
// on one of their appointments — used when the salon has applied a discount and
// the client settles the (now lower) total online. The amount is always set by
// the server (create-intent re-derives it); this page never sends a price.
export default function Pay() {
  const { id } = useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [creating, setCreating] = useState(false);
  const [paid, setPaid] = useState(false);

  const balanceDue = appointment
    ? Math.max(0, (appointment.total_cents || 0) - (appointment.amount_paid_cents || 0))
    : 0;
  const payable = appointment
    && appointment.status !== 'cancelled'
    && balanceDue > 0;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!session?.access_token) return;
    api.getAppointment(id, session.access_token)
      .then((data) => setAppointment(data.appointment || data))
      .catch((e) => setError(e.message || 'Could not load this appointment.'))
      .finally(() => setLoading(false));
  }, [user, session, id]);

  // Once we have an appointment with a balance, create the PaymentIntent so the
  // card form is ready. The server validates ownership and the amount.
  useEffect(() => {
    if (!payable || clientSecret || creating || !session?.access_token) return;
    setCreating(true);
    api.createPaymentIntent({ appointment_id: id }, session.access_token)
      .then((res) => setClientSecret(res.client_secret))
      .catch((e) => setError(e.message || 'Could not start payment.'))
      .finally(() => setCreating(false));
  }, [payable, clientSecret, creating, session, id]);

  function onSuccess() {
    setPaid(true);
    setAppointment((a) => a ? { ...a, amount_paid_cents: a.total_cents, status: 'confirmed' } : a);
  }

  return (
    <div style={styles.page}>
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 style={styles.title}>Pay for Your Appointment</h1>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : !appointment ? (
          <div className="alert alert-error">Appointment not found.</div>
        ) : (
          <div style={styles.card}>
            <Row label="Service" value={apptServiceNames(appointment)} />
            {appointment.staff && <Row label="Stylist" value={appointment.staff.full_name} />}
            <Row
              label="Date & Time"
              value={`${format(new Date(appointment.start_time), 'MMMM d')} • ${format(new Date(appointment.start_time), 'h:mm a')}`}
            />
            {appointment.discount_code && (
              <Row label="Discount applied" value={appointment.discount_code} highlight />
            )}
            <div style={styles.divider} />
            <Row label="Amount due" value={`$${(balanceDue / 100).toFixed(2)}`} bold />

            {paid ? (
              <div style={{ marginTop: 24 }}>
                <div className="alert alert-success">Payment received — thank you! Your appointment is confirmed.</div>
                <Link to="/profile" style={styles.link}>Back to My Account →</Link>
              </div>
            ) : appointment.status === 'cancelled' ? (
              <p style={styles.note}>This appointment was cancelled, so there's nothing to pay.</p>
            ) : balanceDue <= 0 ? (
              <div style={{ marginTop: 16 }}>
                <p style={styles.note}>This appointment is already paid in full. Nothing is due.</p>
                <Link to="/profile" style={styles.link}>Back to My Account →</Link>
              </div>
            ) : clientSecret ? (
              <div style={{ marginTop: 24 }}>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm
                    amount={balanceDue}
                    clientSecret={clientSecret}
                    onSuccess={onSuccess}
                    onError={(m) => setError(m)}
                  />
                </Elements>
              </div>
            ) : (
              <div className="loading-center" style={{ marginTop: 24 }}><div className="spinner" /></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, highlight }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={{ ...styles.rowValue, ...(bold ? styles.rowValueBold : {}), ...(highlight ? styles.rowValueHighlight : {}) }}>
        {value}
      </span>
    </div>
  );
}

const styles = {
  page: { padding: '48px 0 80px' },
  title: { fontFamily: "'Cormorant', serif", fontSize: 32, marginBottom: 28 },
  card: {
    background: '#16161A', borderRadius: 16, padding: 28,
    border: '1px solid #2A2A2A', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '7px 0' },
  rowLabel: { fontSize: 13, color: '#9A938A' },
  rowValue: { fontSize: 14, color: '#EDE7DB', textAlign: 'right' },
  rowValueBold: { fontSize: 20, fontWeight: 700, fontFamily: "'Cormorant', serif" },
  rowValueHighlight: { color: '#C8A24B', fontWeight: 600 },
  divider: { height: 1, background: '#2A2A2A', margin: '12px 0' },
  note: { fontSize: 14, color: '#9A938A', marginTop: 16, lineHeight: 1.5 },
  link: { display: 'inline-block', marginTop: 16, color: '#C8A24B', fontSize: 14, textDecoration: 'none' },
};
