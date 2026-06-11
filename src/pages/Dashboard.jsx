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

  async function updateStatus(id, status) {
    setUpdatingStatus(true);
    await api.updateAppointment(id, { status }, session.access_token);
    setAppointments(a => a.map(x => x.id === id ? { ...x, status } : x));
    setSelectedAppt(s => s ? { ...s, status } : s);
    setUpdatingStatus(false);
  }

  const dayAppts = appointments
    .filter(a => isSameDay(new Date(a.start_time), selectedDate))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div style={styles.page}>
      {/* Stats bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div className="container" style={styles.statsInner}>
            <StatPill label="Today" value={stats.today_count} />
            <StatPill label="Upcoming" value={stats.upcoming_count} />
            <StatPill label="Clients" value={stats.client_count} />
            <StatPill label="Revenue (month)" value={`$${((stats.revenue_this_month_cents || 0) / 100).toFixed(0)}`} />
          </div>
        </div>
      )}

      <div className="container" style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
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
                  onClick={() => { setSelectedAppt(a); setModalOpen(true); }}
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
  dayHeader: { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 },
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
