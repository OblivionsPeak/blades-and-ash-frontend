import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Admin() {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('services');
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Service modal
  const [svcModal, setSvcModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [svcForm, setSvcForm] = useState({ name: '', description: '', duration_minutes: 60, price_cents: 0, deposit_required: false, deposit_cents: 0 });

  // Availability
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [availability, setAvailability] = useState(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '17:00', active: i > 0 && i < 6 }))
  );

  // Staff services
  const [staffServices, setStaffServices] = useState({});

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (profile?.role !== 'admin') { navigate('/dashboard'); return; }
  }, [user, profile]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    Promise.all([api.getServices(), api.getStaff()])
      .then(([svcs, stf]) => { setServices(svcs); setStaff(stf); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!selectedStaff || !session?.access_token) return;
    api.getStaffAvailability(selectedStaff.id).then(data => {
      const rows = data.availability || data || [];
      setAvailability(DAYS.map((_, i) => {
        const existing = rows.find(r => r.day_of_week === i);
        return existing
          ? { day_of_week: i, start_time: existing.start_time, end_time: existing.end_time, active: true }
          : { day_of_week: i, start_time: '09:00', end_time: '17:00', active: false };
      }));
    });
    api.getStaffServices(selectedStaff.id).then(data => {
      setStaffServices(ss => ({ ...ss, [selectedStaff.id]: (data.services || data || []).map(s => s.id) }));
    });
  }, [selectedStaff]);

  function openNewSvc() {
    setEditSvc(null);
    setSvcForm({ name: '', description: '', duration_minutes: 60, price_cents: 0, deposit_required: false, deposit_cents: 0 });
    setSvcModal(true);
  }
  function openEditSvc(svc) {
    setEditSvc(svc);
    setSvcForm({ name: svc.name, description: svc.description || '', duration_minutes: svc.duration_minutes, price_cents: svc.price_cents, deposit_required: svc.deposit_required, deposit_cents: svc.deposit_cents || 0 });
    setSvcModal(true);
  }
  async function saveSvc() {
    const token = session?.access_token;
    const body = { ...svcForm };
    if (editSvc) await api.updateService(editSvc.id, body, token);
    else {
      const res = await api.createService(body, token);
      setServices(s => [...s, res.service || res]);
    }
    if (editSvc) setServices(s => s.map(x => x.id === editSvc.id ? { ...x, ...body } : x));
    setSvcModal(false);
    notify('Service saved.');
  }
  async function deleteSvc(id) {
    if (!confirm('Delete this service?')) return;
    await api.deleteService(id, session?.access_token);
    setServices(s => s.filter(x => x.id !== id));
    notify('Service deleted.');
  }

  async function saveAvailability() {
    const active = availability.filter(a => a.active).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));
    await api.updateAvailability(selectedStaff.id, active, session?.access_token);
    notify('Availability saved.');
  }

  async function toggleStaffService(staffId, serviceId, assigned) {
    const token = session?.access_token;
    if (assigned) await api.removeStaffService(staffId, serviceId, token);
    else await api.assignStaffService(staffId, { service_id: serviceId }, token);
    setStaffServices(ss => ({
      ...ss,
      [staffId]: assigned ? ss[staffId].filter(id => id !== serviceId) : [...(ss[staffId] || []), serviceId],
    }));
  }

  function notify(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div style={styles.page}>
      <div className="container">
        <h1 style={styles.title}>Admin Panel</h1>
        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>Services</button>
          <button className={`tab-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>Staff & Services</button>
          <button className={`tab-btn ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
        </div>

        {/* Services Tab */}
        {tab === 'services' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={openNewSvc} style={styles.addBtn}>+ Add Service</button>
            </div>
            <div style={styles.table}>
              <div style={styles.tableHead}>
                <span>Service</span><span>Duration</span><span>Price</span><span>Deposit</span><span>Actions</span>
              </div>
              {services.map(s => (
                <div key={s.id} style={styles.tableRow}>
                  <div>
                    <div style={styles.svcName}>{s.name}</div>
                    {s.description && <div style={styles.svcDesc}>{s.description}</div>}
                  </div>
                  <span style={styles.cell}>{s.duration_minutes} min</span>
                  <span style={styles.cell}>${(s.price_cents / 100).toFixed(2)}</span>
                  <span style={styles.cell}>{s.deposit_required ? `$${(s.deposit_cents / 100).toFixed(2)}` : 'None'}</span>
                  <div style={styles.actions}>
                    <button onClick={() => openEditSvc(s)} style={styles.editBtn}>Edit</button>
                    <button onClick={() => deleteSvc(s.id)} style={styles.deleteBtn}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff & Services Tab */}
        {tab === 'staff' && (
          <div>
            {staff.map(st => (
              <div key={st.id} style={styles.staffBlock}>
                <h3 style={styles.staffName}>{st.full_name}</h3>
                <p style={styles.staffMeta}>{st.role} · {st.phone || 'No phone'}</p>
                <div style={styles.serviceChecks}>
                  {services.map(svc => {
                    const assigned = (staffServices[st.id] || []).includes(svc.id);
                    return (
                      <label key={svc.id} style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={() => toggleStaffService(st.id, svc.id, assigned)}
                          style={{ accentColor: '#C9A84C' }}
                        />
                        {svc.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Availability Tab */}
        {tab === 'availability' && (
          <div>
            <div className="form-group" style={{ maxWidth: 260, marginBottom: 24 }}>
              <label className="form-label">Select Staff Member</label>
              <select className="form-select" onChange={e => setSelectedStaff(staff.find(s => s.id === e.target.value) || null)}>
                <option value="">— Choose —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>

            {selectedStaff && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {DAYS.map((day, i) => {
                    const row = availability[i];
                    return (
                      <div key={i} style={styles.dayRow}>
                        <label style={styles.dayToggle}>
                          <input type="checkbox" checked={row.active}
                            onChange={() => setAvailability(a => a.map((r, j) => j === i ? { ...r, active: !r.active } : r))}
                            style={{ accentColor: '#C9A84C' }} />
                          <span style={{ fontWeight: 600, minWidth: 90 }}>{day}</span>
                        </label>
                        {row.active && (
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <input type="time" value={row.start_time} className="form-input" style={{ width: 130 }}
                              onChange={e => setAvailability(a => a.map((r, j) => j === i ? { ...r, start_time: e.target.value } : r))} />
                            <span style={{ color: '#888' }}>to</span>
                            <input type="time" value={row.end_time} className="form-input" style={{ width: 130 }}
                              onChange={e => setAvailability(a => a.map((r, j) => j === i ? { ...r, end_time: e.target.value } : r))} />
                          </div>
                        )}
                        {!row.active && <span style={{ color: '#aaa', fontSize: 13 }}>Day off</span>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveAvailability} style={styles.saveAvailBtn}>Save Availability</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Service Modal */}
      <Modal open={svcModal} onClose={() => setSvcModal(false)} title={editSvc ? 'Edit Service' : 'New Service'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input form-textarea" value={svcForm.description} onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Duration (min)</label>
              <input className="form-input" type="number" value={svcForm.duration_minutes} onChange={e => setSvcForm(f => ({ ...f, duration_minutes: +e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Price ($)</label>
              <input className="form-input" type="number" step="0.01" value={(svcForm.price_cents / 100).toFixed(2)}
                onChange={e => setSvcForm(f => ({ ...f, price_cents: Math.round(+e.target.value * 100) }))} />
            </div>
          </div>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={svcForm.deposit_required} style={{ accentColor: '#C9A84C' }}
              onChange={e => setSvcForm(f => ({ ...f, deposit_required: e.target.checked }))} />
            Require deposit
          </label>
          {svcForm.deposit_required && (
            <div className="form-group">
              <label className="form-label">Deposit Amount ($)</label>
              <input className="form-input" type="number" step="0.01" value={(svcForm.deposit_cents / 100).toFixed(2)}
                onChange={e => setSvcForm(f => ({ ...f, deposit_cents: Math.round(+e.target.value * 100) }))} />
            </div>
          )}
          <button onClick={saveSvc} style={styles.saveAvailBtn}>Save Service</button>
        </div>
      </Modal>
    </div>
  );
}

const styles = {
  page: { padding: '48px 0 80px' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 36, marginBottom: 32 },
  addBtn: { padding: '10px 24px', borderRadius: 999, background: '#C9A84C', color: '#0D0D0D', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  table: { background: '#fff', borderRadius: 12, border: '1px solid #E0DCDA', overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: '#0D0D0D', color: '#C9A84C', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #F0EDE9', alignItems: 'center' },
  svcName: { fontWeight: 600, fontSize: 15 },
  svcDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  cell: { fontSize: 14, color: '#444' },
  actions: { display: 'flex', gap: 8 },
  editBtn: { padding: '5px 14px', borderRadius: 999, background: 'none', border: '1px solid #E0DCDA', fontSize: 12, cursor: 'pointer' },
  deleteBtn: { padding: '5px 14px', borderRadius: 999, background: 'none', border: '1px solid #FECACA', color: '#C0392B', fontSize: 12, cursor: 'pointer' },
  staffBlock: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 16, border: '1px solid #E0DCDA' },
  staffName: { fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 4 },
  staffMeta: { fontSize: 13, color: '#888', marginBottom: 16 },
  serviceChecks: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  dayRow: { display: 'flex', alignItems: 'center', gap: 20, background: '#fff', borderRadius: 8, padding: '12px 16px', border: '1px solid #E0DCDA' },
  dayToggle: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 140 },
  saveAvailBtn: { padding: '12px 32px', borderRadius: 999, background: '#0D0D0D', color: '#C9A84C', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" },
};
