import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfDay } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ServiceCard from '../components/ServiceCard';
import StaffCard from '../components/StaffCard';
import TimeSlotPicker from '../components/TimeSlotPicker';
import PaymentForm from '../components/PaymentForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const STEPS = ['Service', 'Stylist', 'Date & Time', 'Details', 'Confirm'];

export default function Book() {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getServices().then(setServices).catch(() => {});
    api.getStaff().then(setStaff).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlotsLoading(true);
    const staffId = selectedStaff?.id || staff[0]?.id;
    if (!staffId) { setSlotsLoading(false); return; }
    api.getAvailability({ staff_id: staffId, service_id: selectedService.id, date: format(selectedDate, 'yyyy-MM-dd') })
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedService, selectedStaff]);

  function next() { setErr(''); setStep(s => s + 1); }
  function back() { setErr(''); setStep(s => s - 1); }

  async function confirmBooking() {
    setLoading(true); setErr('');
    const token = session?.access_token;
    if (!token) { setErr('Please sign in to book.'); setLoading(false); return; }

    try {
      const result = await api.createAppointment({
        staff_id: selectedStaff?.id || staff[0]?.id,
        service_id: selectedService.id,
        start_time: selectedSlot,
        client_notes: clientNotes,
      }, token);

      setBooking(result.appointment);

      if (result.client_secret) {
        setClientSecret(result.client_secret);
      } else {
        navigate(`/confirm/${result.appointment.id}`);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onPaymentSuccess() {
    navigate(`/confirm/${booking.id}`);
  }

  const staffForService = selectedService
    ? staff.filter(s => true) // backend filters; show all for now
    : staff;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Progress bar */}
        <div style={styles.progress}>
          {STEPS.map((label, i) => (
            <div key={label} style={styles.stepWrap}>
              <div style={{ ...styles.stepDot, ...(i <= step ? styles.stepDotActive : {}) }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ ...styles.stepLabel, ...(i === step ? styles.stepLabelActive : {}) }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

          {/* Step 0: Service */}
          {step === 0 && (
            <div>
              <h2 style={styles.stepTitle}>Choose a Service</h2>
              <div className="grid-2" style={{ marginTop: 20 }}>
                {services.map(s => (
                  <ServiceCard key={s.id} service={s} selected={selectedService?.id === s.id}
                    onSelect={svc => { setSelectedService(svc); setSelectedStaff(null); setSelectedSlot(null); }} />
                ))}
              </div>
              <div style={styles.navRow}>
                <span />
                <button
                  onClick={next} disabled={!selectedService}
                  style={{ ...styles.nextBtn, opacity: selectedService ? 1 : 0.4 }}
                >Next →</button>
              </div>
            </div>
          )}

          {/* Step 1: Stylist */}
          {step === 1 && (
            <div>
              <h2 style={styles.stepTitle}>Choose a Stylist</h2>
              <div className="grid-2" style={{ marginTop: 20 }}>
                <div
                  onClick={() => setSelectedStaff(null)}
                  style={{ ...styles.noPreference, ...(selectedStaff === null ? styles.noPreferenceSelected : {}) }}
                >
                  <span style={{ fontSize: 28 }}>🎲</span>
                  <span style={{ fontWeight: 600 }}>No preference</span>
                </div>
                {staffForService.map(s => (
                  <StaffCard key={s.id} staff={s} selected={selectedStaff?.id === s.id}
                    onSelect={st => setSelectedStaff(st)} />
                ))}
              </div>
              <div style={styles.navRow}>
                <button onClick={back} style={styles.backBtn}>← Back</button>
                <button onClick={next} style={styles.nextBtn}>Next →</button>
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div>
              <h2 style={styles.stepTitle}>Pick a Date & Time</h2>
              <div style={styles.calendarRow}>
                <div style={styles.calendarWrap}>
                  <Calendar
                    onChange={d => { setSelectedDate(d); setSelectedSlot(null); }}
                    value={selectedDate}
                    minDate={new Date()}
                    maxDate={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)}
                  />
                </div>
                <div style={styles.slotsWrap}>
                  {!selectedDate ? (
                    <p style={{ color: '#888', fontSize: 14 }}>Select a date to see available times.</p>
                  ) : slotsLoading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                  ) : (
                    <TimeSlotPicker slots={slots} selected={selectedSlot} onSelect={setSelectedSlot} />
                  )}
                </div>
              </div>
              <div style={styles.navRow}>
                <button onClick={back} style={styles.backBtn}>← Back</button>
                <button
                  onClick={next} disabled={!selectedSlot}
                  style={{ ...styles.nextBtn, opacity: selectedSlot ? 1 : 0.4 }}
                >Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              <h2 style={styles.stepTitle}>Your Details</h2>
              {user ? (
                <div style={styles.profileInfo}>
                  <span style={styles.profileAvatar}>{profile?.full_name?.[0] || '?'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{user.email}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert alert-info">
                    <strong>No account required</strong> — but signing in saves your history.{' '}
                    <a href="/login" style={{ color: '#C9A84C' }}>Sign in</a>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={guestName} onChange={e => setGuestName(e.target.value)} required placeholder="Jane Smith" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} required placeholder="jane@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginTop: 20 }}>
                <label className="form-label">Notes for stylist (optional)</label>
                <textarea className="form-input form-textarea" value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Any preferences, allergies, or requests…" />
              </div>
              <div style={styles.navRow}>
                <button onClick={back} style={styles.backBtn}>← Back</button>
                <button
                  onClick={next}
                  disabled={!user && (!guestName || !guestEmail)}
                  style={{ ...styles.nextBtn, opacity: (!user && (!guestName || !guestEmail)) ? 0.4 : 1 }}
                >Review →</button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && !clientSecret && (
            <div>
              <h2 style={styles.stepTitle}>Review & Confirm</h2>
              <div style={styles.summary}>
                <SummaryRow label="Service" value={selectedService?.name} />
                <SummaryRow label="Stylist" value={selectedStaff?.full_name || 'First available'} />
                <SummaryRow label="Date" value={selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''} />
                <SummaryRow label="Time" value={selectedSlot ? format(new Date(selectedSlot), 'h:mm a') : ''} />
                <div style={styles.divider} />
                <SummaryRow label="Total" value={`$${(selectedService?.price_cents / 100).toFixed(2)}`} bold />
                {selectedService?.deposit_required && (
                  <SummaryRow label="Due now (deposit)" value={`$${(selectedService.deposit_cents / 100).toFixed(2)}`} bold accent />
                )}
                {!selectedService?.deposit_required && (
                  <SummaryRow label="Due at salon" value={`$${(selectedService?.price_cents / 100).toFixed(2)}`} />
                )}
              </div>
              <div style={styles.navRow}>
                <button onClick={back} style={styles.backBtn}>← Back</button>
                <button onClick={confirmBooking} disabled={loading || !user} style={styles.confirmBtn}>
                  {loading ? 'Booking…' : selectedService?.deposit_required ? 'Continue to Payment' : 'Confirm Booking'}
                </button>
              </div>
              {!user && <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#888' }}>You must <a href="/login" style={{ color: '#C9A84C' }}>sign in</a> to complete your booking.</p>}
            </div>
          )}

          {/* Payment step */}
          {clientSecret && (
            <div>
              <h2 style={styles.stepTitle}>Payment</h2>
              <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
                A deposit secures your appointment. The remaining balance is due at the salon.
              </p>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  amount={selectedService?.deposit_cents}
                  onSuccess={onPaymentSuccess}
                  onError={msg => setErr(msg)}
                />
              </Elements>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ color: '#666', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: accent ? '#C9A84C' : '#0D0D0D', fontSize: bold ? 16 : 14 }}>{value}</span>
    </div>
  );
}

const styles = {
  page: { background: '#F9F7F4', minHeight: 'calc(100vh - 64px)', padding: '40px 16px' },
  container: { maxWidth: 720, margin: '0 auto' },
  progress: { display: 'flex', justifyContent: 'space-between', marginBottom: 32, position: 'relative' },
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 36, height: 36, borderRadius: '50%', border: '2px solid #E0DCDA',
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#aaa', transition: 'all 0.2s',
  },
  stepDotActive: { background: '#0D0D0D', border: '2px solid #0D0D0D', color: '#C9A84C' },
  stepLabel: { fontSize: 11, color: '#aaa', letterSpacing: '0.04em', textAlign: 'center' },
  stepLabelActive: { color: '#0D0D0D', fontWeight: 600 },
  card: { background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  stepTitle: { fontFamily: "'Playfair Display', serif", fontSize: 26, color: '#0D0D0D', marginBottom: 4 },
  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 },
  nextBtn: {
    padding: '12px 32px', borderRadius: 999, background: '#0D0D0D', color: '#C9A84C',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  backBtn: {
    padding: '12px 24px', borderRadius: 999, background: 'transparent',
    border: '1px solid #E0DCDA', color: '#666', fontSize: 14, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  confirmBtn: {
    padding: '12px 32px', borderRadius: 999, background: '#C9A84C', color: '#0D0D0D',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  noPreference: {
    background: '#fff', border: '2px solid #E0DCDA', borderRadius: 12,
    padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', transition: 'all 0.2s', fontSize: 14, color: '#444',
  },
  noPreferenceSelected: {
    border: '2px solid #C9A84C', background: '#FFFDF7',
    boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
  },
  calendarRow: { display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' },
  calendarWrap: { flex: '0 0 auto', minWidth: 280 },
  slotsWrap: { flex: 1, minWidth: 220 },
  profileInfo: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: 16, background: '#F9F7F4', borderRadius: 10, marginBottom: 16,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: '#0D0D0D', color: '#C9A84C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700,
  },
  summary: { border: '1px solid #E0DCDA', borderRadius: 10, padding: '8px 20px' },
  divider: { height: 1, background: '#E0DCDA', margin: '8px 0' },
};
