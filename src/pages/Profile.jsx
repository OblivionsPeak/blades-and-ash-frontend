import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import AppointmentCard from '../components/AppointmentCard';

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
        <div style={styles.profileCard}>
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
            {upcoming.map(a => <AppointmentCard key={a.id} appointment={a} showStaff onCancel={handleCancel} />)}
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
    </div>
  );
}

const styles = {
  page: { padding: '48px 0 80px' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 36, marginBottom: 32 },
  profileCard: {
    background: '#fff', borderRadius: 16, padding: 28,
    display: 'flex', alignItems: 'flex-start', gap: 24,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 48,
    border: '1px solid #E0DCDA',
  },
  avatarBig: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#0D0D0D', color: '#C9A84C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 700, flexShrink: 0,
    fontFamily: "'Playfair Display', serif",
  },
  profileName: { fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D0D0D', marginBottom: 4 },
  profileMeta: { fontSize: 14, color: '#888', marginBottom: 2 },
  editBtn: {
    marginTop: 12, padding: '7px 18px', borderRadius: 999,
    background: 'none', border: '1px solid #E0DCDA', fontSize: 13, cursor: 'pointer',
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: 14 },
  saveBtn: {
    padding: '8px 20px', borderRadius: 999, background: '#0D0D0D', color: '#C9A84C',
    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 20px', borderRadius: 999, background: 'none',
    border: '1px solid #E0DCDA', fontSize: 13, cursor: 'pointer',
  },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 20 },
  empty: { textAlign: 'center', padding: '40px 0', color: '#888' },
  bookLink: {
    display: 'inline-block', marginTop: 12, padding: '10px 28px',
    borderRadius: 999, background: '#C9A84C', color: '#0D0D0D',
    fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
};
