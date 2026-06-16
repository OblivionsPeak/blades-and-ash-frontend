import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { apptItems } from '../utils';
import AppointmentCard from '../components/AppointmentCard';
import Modal from '../components/Modal';

export default function Profile() {
  const { user, profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Reschedule modal
  const [rsAppt, setRsAppt] = useState(null);
  const [rsDate, setRsDate] = useState(null);
  const [rsSlots, setRsSlots] = useState([]);
  const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
  const [rsSlot, setRsSlot] = useState('');
  const [rsSaving, setRsSaving] = useState(false);
  const [rsErr, setRsErr] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    if (!session?.access_token) return;
    api.getAppointments(session.access_token)
      .then(data => setAppointments(data.appointments || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, profile]);

  async function handleCancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    await api.cancelAppointment(id, session.access_token);
    setAppointments(a => a.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
  }

  function openReschedule(appt) {
    setRsAppt(appt);
    setRsDate(null);
    setRsSlots([]);
    setRsSlot('');
    setRsErr('');
  }

  // Load open times whenever a date is picked in the reschedule modal.
  useEffect(() => {
    if (!rsAppt || !rsDate) return;
    const staffId = rsAppt.staff?.id;
    const serviceIds = apptItems(rsAppt).map(i => i.service_id).filter(Boolean);
    if (!staffId || serviceIds.length === 0) return;
    setRsSlotsLoading(true);
    setRsSlot('');
    api.getAvailability({ staff_id: staffId, service_ids: serviceIds.join(','), date: format(rsDate, 'yyyy-MM-dd') })
      .then(data => setRsSlots(Array.isArray(data) ? data : (data.slots || [])))
      .catch(() => setRsSlots([]))
      .finally(() => setRsSlotsLoading(false));
  }, [rsAppt, rsDate]);

  async function submitReschedule() {
    if (!rsAppt || !rsSlot) return;
    setRsSaving(true);
    setRsErr('');
    try {
      const res = await api.rescheduleAppointment(rsAppt.id, { start_time: rsSlot }, session.access_token);
      setAppointments(a => a.map(x => x.id === rsAppt.id ? { ...x, ...res.appointment } : x));
      setRsAppt(null);
      setMsg('Appointment rescheduled.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setRsErr(e.message || 'Could not reschedule. Please try another time.');
    } finally {
      setRsSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
    setMsg('Profile updated.');
    setTimeout(() => setMsg(''), 3000);
  }

  const upcoming = appointments.filter(a => new Date(a.end_time) >= new Date() && a.status !== 'cancelled');
  const past = appointments.filter(a => new Date(a.end_time) < new Date() || a.status === 'cancelled');

  return (
    <div style={styles.page}>
      <div className="container">
        <h1 style={styles.title}>My Account</h1>
        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

        {/* Profile card */}
        <div className="profile-card" style={styles.profileCard}>
          <div style={styles.avatarBig}>{profile?.full_name?.[0] || '?'}</div>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={styles.editForm}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={saveProfile} disabled={saving} style={styles.saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => setEditing(false)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={styles.profileName}>{profile?.full_name}</div>
                <div style={styles.profileMeta}>{user?.email}</div>
                {profile?.phone && <div style={styles.profileMeta}>{profile.phone}</div>}
                <button onClick={() => setEditing(true)} style={styles.editBtn}>Edit Profile</button>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming */}
        <h2 style={styles.sectionTitle}>Upcoming Appointments</h2>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : upcoming.length === 0 ? (
          <div style={styles.empty}>
            <p>No upcoming appointments.</p>
            <a href="/book" style={styles.bookLink}>Book Now →</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcoming.map(a => <AppointmentCard key={a.id} appointment={a} showStaff onCancel={handleCancel} onReschedule={openReschedule} onPay={() => navigate(`/pay/${a.id}`)} />)}
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            <h2 style={{ ...styles.sectionTitle, marginTop: 48 }}>Past Appointments</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {past.map(a => <AppointmentCard key={a.id} appointment={a} showStaff />)}
            </div>
          </>
        )}
      </div>

      {/* Reschedule modal */}
      <Modal open={!!rsAppt} onClose={() => setRsAppt(null)} title="Reschedule Appointment">
        {rsAppt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rsErr && <div className="alert alert-error">{rsErr}</div>}
            <p style={{ fontSize: 14, color: '#9A938A', margin: 0 }}>
              Pick a new date and time. Your services and stylist stay the same.
            </p>
            <Calendar
              onChange={d => setRsDate(d)}
              value={rsDate}
              minDate={new Date()}
              maxDate={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)}
            />
            {rsDate && (
              rsSlotsLoading ? (
                <div className="loading-center"><div className="spinner" /></div>
              ) : rsSlots.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9A938A' }}>No open times that day — try another date.</p>
              ) : (
                <select className="form-select" value={rsSlot} onChange={e => setRsSlot(e.target.value)}>
                  <option value="">— Choose a time —</option>
                  {rsSlots.map(slot => (
                    <option key={slot} value={slot}>{format(new Date(slot), 'h:mm a')}</option>
                  ))}
                </select>
              )
            )}
            <button onClick={submitReschedule} disabled={!rsSlot || rsSaving} style={styles.rescheduleConfirm}>
              {rsSaving ? 'Rescheduling…' : 'Confirm New Time'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

const styles = {
  page: { padding: '48px 0 80px' },
  title: { fontFamily: "'Cormorant', serif", fontSize: 36, marginBottom: 32 },
  profileCard: {
    background: '#16161A', borderRadius: 16, padding: 28,
    display: 'flex', alignItems: 'flex-start', gap: 24,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 48,
    border: '1px solid #2A2A2A',
  },
  avatarBig: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#0E0E10', color: '#C8A24B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 700, flexShrink: 0,
    fontFamily: "'Cormorant', serif",
  },
  profileName: { fontFamily: "'Cormorant', serif", fontSize: 22, color: '#EDE7DB', marginBottom: 4 },
  profileMeta: { fontSize: 14, color: '#9A938A', marginBottom: 2 },
  editBtn: {
    marginTop: 12, padding: '7px 18px', borderRadius: 999,
    background: 'none', border: '1px solid #2A2A2A', fontSize: 13, cursor: 'pointer',
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: 14 },
  saveBtn: {
    padding: '8px 20px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B',
    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 20px', borderRadius: 999, background: 'none',
    border: '1px solid #2A2A2A', fontSize: 13, cursor: 'pointer',
  },
  sectionTitle: { fontFamily: "'Cormorant', serif", fontSize: 24, marginBottom: 20 },
  empty: { textAlign: 'center', padding: '40px 0', color: '#9A938A' },
  bookLink: {
    display: 'inline-block', marginTop: 12, padding: '10px 28px',
    borderRadius: 999, background: '#C8A24B', color: '#0E0E10',
    fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
  rescheduleConfirm: {
    padding: '12px 28px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
  },
};
