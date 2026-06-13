import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfDay } from 'date-fns';
import { api } from '../api';
import { apptItems, groupServicesByCategory } from '../utils';
import { useAuth } from '../AuthContext';
import ServiceCard from '../components/ServiceCard';
import StaffCard from '../components/StaffCard';
import TimeSlotPicker from '../components/TimeSlotPicker';
import CardSetupForm from '../components/CardSetupForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const STEP_LABELS = {
  service: 'Service',
  stylist: 'Stylist',
  datetime: 'Date & Time',
  details: 'Details',
  confirm: 'Confirm',
};

const CANCELLATION_POLICY = 'Cancellations within 48 hours of your appointment are charged 50% of the service. No-shows are charged 100% of the service.';

export default function Book() {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [booking, setBooking] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Cancellation policy agreement (required to submit)
  const [agreedPolicy, setAgreedPolicy] = useState(false);

  // Promo / discount code
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(null); // { code, label, original_cents, discounted_cents }
  const [promoErr, setPromoErr] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Summed totals across all selected services.
  const totalCents = selectedServices.reduce((sum, s) => sum + (s.price_cents || 0), 0);
  const totalMinutes = selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const serviceIds = selectedServices.map(s => s.id);

  useEffect(() => {
    api.getServices().then(setServices).catch(() => {});
    api.getStaff().then(data => {
      setStaff(data);
      // Solo-stylist mode: pre-select the only stylist so the summary shows
      // her name and the Stylist step can be skipped entirely.
      if (data.length === 1) setSelectedStaff(data[0]);
    }).catch(() => {});
  }, []);

  // With a single stylist there's nothing to choose — hide the step. It comes
  // back automatically as soon as a second staff member exists.
  const hideStylistStep = staff.length <= 1;
  const stepKeys = hideStylistStep
    ? ['service', 'datetime', 'details', 'confirm']
    : ['service', 'stylist', 'datetime', 'details', 'confirm'];
  const currentStep = stepKeys[step];

  const serviceGroups = groupServicesByCategory(services);

  useEffect(() => {
    if (!selectedDate || selectedServices.length === 0) return;
    setSlotsLoading(true);
    const staffId = selectedStaff?.id || staff[0]?.id;
    if (!staffId) { setSlotsLoading(false); return; }
    api.getAvailability({ staff_id: staffId, service_ids: selectedServices.map(s => s.id).join(','), date: format(selectedDate, 'yyyy-MM-dd') })
      .then(data => setSlots(Array.isArray(data) ? data : (data.slots || [])))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedServices, selectedStaff]);

  function toggleService(svc) {
    setSelectedServices(prev =>
      prev.some(s => s.id === svc.id) ? prev.filter(s => s.id !== svc.id) : [...prev, svc]
    );
    setSelectedSlot(null);
    clearPromo();
  }

  function next() { setErr(''); setStep(s => s + 1); }
  function back() { setErr(''); setStep(s => s - 1); }

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    const token = session?.access_token;
    setPromoLoading(true); setPromoErr('');
    try {
      const res = await api.validateDiscount({ code, service_ids: serviceIds }, token);
      if (res.valid) {
        setPromoApplied(res);
        setPromoErr('');
      } else {
        setPromoApplied(null);
        setPromoErr(res.error || 'That code is not valid.');
      }
    } catch (e) {
      setPromoApplied(null);
      setPromoErr(e.message || 'Could not apply that code.');
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setPromoApplied(null);
    setPromoErr('');
    setPromoInput('');
  }

  async function confirmBooking() {
    const token = session?.access_token;

    // Guests must supply valid contact details (the backend 400s without them).
    if (!token) {
      if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
        setErr('Please fill in your name, email, and phone to book as a guest.');
        return;
      }
      if (!isValidEmail(guestEmail.trim())) {
        setErr('Please enter a valid email address.');
        return;
      }
    }

    setLoading(true); setErr('');

    try {
      const result = await api.createAppointment({
        staff_id: selectedStaff?.id || staff[0]?.id,
        service_ids: serviceIds,
        start_time: selectedSlot,
        client_notes: clientNotes,
        ...(promoApplied ? { discount_code: promoApplied.code } : {}),
        ...(token ? {} : {
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
        }),
      }, token);

      setBooking(result.appointment);

      if (result.setup_client_secret) {
        // Card on file is required — go to the card-capture step.
        setSetupClientSecret(result.setup_client_secret);
      } else if (token) {
        // Authed users go to the (auth-gated) confirmation page.
        navigate(`/confirm/${result.appointment.id}`);
      } else {
        // Guests can't fetch /confirm/:id — show the inline confirmation.
        setConfirmed(true);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onCardSaved() {
    if (session?.access_token) {
      navigate(`/confirm/${booking.id}`);
    } else {
      // Guest card saved — surface the inline confirmation.
      setSetupClientSecret(null);
      setConfirmed(true);
    }
  }

  function bookAnother() {
    setStep(0);
    setSelectedServices([]);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
    setClientNotes('');
    setSetupClientSecret(null);
    setBooking(null);
    setConfirmed(false);
    setAgreedPolicy(false);
    setPayInFull(false);
    clearPromo();
    setErr('');
  }

  const staffForService = staff; // backend filters; show all for now

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Progress bar */}
        <div className="book-progress" style={styles.progress}>
          {stepKeys.map((key, i) => (
            <div key={key} style={styles.stepWrap}>
              <div style={{ ...styles.stepDot, ...(i <= step ? styles.stepDotActive : {}) }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="book-step-label" style={{ ...styles.stepLabel, ...(i === step ? styles.stepLabelActive : {}) }}>
                {STEP_LABELS[key]}
              </span>
            </div>
          ))}
        </div>

        <div className="book-card" style={styles.card}>
          {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

          {/* Step: Service */}
          {currentStep === 'service' && (
            <div>
              <h2 style={styles.stepTitle}>Choose Your Services</h2>
              <p style={{ color: '#9A938A', fontSize: 14, marginTop: 2 }}>Select one or more — they'll be booked in a single appointment.</p>
              {serviceGroups.map(group => (
                <div key={group.category || 'all'}>
                  {group.category && <h3 style={styles.categoryHeader}>{group.category}</h3>}
                  <div className="grid-2" style={{ marginTop: group.category ? 12 : 20 }}>
                    {group.items.map(s => (
                      <ServiceCard key={s.id} service={s} selected={selectedServices.some(x => x.id === s.id)}
                        onSelect={toggleService} />
                    ))}
                  </div>
                </div>
              ))}
              {selectedServices.length > 0 && (
                <div style={styles.selSummary}>
                  <span style={styles.selCount}>
                    {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}
                  </span>
                  <span style={styles.selDot}>·</span>
                  <span style={styles.selTotal}>${(totalCents / 100).toFixed(2)}</span>
                  <span style={styles.selDot}>·</span>
                  <span style={styles.selDuration}>~{formatDuration(totalMinutes)}</span>
                </div>
              )}
              <div style={styles.navRow}>
                <span />
                <button
                  onClick={next} disabled={selectedServices.length === 0}
                  style={{ ...styles.nextBtn, opacity: selectedServices.length > 0 ? 1 : 0.4 }}
                >Next →</button>
              </div>
            </div>
          )}

          {/* Step: Stylist (hidden in solo-stylist mode) */}
          {currentStep === 'stylist' && (
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

          {/* Step: Date & Time */}
          {currentStep === 'datetime' && (
            <div>
              <h2 style={styles.stepTitle}>Pick a Date & Time</h2>
              <div className="book-calendar-row" style={styles.calendarRow}>
                <div className="book-calendar-wrap" style={styles.calendarWrap}>
                  <Calendar
                    onChange={d => { setSelectedDate(d); setSelectedSlot(null); }}
                    value={selectedDate}
                    minDate={new Date()}
                    maxDate={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)}
                  />
                </div>
                <div style={styles.slotsWrap}>
                  {!selectedDate ? (
                    <p style={{ color: '#9A938A', fontSize: 14 }}>Select a date to see available times.</p>
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

          {/* Step: Details */}
          {currentStep === 'details' && (
            <div>
              <h2 style={styles.stepTitle}>Your Details</h2>
              {user ? (
                <div style={styles.profileInfo}>
                  <span style={styles.profileAvatar}>{profile?.full_name?.[0] || '?'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 13, color: '#9A938A' }}>{user.email}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert alert-info">
                    Booking as a guest — or{' '}
                    <a href="/login" style={{ color: '#C8A24B' }}>sign in</a> for faster checkout next time.
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
                    <input className="form-input" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required placeholder="+1 (555) 000-0000" />
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
                  disabled={!user && (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !isValidEmail(guestEmail.trim()))}
                  style={{ ...styles.nextBtn, opacity: (!user && (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !isValidEmail(guestEmail.trim()))) ? 0.4 : 1 }}
                >Review →</button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {currentStep === 'confirm' && !setupClientSecret && !confirmed && (
            <div>
              <h2 style={styles.stepTitle}>Review & Confirm</h2>
              <div style={styles.summary}>
                {selectedServices.map(s => (
                  <SummaryRow key={s.id} label={s.name} value={`$${(s.price_cents / 100).toFixed(2)}`} />
                ))}
                <div style={styles.divider} />
                <SummaryRow label="Stylist" value={selectedStaff?.full_name || 'First available'} />
                <SummaryRow label="Date" value={selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''} />
                <SummaryRow label="Time" value={selectedSlot ? format(new Date(selectedSlot), 'h:mm a') : ''} />
                <SummaryRow label="Duration" value={`~${formatDuration(totalMinutes)}`} />
                <div style={styles.divider} />
                {promoApplied ? (
                  <>
                    <SummaryRow label="Subtotal" value={`$${(promoApplied.original_cents / 100).toFixed(2)}`} strike />
                    <SummaryRow label={promoApplied.label || `Promo ${promoApplied.code}`} value={`– $${((promoApplied.original_cents - promoApplied.discounted_cents) / 100).toFixed(2)}`} accent />
                    <SummaryRow label="Total" value={`$${(promoApplied.discounted_cents / 100).toFixed(2)}`} bold />
                  </>
                ) : (
                  <SummaryRow label="Total" value={`$${(totalCents / 100).toFixed(2)}`} bold />
                )}
                <SummaryRow label="Due now" value="$0.00" />
                <SummaryRow label="Due at salon" value={`$${((promoApplied ? promoApplied.discounted_cents : totalCents) / 100).toFixed(2)}`} bold accent />
              </div>

              {/* Card-on-file notice */}
              <div style={styles.cardNotice}>
                <strong style={{ color: '#D8BC7E' }}>A card on file is required to book</strong>
                <p style={{ margin: '6px 0 0', color: '#9A938A', fontSize: 13.5, lineHeight: 1.6 }}>
                  You won't be charged now — you'll pay for your service at the salon. Your card is
                  only kept on file and charged if you no-show or cancel late, per the policy below.
                </p>
              </div>

              {/* Promo code */}
              <div style={styles.promoBox}>
                <label className="form-label">Promo code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Enter code"
                    value={promoInput}
                    disabled={!!promoApplied}
                    onChange={e => setPromoInput(e.target.value)}
                    style={{ flex: 1, textTransform: 'uppercase' }}
                  />
                  {promoApplied ? (
                    <button type="button" onClick={clearPromo} style={styles.backBtn}>Remove</button>
                  ) : (
                    <button type="button" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()} style={styles.applyBtn}>
                      {promoLoading ? 'Applying…' : 'Apply'}
                    </button>
                  )}
                </div>
                {promoApplied && <p style={styles.promoOk}>✓ {promoApplied.label || `Code ${promoApplied.code} applied`}</p>}
                {promoErr && <p style={styles.promoErr}>{promoErr}</p>}
              </div>

              {/* Cancellation policy */}
              <div style={styles.policyBox}>
                <strong style={{ color: '#D8BC7E' }}>Cancellation policy</strong>
                <p style={{ margin: '6px 0 0', color: '#9A938A', fontSize: 13.5, lineHeight: 1.6 }}>{CANCELLATION_POLICY}</p>
              </div>
              <label style={styles.policyCheck}>
                <input type="checkbox" checked={agreedPolicy} onChange={e => setAgreedPolicy(e.target.checked)} style={{ accentColor: '#C8A24B', marginTop: 3 }} />
                <span style={{ fontSize: 14 }}>I understand and agree to the cancellation policy.</span>
              </label>

              <div style={styles.navRow}>
                <button onClick={back} style={styles.backBtn}>← Back</button>
                <button onClick={confirmBooking} disabled={loading || !agreedPolicy} style={{ ...styles.confirmBtn, opacity: (loading || !agreedPolicy) ? 0.4 : 1, cursor: !agreedPolicy ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Booking…' : 'Continue to Add Card'}
                </button>
              </div>
            </div>
          )}

          {/* Guest inline confirmation (guests can't reach /confirm/:id) */}
          {confirmed && booking && (
            <div style={{ textAlign: 'center' }}>
              <div style={styles.confirmIcon}>✓</div>
              <h2 style={{ ...styles.stepTitle, textAlign: 'center', fontSize: 30 }}>You're booked!</h2>
              <p style={{ color: '#9A938A', fontSize: 15, marginBottom: 28 }}>
                A confirmation has been sent to {guestEmail || 'your email'}. We'll see you soon.
              </p>
              <div style={{ ...styles.summary, textAlign: 'left' }}>
                {apptItems(booking).map((it, i) => (
                  <SummaryRow key={it.service_id || i} label={it.name} value={it.price_cents != null ? `$${(it.price_cents / 100).toFixed(2)}` : ''} />
                ))}
                <div style={styles.divider} />
                <SummaryRow label="Stylist" value={booking.staff?.full_name || selectedStaff?.full_name || 'First available'} />
                <SummaryRow label="Date" value={booking.start_time ? format(new Date(booking.start_time), 'EEEE, MMMM d, yyyy') : (selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : '')} />
                <SummaryRow label="Time" value={booking.start_time ? format(new Date(booking.start_time), 'h:mm a') : (selectedSlot ? format(new Date(selectedSlot), 'h:mm a') : '')} />
                <div style={styles.divider} />
                <SummaryRow
                  label="Total"
                  value={`$${((booking.total_cents != null ? booking.total_cents : (promoApplied ? promoApplied.discounted_cents : totalCents)) / 100).toFixed(2)}`}
                  bold
                />
              </div>
              <div style={styles.policyBox}>
                <strong style={{ color: '#D8BC7E' }}>Cancellation policy</strong>
                <p style={{ margin: '6px 0 0', color: '#9A938A', fontSize: 13.5, lineHeight: 1.6 }}>{CANCELLATION_POLICY}</p>
              </div>
              <button onClick={bookAnother} style={{ ...styles.confirmBtn, marginTop: 24, width: '100%' }}>Book another</button>
            </div>
          )}

          {/* Card-on-file step */}
          {setupClientSecret && (
            <div>
              <h2 style={styles.stepTitle}>Save a Card to Confirm</h2>
              <p style={{ color: '#9A938A', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                We don't charge you now — your card is only kept on file to hold your appointment.
                You'll pay for your service at the salon. Per the cancellation policy, no-shows are
                charged 100% and cancellations within 48 hours are charged 50%, to the card on file.
              </p>
              <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                <CardSetupForm
                  clientSecret={setupClientSecret}
                  onSuccess={onCardSaved}
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

function SummaryRow({ label, value, bold, accent, strike }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ color: '#9A938A', fontSize: 14 }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 500,
        color: accent ? '#C8A24B' : strike ? '#9A938A' : '#EDE7DB',
        fontSize: bold ? 16 : 14,
        textDecoration: strike ? 'line-through' : 'none',
      }}>{value}</span>
    </div>
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const styles = {
  page: { background: '#0E0E10', minHeight: 'calc(100vh - 64px)', padding: '40px 16px' },
  container: { maxWidth: 720, margin: '0 auto' },
  progress: { display: 'flex', justifyContent: 'space-between', marginBottom: 32, position: 'relative' },
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 36, height: 36, borderRadius: '50%', border: '2px solid #2A2A2A',
    background: '#16161A', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#9A938A', transition: 'all 0.2s',
  },
  stepDotActive: { background: '#0E0E10', border: '2px solid #0E0E10', color: '#C8A24B' },
  stepLabel: { fontSize: 11, color: '#9A938A', letterSpacing: '0.04em', textAlign: 'center' },
  stepLabelActive: { color: '#EDE7DB', fontWeight: 600 },
  card: { background: '#16161A', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  stepTitle: { fontFamily: "'Cormorant', serif", fontSize: 26, color: '#EDE7DB', marginBottom: 4 },
  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 },
  nextBtn: {
    padding: '12px 32px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
  },
  backBtn: {
    padding: '12px 24px', borderRadius: 999, background: 'transparent',
    border: '1px solid #2A2A2A', color: '#9A938A', fontSize: 14, cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
  },
  confirmBtn: {
    padding: '12px 32px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
  },
  noPreference: {
    background: '#16161A', border: '2px solid #2A2A2A', borderRadius: 12,
    padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', transition: 'all 0.2s', fontSize: 14, color: '#9A938A',
  },
  noPreferenceSelected: {
    border: '2px solid #C8A24B', background: 'rgba(200,162,75,0.1)',
    boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
  },
  calendarRow: { display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' },
  calendarWrap: { flex: '0 0 auto', minWidth: 280 },
  slotsWrap: { flex: 1, minWidth: 220 },
  profileInfo: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: 16, background: '#0E0E10', borderRadius: 10, marginBottom: 16,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: '#0E0E10', color: '#C8A24B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700,
  },
  categoryHeader: {
    fontFamily: "'Cormorant', serif", fontSize: 20, color: '#D8BC7E',
    margin: '28px 0 0', fontWeight: 600, borderBottom: '1px solid #2A2A2A',
    paddingBottom: 8,
  },
  selSummary: {
    marginTop: 20, padding: '14px 18px', background: '#1E1E22', border: '1px solid #2A2A2A',
    borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  selCount: { fontSize: 14, fontWeight: 600, color: '#EDE7DB' },
  selDot: { color: '#9A938A' },
  selTotal: { fontSize: 15, fontWeight: 700, color: '#C8A24B' },
  selDuration: { fontSize: 14, color: '#9A938A' },
  summary: { border: '1px solid #2A2A2A', borderRadius: 10, padding: '8px 20px' },
  divider: { height: 1, background: '#2A2A2A', margin: '8px 0' },
  applyBtn: {
    padding: '0 22px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
  },
  cardNotice: {
    marginTop: 20, background: '#1E1E22', border: '1px solid #2A2A2A',
    borderRadius: 10, padding: '14px 16px',
  },
  promoBox: { marginTop: 20 },
  promoOk: { color: '#9ad9b4', fontSize: 13, marginTop: 8 },
  promoErr: { color: '#f8a3a3', fontSize: 13, marginTop: 8 },
  policyBox: {
    marginTop: 20, background: '#1E1E22', border: '1px solid #2A2A2A',
    borderRadius: 10, padding: '14px 16px',
  },
  policyCheck: {
    display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16,
    cursor: 'pointer', color: '#EDE7DB',
  },
  confirmIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#0E0E10', color: '#C8A24B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 30, fontWeight: 700, margin: '0 auto 20px',
  },
};
