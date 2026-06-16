import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, addDays, isSameDay } from 'date-fns';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { apptItems, apptServiceNames } from '../utils';

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'];

export default function Dashboard() {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // No-show / late-cancel fee charging (admin, inside the appointment modal)
  const [feeType, setFeeType] = useState('no_show');
  const [feeBusy, setFeeBusy] = useState(false);
  const [feeResult, setFeeResult] = useState(null); // { ok, message }

  // Discount application (admin, inside the appointment modal). Holly's codes,
  // incl. eligibility-gated "salon only" ones, applied to an appointment at
  // checkout — the customer never enters these.
  const [discounts, setDiscounts] = useState([]);
  const [applyCode, setApplyCode] = useState('');
  const [discBusy, setDiscBusy] = useState(false);
  const [discResult, setDiscResult] = useState(null); // { ok, message }

  // New-appointment modal (book on behalf of a client)
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [naClients, setNaClients] = useState([]);
  const [naServices, setNaServices] = useState([]);
  const [naStaff, setNaStaff] = useState([]);
  const [naForm, setNaForm] = useState({ client_id: '', staff_id: '', service_ids: [], date: '', slot: '' });
  const [naSlots, setNaSlots] = useState([]);
  const [naSlotsLoading, setNaSlotsLoading] = useState(false);
  const [naSaving, setNaSaving] = useState(false);
  const [naErr, setNaErr] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff' || isAdmin;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!isStaff) { navigate('/profile'); return; }
  }, [user, profile]);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    const params = { date: format(selectedDate, 'yyyy-MM-dd') };
    if (!isAdmin) params.staff_id = user.id;
    api.getAppointments(session.access_token, params)
      .then(data => setAppointments(data.appointments || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDate, session]);

  useEffect(() => {
    if (!session?.access_token) return;
    api.getDashboard(session.access_token).then(setStats).catch(() => {});
  }, [session]);

  // Load Holly's discount codes once (admin only) to populate the apply-discount
  // picker in the appointment modal.
  useEffect(() => {
    if (!session?.access_token || !isAdmin) return;
    api.getDiscounts(session.access_token)
      .then(d => setDiscounts(d.discounts || d || []))
      .catch(() => {});
  }, [session, isAdmin]);

  async function openNewAppt() {
    const token = session?.access_token;
    setNaErr('');
    setNaForm({ client_id: '', staff_id: user.id, service_ids: [], date: '', slot: '' });
    setNaSlots([]);
    setNewApptOpen(true);
    try {
      const [cl, svcs, stf] = await Promise.all([
        api.getClients(token).catch(() => ({ clients: [] })),
        api.getServices(),
        api.getStaff(),
      ]);
      setNaClients(cl.clients || []);
      setNaServices(svcs);
      setNaStaff(stf);
      // Default the stylist sensibly: the signed-in user if they're bookable,
      // otherwise the first staff member.
      const self = stf.find(s => s.id === user.id);
      setNaForm(f => ({ ...f, staff_id: (self || stf[0])?.id || '' }));
    } catch (e) {
      setNaErr(e.message || 'Could not load booking data.');
    }
  }

  // Fetch slots whenever staff + services + date are all chosen.
  useEffect(() => {
    if (!newApptOpen || !naForm.staff_id || naForm.service_ids.length === 0 || !naForm.date) {
      setNaSlots([]);
      return;
    }
    setNaSlotsLoading(true);
    api.getAvailability({ staff_id: naForm.staff_id, service_ids: naForm.service_ids.join(','), date: naForm.date })
      .then(data => setNaSlots(Array.isArray(data) ? data : (data.slots || [])))
      .catch(() => setNaSlots([]))
      .finally(() => setNaSlotsLoading(false));
  }, [newApptOpen, naForm.staff_id, naForm.service_ids, naForm.date]);

  function naToggleService(id) {
    setNaForm(f => ({
      ...f,
      slot: '',
      service_ids: f.service_ids.includes(id) ? f.service_ids.filter(x => x !== id) : [...f.service_ids, id],
    }));
  }

  async function saveNewAppt() {
    const token = session?.access_token;
    if (!naForm.client_id || !naForm.staff_id || naForm.service_ids.length === 0 || !naForm.slot) {
      setNaErr('Please choose a client, at least one service, and a time.');
      return;
    }
    setNaSaving(true);
    setNaErr('');
    try {
      const result = await api.createAppointment({
        client_id: naForm.client_id,
        staff_id: naForm.staff_id,
        service_ids: naForm.service_ids,
        start_time: naForm.slot,
      }, token);
      setNewApptOpen(false);
      // Jump the calendar to the new appointment's day so it's visible.
      const apptDay = new Date(result.appointment.start_time);
      setSelectedDate(apptDay);
      const params = { date: format(apptDay, 'yyyy-MM-dd') };
      if (!isAdmin) params.staff_id = user.id;
      const data = await api.getAppointments(token, params);
      setAppointments(data.appointments || data || []);
    } catch (e) {
      setNaErr(e.message || 'Could not create the appointment.');
    } finally {
      setNaSaving(false);
    }
  }

  const naTotal = naServices
    .filter(s => naForm.service_ids.includes(s.id))
    .reduce((sum, s) => sum + (s.price_cents || 0), 0);

  async function updateStatus(id, status) {
    setUpdatingStatus(true);
    const updated = await api.updateAppointment(id, { status }, session.access_token);
    setAppointments(a => a.map(x => x.id === id ? { ...x, ...updated } : x));
    setSelectedAppt(s => s ? { ...s, ...updated } : s);
    setUpdatingStatus(false);
  }

  function openAppt(appt) {
    setSelectedAppt(appt);
    setFeeResult(null);
    setFeeType('no_show');
    setDiscResult(null);
    setApplyCode(appt.discount_code || '');
    setModalOpen(true);
  }

  async function applyDiscount(code) {
    if (!selectedAppt) return;
    setDiscBusy(true);
    setDiscResult(null);
    try {
      const res = await api.applyAppointmentDiscount(selectedAppt.id, code || null, session.access_token);
      setAppointments(a => a.map(x => x.id === selectedAppt.id ? { ...x, ...res.appointment } : x));
      setSelectedAppt(s => s ? { ...s, ...res.appointment } : s);
      setApplyCode(res.discount_code || '');
      setDiscResult({
        ok: true,
        message: res.discount_code
          ? `Applied ${res.discount_code} (${res.label}). New total $${(res.total_cents / 100).toFixed(2)}.`
          : `Discount removed. Total $${(res.total_cents / 100).toFixed(2)}.`,
      });
    } catch (e) {
      setDiscResult({ ok: false, message: e.message || 'Could not apply discount.' });
    } finally {
      setDiscBusy(false);
    }
  }

  async function chargeFee() {
    if (!selectedAppt) return;
    setFeeBusy(true);
    setFeeResult(null);
    try {
      const res = await api.chargeFee(selectedAppt.id, { fee_type: feeType }, session.access_token);
      if (res.charged) {
        setFeeResult({ ok: true, message: `Charged $${(res.amount_cents / 100).toFixed(2)} to the card on file.` });
        setAppointments(a => a.map(x => x.id === selectedAppt.id ? { ...x, ...res.appointment } : x));
        setSelectedAppt(s => s ? { ...s, ...res.appointment } : s);
      } else {
        setFeeResult({ ok: true, message: res.message || 'Nothing to charge.' });
      }
    } catch (e) {
      setFeeResult({ ok: false, message: e.message || 'Could not charge the fee.' });
    } finally {
      setFeeBusy(false);
    }
  }

  const dayAppts = appointments
    .filter(a => isSameDay(new Date(a.start_time), selectedDate))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div style={styles.page}>
      {/* Stats bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div className="container dash-stats-inner" style={styles.statsInner}>
            <StatPill label="Today" value={stats.today_count} />
            <StatPill label="Upcoming" value={stats.upcoming_count} />
            <StatPill label="Clients" value={stats.client_count} />
            <StatPill label="Collected (month)" value={`$${((stats.revenue_this_month_cents || 0) / 100).toFixed(0)}`} />
          </div>
        </div>
      )}

      <div className="container dash-layout" style={styles.layout}>
        {/* Sidebar */}
        <div className="dash-sidebar" style={styles.sidebar}>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            minDate={addDays(new Date(), -90)}
            maxDate={addDays(new Date(), 90)}
          />
          <div style={styles.legend}>
            {STATUS_OPTIONS.map(s => (
              <div key={s} style={styles.legendItem}>
                <span style={{ ...styles.dot, background: STATUS_COLORS[s] }} />
                <span style={{ fontSize: 12, color: '#9A938A', textTransform: 'capitalize' }}>{s.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main calendar */}
        <div style={styles.main}>
          <div style={styles.dayHeader}>
            <h2 style={styles.dayTitle}>{format(selectedDate, 'EEEE, MMMM d')}</h2>
            <span style={styles.dayCount}>{dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}</span>
            {isAdmin && (
              <button onClick={openNewAppt} style={styles.newApptBtn}>+ New Appointment</button>
            )}
          </div>

          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : dayAppts.length === 0 ? (
            <div style={styles.empty}>
              <p style={{ color: '#9A938A' }}>No appointments scheduled for this day.</p>
            </div>
          ) : (
            <div style={styles.timeline}>
              {dayAppts.map(a => (
                <div
                  key={a.id}
                  onClick={() => openAppt(a)}
                  style={{ ...styles.apptBlock, borderLeft: `4px solid ${STATUS_COLORS[a.status] || '#ccc'}` }}
                >
                  <div style={styles.apptTime}>
                    {format(new Date(a.start_time), 'h:mm a')}
                    <span style={{ color: '#9A938A' }}> → {format(new Date(a.end_time), 'h:mm a')}</span>
                  </div>
                  <div style={styles.apptService}>{apptServiceNames(a)}</div>
                  <div style={styles.apptClient}>{a.client?.full_name || 'Client'}</div>
                  {isAdmin && a.staff && (
                    <div style={{ fontSize: 12, color: '#9A938A', marginTop: 2 }}>with {a.staff.full_name}</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New appointment modal */}
      <Modal open={newApptOpen} onClose={() => setNewApptOpen(false)} title="New Appointment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {naErr && <div className="alert alert-error">{naErr}</div>}

          <div className="form-group">
            <label className="form-label">Client</label>
            <select className="form-select" value={naForm.client_id}
              onChange={e => setNaForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— Choose a client —</option>
              {naClients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name || '(no name)'}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: '#9A938A', marginTop: 4 }}>
              Client not listed? Add them first in Admin → Clients.
            </p>
          </div>

          {naStaff.length > 1 && (
            <div className="form-group">
              <label className="form-label">Stylist</label>
              <select className="form-select" value={naForm.staff_id}
                onChange={e => setNaForm(f => ({ ...f, staff_id: e.target.value, slot: '' }))}>
                {naStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Services</label>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #2A2A2A', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {naServices.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={naForm.service_ids.includes(s.id)}
                    onChange={() => naToggleService(s.id)} style={{ accentColor: '#C8A24B' }} />
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span style={{ color: '#9A938A', fontSize: 13 }}>${(s.price_cents / 100).toFixed(2)}</span>
                </label>
              ))}
            </div>
            {naForm.service_ids.length > 0 && (
              <p style={{ fontSize: 13, color: '#C8A24B', marginTop: 6 }}>
                {naForm.service_ids.length} selected · ${(naTotal / 100).toFixed(2)}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={naForm.date}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setNaForm(f => ({ ...f, date: e.target.value, slot: '' }))} />
          </div>

          {naForm.date && naForm.service_ids.length > 0 && (
            <div className="form-group">
              <label className="form-label">Time</label>
              {naSlotsLoading ? (
                <div className="loading-center"><div className="spinner" /></div>
              ) : naSlots.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9A938A' }}>No open times that day — try another date.</p>
              ) : (
                <select className="form-select" value={naForm.slot}
                  onChange={e => setNaForm(f => ({ ...f, slot: e.target.value }))}>
                  <option value="">— Choose a time —</option>
                  {naSlots.map(slot => (
                    <option key={slot} value={slot}>{format(new Date(slot), 'h:mm a')}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <p style={{ fontSize: 12, color: '#9A938A', lineHeight: 1.5 }}>
            Booked appointments are confirmed immediately (no online deposit) — payment is settled at the salon.
            The client gets a confirmation email.
          </p>

          <button onClick={saveNewAppt} disabled={naSaving} style={styles.confirmNewBtn}>
            {naSaving ? 'Booking…' : 'Book Appointment'}
          </button>
        </div>
      </Modal>

      {/* Appointment modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Appointment Details">
        {selectedAppt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="Client" value={selectedAppt.client?.full_name || '—'} />
            <Row label={apptItems(selectedAppt).length > 1 ? 'Services' : 'Service'} value={apptServiceNames(selectedAppt)} />
            {isAdmin && <Row label="Stylist" value={selectedAppt.staff?.full_name || '—'} />}
            <Row label="Date & Time" value={`${format(new Date(selectedAppt.start_time), 'MMMM d')} • ${format(new Date(selectedAppt.start_time), 'h:mm a')} – ${format(new Date(selectedAppt.end_time), 'h:mm a')}`} />
            <Row label="Total" value={`$${(selectedAppt.total_cents / 100).toFixed(2)}`} />
            {selectedAppt.deposit_cents > 0 && <Row label="Deposit paid" value={`$${(selectedAppt.deposit_cents / 100).toFixed(2)}`} />}
            {selectedAppt.client_notes && <Row label="Notes" value={selectedAppt.client_notes} />}
            <div className="divider" />
            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Update Status</label>
              <select
                className="form-select"
                value={selectedAppt.status}
                onChange={e => updateStatus(selectedAppt.id, e.target.value)}
                disabled={updatingStatus}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>

            {/* Apply a discount — lowers the appointment total at checkout.
                Eligibility-gated "salon only" codes can only be applied here. */}
            {isAdmin && (
              <>
                <div className="divider" />
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Apply a discount</label>
                  {selectedAppt.discount_code && (
                    <p style={{ fontSize: 13, color: '#10B981', marginBottom: 8 }}>
                      {selectedAppt.discount_code} applied.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-select" value={applyCode} onChange={e => setApplyCode(e.target.value)} disabled={discBusy} style={{ flex: 1 }}>
                      <option value="">— No discount —</option>
                      {discounts.filter(d => d.active !== false).map(d => (
                        <option key={d.id} value={d.code}>
                          {d.code} ({d.type === 'percent' ? `${d.value}% off` : `$${(d.value / 100).toFixed(2)} off`}){d.admin_only ? ' • salon only' : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => applyDiscount(applyCode)} disabled={discBusy} style={styles.chargeFeeBtn}>
                      {discBusy ? 'Saving…' : 'Apply'}
                    </button>
                  </div>
                  {discResult && (
                    <p style={{ fontSize: 13, marginTop: 8, color: discResult.ok ? '#10B981' : '#EF4444' }}>
                      {discResult.message}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: '#9A938A', marginTop: 8, lineHeight: 1.5 }}>
                    Updates the appointment total. Pick “No discount” and Apply to remove it. Then take payment on your POS for the new total.
                  </p>
                </div>
              </>
            )}

            {/* No-show / late-cancel fee — charges the client's saved card */}
            {isAdmin && selectedAppt.client?.id && (
              <>
                <div className="divider" />
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Charge a fee</label>
                  {selectedAppt.fee_charged_cents > 0 && (
                    <p style={{ fontSize: 13, color: '#10B981', marginBottom: 8 }}>
                      ${(selectedAppt.fee_charged_cents / 100).toFixed(2)} fee already charged.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-select" value={feeType} onChange={e => setFeeType(e.target.value)} disabled={feeBusy} style={{ flex: 1 }}>
                      <option value="no_show">No-show (100%)</option>
                      <option value="late_cancel">Late cancel (50%)</option>
                    </select>
                    <button onClick={chargeFee} disabled={feeBusy} style={styles.chargeFeeBtn}>
                      {feeBusy ? 'Charging…' : 'Charge card'}
                    </button>
                  </div>
                  {feeResult && (
                    <p style={{ fontSize: 13, marginTop: 8, color: feeResult.ok ? '#10B981' : '#EF4444' }}>
                      {feeResult.message}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: '#9A938A', marginTop: 8, lineHeight: 1.5 }}>
                    Charges the card on file (minus anything already paid). Requires a saved card — add one from the Clients tab.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9A938A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#EDE7DB' }}>{value}</div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={styles.statPill}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const STATUS_COLORS = {
  pending: '#F59E0B',
  confirmed: '#10B981',
  completed: '#3B82F6',
  no_show: '#EF4444',
  cancelled: '#9CA3AF',
};

const styles = {
  page: { background: '#0E0E10', minHeight: 'calc(100vh - 64px)', paddingBottom: 60 },
  statsBar: { background: '#0E0E10', borderBottom: '1px solid #2A2A2A', padding: '16px 0' },
  statsInner: { display: 'flex', gap: 40, justifyContent: 'center' },
  statPill: { textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 700, color: '#C8A24B', fontFamily: "'Cormorant', serif" },
  statLabel: { fontSize: 12, color: '#9A938A', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 },
  layout: { display: 'flex', gap: 32, marginTop: 32, alignItems: 'flex-start' },
  sidebar: { flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 16 },
  legend: { background: '#16161A', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  main: { flex: 1 },
  dayHeader: { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  newApptBtn: {
    marginLeft: 'auto', padding: '9px 22px', borderRadius: 999, background: '#C8A24B',
    color: '#0E0E10', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
  },
  confirmNewBtn: {
    padding: '12px 32px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
  },
  chargeFeeBtn: {
    padding: '0 20px', borderRadius: 8, background: '#0E0E10', color: '#C8A24B',
    border: '1px solid #2A2A2A', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap', fontFamily: "'Jost', sans-serif",
  },
  dayTitle: { fontFamily: "'Cormorant', serif", fontSize: 24, color: '#EDE7DB' },
  dayCount: { fontSize: 13, color: '#9A938A' },
  empty: { textAlign: 'center', padding: '60px 0' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 12 },
  apptBlock: {
    background: '#16161A', borderRadius: 10, padding: '16px 20px',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'box-shadow 0.2s',
  },
  apptTime: { fontSize: 13, color: '#9A938A', marginBottom: 4 },
  apptService: { fontFamily: "'Cormorant', serif", fontSize: 17, color: '#EDE7DB', fontWeight: 600 },
  apptClient: { fontSize: 14, color: '#9A938A', marginTop: 2 },
};
