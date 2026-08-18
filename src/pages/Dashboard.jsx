import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, addDays, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import CardSetupForm from '../components/CardSetupForm';
import { apptItems, apptServiceNames } from '../utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'];

export default function Dashboard() {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  // Which month the little calendar is showing, and a per-day summary for it so
  // each tile can wear a dot when there's something booked that day.
  const [activeMonth, setActiveMonth] = useState(startOfMonth(new Date()));
  const [monthDays, setMonthDays] = useState({}); // 'yyyy-MM-dd' -> { count, statuses: [] }
  const [monthRefresh, setMonthRefresh] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // No-show / late-cancel fee charging (admin, inside the appointment modal)
  const [feeType, setFeeType] = useState('no_show');
  const [feeBusy, setFeeBusy] = useState(false);
  const [feeResult, setFeeResult] = useState(null); // { ok, message }
  // Card on file for the open appointment. `apptId` stamps which appointment the
  // card belongs to so a slow response can never be painted against a different
  // appointment: { apptId, status: 'loading' | 'loaded', card }
  const [cardState, setCardState] = useState({ apptId: null, status: 'loading', card: null });

  // Discount application (admin, inside the appointment modal). Holly's codes,
  // incl. eligibility-gated "salon only" ones, applied to an appointment at
  // checkout — the customer never enters these.
  const [discounts, setDiscounts] = useState([]);
  const [applyCode, setApplyCode] = useState('');
  const [discBusy, setDiscBusy] = useState(false);
  const [discResult, setDiscResult] = useState(null); // { ok, message }
  const [linkCopied, setLinkCopied] = useState(false);

  // Record an in-person (cash/check/other) payment into the ledger.
  const [recAmount, setRecAmount] = useState('');
  const [recMethod, setRecMethod] = useState('cash');
  const [recNote, setRecNote] = useState('');
  const [recBusy, setRecBusy] = useState(false);
  const [recResult, setRecResult] = useState(null); // { ok, message }

  // Reschedule (admin/staff, inside the appointment modal): pick a new date,
  // load that day's open slots for the same stylist + services, pick one.
  const [rsOpen, setRsOpen] = useState(false);
  const [rsDate, setRsDate] = useState('');
  const [rsSlots, setRsSlots] = useState([]);
  const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
  const [rsSlot, setRsSlot] = useState('');
  const [rsBusy, setRsBusy] = useState(false);
  const [rsResult, setRsResult] = useState(null); // { ok, message }

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

  // Card-on-file step for an admin-created booking. When "require a card on
  // file" is on and the client has no usable card, createAppointment comes back
  // with a setup_client_secret and a *pending* appointment — the booking already
  // exists, this step only decides whether a card gets attached to it.
  // { apptId, clientSecret, clientName }
  const [naCardStep, setNaCardStep] = useState(null);
  const [naCardErr, setNaCardErr] = useState('');
  const [naCardBusy, setNaCardBusy] = useState(false);
  // Outcome banner shown above the day's timeline: { ok, message }
  const [naCardResult, setNaCardResult] = useState(null);
  // A saved card only *confirms* the appointment once Stripe's webhook lands,
  // which is a beat after the browser-side confirmation returns. One delayed
  // re-refresh lets the Pending badge catch up on its own — no polling loop.
  const confirmRefreshTimer = useRef(null);

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

  // Never leave a pending refresh running after this screen is gone, or after
  // she's moved to another day — a late reply for the old day would otherwise
  // overwrite the timeline she's looking at now.
  useEffect(() => () => {
    if (confirmRefreshTimer.current) {
      clearTimeout(confirmRefreshTimer.current);
      confirmRefreshTimer.current = null;
    }
  }, [selectedDate]);

  // Load a whole month at a time (padded by a week each side so the greyed-out
  // neighbouring-month tiles get dots too) and bucket it by local calendar day.
  // Cancelled appointments don't earn a dot — that day really is free.
  useEffect(() => {
    if (!session?.access_token) return;
    const params = {
      from: addDays(startOfMonth(activeMonth), -7).toISOString(),
      to: addDays(endOfMonth(activeMonth), 7).toISOString(),
    };
    if (!isAdmin) params.staff_id = user.id;
    let cancelled = false;
    api.getAppointments(session.access_token, params)
      .then(data => {
        if (cancelled) return;
        const list = data.appointments || data || [];
        const byDay = {};
        for (const a of list) {
          if (a.status === 'cancelled') continue;
          const key = format(new Date(a.start_time), 'yyyy-MM-dd');
          if (!byDay[key]) byDay[key] = { count: 0, statuses: [] };
          byDay[key].count += 1;
          if (!byDay[key].statuses.includes(a.status)) byDay[key].statuses.push(a.status);
        }
        setMonthDays(byDay);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeMonth, session, monthRefresh]);

  // Dots under each calendar tile: one per distinct status that day (capped at
  // three), tinted to match the legend below the calendar. Hover shows the count.
  function tileContent({ date, view }) {
    if (view !== 'month') return null;
    const day = monthDays[format(date, 'yyyy-MM-dd')];
    if (!day) return null;
    const dots = day.statuses.slice(0, 3);
    return (
      <div className="dash-cal-dots" title={`${day.count} appointment${day.count !== 1 ? 's' : ''}`}>
        {dots.map(s => (
          <span key={s} className="dash-cal-dot" style={{ background: STATUS_COLORS[s] || '#C8A24B' }} />
        ))}
      </div>
    );
  }

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

  // Re-pull a day's appointments. Every exit from the booking flow (including
  // every exit from the card step) goes through this, so a booking that exists
  // is always visible on the timeline — she never has to guess whether it saved.
  async function refreshDay(day = selectedDate) {
    const token = session?.access_token;
    const params = { date: format(day, 'yyyy-MM-dd') };
    if (!isAdmin) params.staff_id = user.id;
    try {
      const data = await api.getAppointments(token, params);
      setAppointments(data.appointments || data || []);
    } catch {
      // A failed refresh must never strand the UI — the timeline just stays as-is.
    }
    setMonthRefresh(n => n + 1);
  }

  async function saveNewAppt() {
    const token = session?.access_token;
    if (!naForm.client_id || !naForm.staff_id || naForm.service_ids.length === 0 || !naForm.slot) {
      setNaErr('Please choose a client, at least one service, and a time.');
      return;
    }
    setNaSaving(true);
    setNaErr('');
    setNaCardResult(null);
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
      await refreshDay(apptDay);
      // The booking now exists either way. If the backend wants a card on file
      // for it, continue into the card step instead of finishing here.
      if (result.setup_client_secret) {
        setNaCardErr('');
        setNaCardStep({
          apptId: result.appointment.id,
          clientSecret: result.setup_client_secret,
          clientName: naClients.find(c => c.id === naForm.client_id)?.full_name || '',
        });
      }
    } catch (e) {
      setNaErr(e.message || 'Could not create the appointment.');
    } finally {
      setNaSaving(false);
    }
  }

  // Card saved on the pending booking. The appointment is NOT confirmed yet —
  // Stripe's webhook flips it a moment later — so say "confirming now…" and
  // re-refresh once so the badge updates itself instead of looking stuck.
  async function onNewApptCardSaved() {
    const step = naCardStep;
    const day = selectedDate;
    setNaCardStep(null);
    setNaCardErr('');
    setNaCardResult({
      ok: true,
      message: `Card saved${step?.clientName ? ` for ${step.clientName}` : ''} — confirming now…`,
    });
    await refreshDay(day);
    scheduleConfirmRefresh(day);
  }

  // One delayed re-refresh (not a poll) to catch the webhook's status flip.
  function scheduleConfirmRefresh(day) {
    if (confirmRefreshTimer.current) clearTimeout(confirmRefreshTimer.current);
    confirmRefreshTimer.current = setTimeout(() => {
      confirmRefreshTimer.current = null;
      refreshDay(day);
    }, 4000);
  }

  // Deliberately skip the card. The appointment ALREADY exists and is pending —
  // this only flips its status, it must never create a second booking.
  async function confirmNewApptWithoutCard() {
    if (!naCardStep) return;
    setNaCardBusy(true);
    setNaCardErr('');
    try {
      // Dedicated endpoint rather than a plain status update: it also cancels
      // the pending card request, so this reads as "booked without a card" and
      // not as a client who abandoned the card step.
      await api.skipAppointmentCard(naCardStep.apptId, session.access_token);
      setNaCardStep(null);
      // Deliberately not "no card on file": an account holder may still have a
      // card saved from an earlier visit, which this booking simply didn't
      // re-take. Claiming otherwise would contradict the appointment's own card
      // line, which shows whatever is genuinely there.
      setNaCardResult({ ok: true, message: 'Booked without taking a card — the appointment is confirmed.' });
      await refreshDay();
    } catch (e) {
      // 409 = the client's card landed while this step was open, so there is
      // nothing left to skip and the appointment is already handled. That's the
      // best outcome, not a failure — showing it in red (and leaving the card
      // form open) would invite her to read the card in a second time, and every
      // retry would 409 again forever.
      if (e.status === 409) {
        const step = naCardStep;
        const day = selectedDate;
        setNaCardStep(null);
        setNaCardErr('');
        setNaCardResult({
          ok: true,
          message: `Card saved${step?.clientName ? ` for ${step.clientName}` : ''} — the appointment is confirmed.`,
        });
        await refreshDay(day);
      } else {
        setNaCardErr(e.message || 'Could not confirm the appointment. Try again, or close this and set the status from the appointment itself.');
      }
    } finally {
      setNaCardBusy(false);
    }
  }

  // Dismissing the step leaves the booking pending — that's allowed, but say so
  // out loud so she doesn't think it failed and book it a second time.
  async function dismissNewApptCardStep() {
    if (naCardBusy) return;
    const ok = window.confirm(
      'Close without taking a card?\n\nThe appointment is already booked and will stay Pending. You can open it on the calendar to confirm it, or add a card later from Admin → Clients.',
    );
    if (!ok) return;
    setNaCardStep(null);
    setNaCardErr('');
    setNaCardResult({ ok: true, message: 'Appointment booked — still pending, no card on file yet.' });
    await refreshDay();
  }

  const naTotal = naServices
    .filter(s => naForm.service_ids.includes(s.id))
    .reduce((sum, s) => sum + (s.price_cents || 0), 0);

  async function updateStatus(id, status) {
    setUpdatingStatus(true);
    const updated = await api.updateAppointment(id, { status }, session.access_token);
    setAppointments(a => a.map(x => x.id === id ? { ...x, ...updated } : x));
    setSelectedAppt(s => s ? { ...s, ...updated } : s);
    setMonthRefresh(n => n + 1);
    setUpdatingStatus(false);
  }

  // Load open slots when a reschedule date is picked.
  useEffect(() => {
    if (!rsOpen || !rsDate || !selectedAppt) return;
    const staffId = selectedAppt.staff?.id || selectedAppt.staff_id;
    const serviceIds = apptItems(selectedAppt).map(i => i.service_id).filter(Boolean);
    if (!staffId || serviceIds.length === 0) return;
    setRsSlotsLoading(true);
    setRsSlot('');
    api.getAvailability({ staff_id: staffId, service_ids: serviceIds.join(','), date: rsDate })
      .then(data => setRsSlots(Array.isArray(data) ? data : (data.slots || [])))
      .catch(() => setRsSlots([]))
      .finally(() => setRsSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsOpen, rsDate]);

  async function submitReschedule() {
    if (!selectedAppt || !rsSlot) return;
    setRsBusy(true);
    setRsResult(null);
    try {
      const res = await api.rescheduleAppointment(selectedAppt.id, { start_time: rsSlot }, session.access_token);
      setAppointments(a => a.map(x => x.id === selectedAppt.id ? { ...x, ...res.appointment } : x));
      setSelectedAppt(s => s ? { ...s, ...res.appointment } : s);
      setRsResult({ ok: true, message: 'Rescheduled — the client keeps their booking, reminders follow the new time.' });
      setRsOpen(false);
      setRsDate('');
      setRsSlots([]);
      // Jump the calendar to the new day so the moved appointment is visible.
      setSelectedDate(new Date(res.appointment.start_time));
      setMonthRefresh(n => n + 1);
    } catch (e) {
      setRsResult({ ok: false, message: e.message || 'Could not reschedule — that time may have just been taken.' });
    } finally {
      setRsBusy(false);
    }
  }

  function openAppt(appt) {
    setSelectedAppt(appt);
    setRsOpen(false);
    setRsDate('');
    setRsSlots([]);
    setRsSlot('');
    setRsResult(null);
    setFeeResult(null);
    setFeeType('no_show');
    // Always reset to "unknown/loading" for THIS appointment first, so the
    // previous appointment's card is never shown here.
    setCardState({ apptId: appt.id, status: 'loading', card: null, reason: null });
    if (isAdmin && session?.access_token) {
      api.getAppointmentCard(appt.id, session.access_token)
        // Ignore a response that lands after another appointment was opened.
        .then(res => setCardState(s => (s.apptId === appt.id
          ? { apptId: appt.id, status: 'loaded', card: res?.card || null, reason: res?.reason || null }
          : s)))
        // A failed lookup is treated as "no card" — never break the modal.
        .catch(() => setCardState(s => (s.apptId === appt.id ? { apptId: appt.id, status: 'loaded', card: null, reason: null } : s)));
    } else {
      setCardState({ apptId: appt.id, status: 'loaded', card: null, reason: null });
    }
    setDiscResult(null);
    setApplyCode(appt.discount_code || '');
    setLinkCopied(false);
    setRecAmount('');
    setRecMethod('cash');
    setRecNote('');
    setRecResult(null);
    setModalOpen(true);
  }

  async function recordCashPayment() {
    if (!selectedAppt) return;
    const dollars = Number(recAmount);
    if (!dollars || dollars <= 0) { setRecResult({ ok: false, message: 'Enter an amount greater than zero.' }); return; }
    setRecBusy(true);
    setRecResult(null);
    try {
      const res = await api.recordPayment(
        selectedAppt.id,
        { amount_cents: Math.round(dollars * 100), method: recMethod, note: recNote || null },
        session.access_token,
      );
      setAppointments(a => a.map(x => x.id === selectedAppt.id ? { ...x, ...res.appointment } : x));
      setSelectedAppt(s => s ? { ...s, ...res.appointment } : s);
      setRecAmount('');
      setRecNote('');
      setRecResult({ ok: true, message: `Recorded $${dollars.toFixed(2)} (${recMethod}).` });
    } catch (e) {
      setRecResult({ ok: false, message: e.message || 'Could not record payment.' });
    } finally {
      setRecBusy(false);
    }
  }

  async function copyPayLink() {
    if (!selectedAppt) return;
    const url = `${window.location.origin}/pay/${selectedAppt.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fall back to prompt.
      window.prompt('Copy this payment link:', url);
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
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

  // Only trust the card lookup if it belongs to the appointment currently open.
  const apptCardLoaded = !!selectedAppt && cardState.apptId === selectedAppt.id && cardState.status === 'loaded';
  const apptCard = apptCardLoaded ? cardState.card : null;

  // "No card on file" has innocent causes and one worth chasing — say which,
  // so nobody has to reason it out from the appointment's history.
  const NO_CARD_REASONS = {
    never_requested: 'No card on file — none was taken at booking',
    not_completed: "No card on file — the client didn't finish the card step",
    removed: 'No card on file — the saved card has since been removed',
  };
  const noCardText = NO_CARD_REASONS[apptCardLoaded ? cardState.reason : null] || 'No card on file';

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
          <div className="dash-calendar">
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              minDate={addDays(new Date(), -90)}
              maxDate={addDays(new Date(), 90)}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) setActiveMonth(startOfMonth(activeStartDate));
              }}
              tileContent={tileContent}
            />
          </div>
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

          {naCardResult && (
            <p style={{ fontSize: 13, marginBottom: 12, color: naCardResult.ok ? '#10B981' : '#EF4444' }}>
              {naCardResult.message}
            </p>
          )}

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

      {/* Card-on-file step — continuation of the booking above. The appointment
          already exists and is pending; nothing here creates another one. */}
      <Modal open={!!naCardStep} onClose={dismissNewApptCardStep} title="Card on file">
        {naCardStep && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: '#EDE7DB', lineHeight: 1.6 }}>
              {naCardStep.clientName ? `${naCardStep.clientName} is booked` : 'The appointment is booked'} — it just needs a card
              on file before it's confirmed. If they're on the phone, read their card details in below.
            </p>

            <Elements stripe={stripePromise} options={{ clientSecret: naCardStep.clientSecret }}>
              <CardSetupForm
                clientSecret={naCardStep.clientSecret}
                onSuccess={onNewApptCardSaved}
                onError={msg => setNaCardErr(msg || 'That card was declined. Try another card, or book without one.')}
              />
            </Elements>

            {naCardErr && (
              <p style={{ fontSize: 13, color: '#EF4444', lineHeight: 1.5 }}>
                {naCardErr} The appointment is still booked — you can try again above or book without a card.
              </p>
            )}

            <div className="divider" />

            <button
              onClick={confirmNewApptWithoutCard}
              disabled={naCardBusy}
              style={{ ...styles.chargeFeeBtn, width: '100%', padding: '10px 20px', color: '#9A938A', opacity: naCardBusy ? 0.5 : 1 }}
            >
              {naCardBusy ? 'Confirming…' : 'Book without a card'}
            </button>
            <p style={{ fontSize: 12, color: '#9A938A', marginTop: -6, lineHeight: 1.5 }}>
              Confirms this appointment as it stands, with no card on file — no-show fees can't be charged for it.
              Card details go straight to Stripe; they're never stored on our server.
            </p>
          </div>
        )}
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

            {/* Reschedule — same stylist and services, new day/time. */}
            {!['cancelled', 'completed', 'no_show'].includes(selectedAppt.status) && (
              <>
                <div className="divider" />
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Reschedule</label>
                  {rsResult && (
                    <p style={{ fontSize: 13, color: rsResult.ok ? '#10B981' : '#EF4444', marginBottom: 8 }}>
                      {rsResult.message}
                    </p>
                  )}
                  {!rsOpen ? (
                    <button onClick={() => { setRsOpen(true); setRsResult(null); }} style={{ ...styles.chargeFeeBtn, width: '100%', padding: '10px 20px' }}>
                      Move to a different time…
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input
                        type="date"
                        className="form-input"
                        value={rsDate}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        onChange={e => setRsDate(e.target.value)}
                      />
                      {rsDate && (
                        rsSlotsLoading ? (
                          <p style={{ fontSize: 13, color: '#9A938A', margin: 0 }}>Checking open times…</p>
                        ) : rsSlots.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#9A938A', margin: 0 }}>No open times that day — try another date.</p>
                        ) : (
                          <select className="form-select" value={rsSlot} onChange={e => setRsSlot(e.target.value)}>
                            <option value="">— Pick a new time —</option>
                            {rsSlots.map(s => {
                              const v = typeof s === 'string' ? s : s.start_time || s.start;
                              return <option key={v} value={v}>{format(new Date(v), 'h:mm a')}</option>;
                            })}
                          </select>
                        )
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={submitReschedule}
                          disabled={!rsSlot || rsBusy}
                          style={{
                            ...styles.chargeFeeBtn, flex: 1, padding: '10px 20px',
                            background: '#C8A24B', color: '#0E0E10', border: 'none',
                            opacity: !rsSlot || rsBusy ? 0.5 : 1,
                          }}
                        >
                          {rsBusy ? 'Moving…' : 'Confirm new time'}
                        </button>
                        <button onClick={() => { setRsOpen(false); setRsDate(''); }} disabled={rsBusy} style={{ ...styles.chargeFeeBtn, padding: '10px 20px' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

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
                    Updates the appointment total. Pick “No discount” and Apply to remove it.
                  </p>
                  <button onClick={copyPayLink} style={styles.copyLinkBtn}>
                    {linkCopied ? '✓ Link copied' : 'Copy payment link'}
                  </button>
                  <p style={{ fontSize: 12, color: '#9A938A', marginTop: 6, lineHeight: 1.5 }}>
                    Text or email this link to the client — they sign in and pay the current total online.
                  </p>
                </div>
              </>
            )}

            {/* Record an in-person payment (cash/check) into the ledger */}
            {isAdmin && (
              <>
                <div className="divider" />
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Record a payment</label>
                  <p style={{ fontSize: 13, color: '#9A938A', marginBottom: 10 }}>
                    Paid: ${(((selectedAppt.amount_paid_cents || 0)) / 100).toFixed(2)} of ${((selectedAppt.total_cents || 0) / 100).toFixed(2)}
                    {' · '}Balance: ${(Math.max(0, (selectedAppt.total_cents || 0) - (selectedAppt.amount_paid_cents || 0)) / 100).toFixed(2)}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="form-input" type="number" min="0" step="0.01" placeholder="Amount $"
                      value={recAmount} onChange={e => setRecAmount(e.target.value)} disabled={recBusy}
                      style={{ flex: '1 1 120px' }}
                    />
                    <select className="form-select" value={recMethod} onChange={e => setRecMethod(e.target.value)} disabled={recBusy} style={{ flex: '1 1 110px' }}>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="other">Other</option>
                    </select>
                    <button onClick={recordCashPayment} disabled={recBusy} style={styles.chargeFeeBtn}>
                      {recBusy ? 'Saving…' : 'Record'}
                    </button>
                  </div>
                  <input
                    className="form-input" type="text" placeholder="Note (optional)"
                    value={recNote} onChange={e => setRecNote(e.target.value)} disabled={recBusy}
                    style={{ marginTop: 8 }}
                  />
                  {recResult && (
                    <p style={{ fontSize: 13, marginTop: 8, color: recResult.ok ? '#10B981' : '#EF4444' }}>
                      {recResult.message}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: '#9A938A', marginTop: 8, lineHeight: 1.5 }}>
                    For cash or check taken in person. Card payments are recorded automatically through Stripe. Everything appears in the Payments report.
                  </p>
                </div>
              </>
            )}

            {/* No-show / late-cancel fee — charges the card on file. Shown for
                guest bookings too: guests have client.id === null but the
                backend can still charge the card captured at booking. */}
            {isAdmin && (
              <>
                <div className="divider" />
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Charge a fee</label>
                  {selectedAppt.fee_charged_cents > 0 && (
                    <p style={{ fontSize: 13, color: '#10B981', marginBottom: 8 }}>
                      ${(selectedAppt.fee_charged_cents / 100).toFixed(2)} fee already charged.
                    </p>
                  )}
                  {!apptCardLoaded ? (
                    <p style={{ fontSize: 13, color: '#9A938A', marginBottom: 8 }}>Checking card…</p>
                  ) : apptCard ? (
                    <p style={{ fontSize: 13, color: '#10B981', marginBottom: 8 }}>
                      {`${apptCard.brand ? apptCard.brand.charAt(0).toUpperCase() + apptCard.brand.slice(1) : 'Card'} ···· ${apptCard.last4} · exp ${String(apptCard.exp_month).padStart(2, '0')}/${apptCard.exp_year}`}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#9A938A', marginBottom: 8 }}>{noCardText}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-select" value={feeType} onChange={e => setFeeType(e.target.value)} disabled={feeBusy} style={{ flex: 1 }}>
                      <option value="no_show">No-show (100%)</option>
                      <option value="late_cancel">Late cancel (50%)</option>
                    </select>
                    <button onClick={chargeFee} disabled={feeBusy || (apptCardLoaded && !apptCard)} style={styles.chargeFeeBtn}>
                      {feeBusy ? 'Charging…' : 'Charge card'}
                    </button>
                  </div>
                  {feeResult && (
                    <p style={{ fontSize: 13, marginTop: 8, color: feeResult.ok ? '#10B981' : '#EF4444' }}>
                      {feeResult.message}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: '#9A938A', marginTop: 8, lineHeight: 1.5 }}>
                    Charges the card on file (minus anything already paid). Cards are captured at booking, including for guests; for account holders you can also add one from the Clients tab.
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
  copyLinkBtn: {
    marginTop: 10, padding: '8px 16px', borderRadius: 8, background: 'none', color: '#C8A24B',
    border: '1px solid #2A2A2A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
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
