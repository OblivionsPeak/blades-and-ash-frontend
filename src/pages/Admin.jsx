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
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Service modal
  const [svcModal, setSvcModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [svcForm, setSvcForm] = useState({ name: '', description: '', category: '', duration_minutes: 60, price_cents: 0, deposit_required: false, deposit_cents: 0 });

  // Discounts
  const [discounts, setDiscounts] = useState([]);
  const [discModal, setDiscModal] = useState(false);
  const [editDisc, setEditDisc] = useState(null);
  const [discForm, setDiscForm] = useState({ code: '', type: 'percent', value: 10, scope: 'all', expires_at: '', active: true });

  // Bulk import
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

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
    Promise.all([
      api.getServices(),
      api.getStaff(),
      api.getClients(token).catch(() => ({ clients: [] })),
      api.getDiscounts(token).catch(() => []),
    ])
      .then(([svcs, stf, cl, disc]) => {
        setServices(svcs);
        setStaff(stf);
        setClients(cl.clients || cl || []);
        setDiscounts(disc.discounts || disc || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function refreshTeam() {
    const token = session?.access_token;
    const [stf, cl] = await Promise.all([api.getStaff(), api.getClients(token).catch(() => ({ clients: [] }))]);
    setStaff(stf);
    setClients(cl.clients || cl || []);
  }

  async function changeRole(id, role) {
    try {
      await api.updateUserRole(id, role, session?.access_token);
      await refreshTeam();
      notify('Role updated.');
    } catch (e) {
      notify(e.message || 'Could not update role.');
    }
  }

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
    setSvcForm({ name: '', description: '', category: '', duration_minutes: 60, price_cents: 0, deposit_required: false, deposit_cents: 0 });
    setSvcModal(true);
  }
  function openEditSvc(svc) {
    setEditSvc(svc);
    setSvcForm({ name: svc.name, description: svc.description || '', category: svc.category || '', duration_minutes: svc.duration_minutes, price_cents: svc.price_cents, deposit_required: svc.deposit_required, deposit_cents: svc.deposit_cents || 0 });
    setSvcModal(true);
  }
  async function saveSvc() {
    const token = session?.access_token;
    const body = { ...svcForm };
    if (!body.name?.trim()) { notify('Please enter a service name.'); return; }
    try {
      if (editSvc) await api.updateService(editSvc.id, body, token);
      else await api.createService(body, token);
      // Re-fetch the canonical list so the page always reflects the database
      setServices(await api.getServices());
      setSvcModal(false);
      notify('Service saved.');
    } catch (e) {
      notify(e.message || 'Could not save service.');
    }
  }
  async function deleteSvc(id) {
    if (!confirm('Delete this service?')) return;
    try {
      await api.deleteService(id, session?.access_token);
      setServices(await api.getServices());
      notify('Service deleted.');
    } catch (e) {
      notify(e.message || 'Could not delete service.');
    }
  }

  // Distinct, non-empty categories drawn from existing services — used to
  // populate the service category datalist and the discount scope select.
  const categories = [...new Set(services.map(s => s.category).filter(Boolean))].sort();

  async function refreshDiscounts() {
    const disc = await api.getDiscounts(session?.access_token).catch(() => []);
    setDiscounts(disc.discounts || disc || []);
  }

  function openNewDisc() {
    setEditDisc(null);
    setDiscForm({ code: '', type: 'percent', value: 10, scope: 'all', expires_at: '', active: true });
    setDiscModal(true);
  }
  function openEditDisc(d) {
    setEditDisc(d);
    setDiscForm({
      code: d.code || '',
      type: d.type || 'percent',
      // fixed values are stored in cents on the server; show dollars in the form
      value: d.type === 'fixed' ? (d.value || 0) / 100 : (d.value || 0),
      scope: d.scope || 'all',
      expires_at: d.expires_at ? d.expires_at.slice(0, 10) : '',
      active: d.active !== false,
    });
    setDiscModal(true);
  }
  async function saveDisc() {
    const token = session?.access_token;
    if (!discForm.code.trim()) { notify('Please enter a discount code.'); return; }
    const val = Number(discForm.value);
    if (!val || val <= 0) { notify('Please enter a value greater than zero.'); return; }
    if (discForm.type === 'percent' && (val < 1 || val > 100)) { notify('Percent must be between 1 and 100.'); return; }
    const body = {
      code: discForm.code.trim().toUpperCase(),
      type: discForm.type,
      // percent stays as-is (1–100); fixed is sent in cents
      value: discForm.type === 'fixed' ? Math.round(val * 100) : Math.round(val),
      scope: discForm.scope || 'all',
      expires_at: discForm.expires_at || null,
      active: discForm.active,
    };
    try {
      if (editDisc) await api.updateDiscount(editDisc.id, body, token);
      else await api.createDiscount(body, token);
      await refreshDiscounts();
      setDiscModal(false);
      notify('Discount saved.');
    } catch (e) {
      notify(e.message || 'Could not save discount.');
    }
  }
  async function deleteDisc(id) {
    if (!confirm('Delete this discount?')) return;
    try {
      await api.deleteDiscount(id, session?.access_token);
      await refreshDiscounts();
      notify('Discount deleted.');
    } catch (e) {
      notify(e.message || 'Could not delete discount.');
    }
  }
  function fmtDiscValue(d) {
    return d.type === 'percent' ? `${d.value}%` : `$${(d.value / 100).toFixed(2)}`;
  }

  // Parse a pasted list into services. Forgiving about format: one service
  // per line, e.g. "Women's Cut, 60, 65" or "Women's Cut, 60 min, $65" or
  // "Women's Cut, $65, 60 min". Optional 4th number is the deposit.
  function parseServiceLines(text) {
    const rows = [];
    const skipped = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      // Split on commas/tabs/pipes/semicolons, or a dash surrounded by spaces
      // (so hyphenated names like "Touch-Up" stay intact).
      let parts = line.split(/[,\t|;]+|\s+[-–—]\s+/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) {
        // No delimiter — fall back to "Name <price>" with a trailing number
        const m = line.match(/^(.+?)\s+\$?(\d+(?:\.\d+)?)\s*$/);
        if (m) parts = [m[1].trim(), m[2]];
        else { skipped.push(line); continue; }
      }
      const name = parts[0];
      let duration = null, price = null, deposit = null;
      const leftovers = [];
      for (const p of parts.slice(1)) {
        const digits = p.replace(/[^0-9.]/g, '');
        if (digits === '' || isNaN(parseFloat(digits))) continue;
        const val = parseFloat(digits);
        const low = p.toLowerCase();
        if (/hour|hr/.test(low) && duration === null) duration = Math.round(val * 60);
        else if (/min/.test(low) && duration === null) duration = val;
        else if (/\$|usd|\./.test(low) && price === null) price = val;
        else leftovers.push(val);
      }
      // Distribute the unmarked numbers. Price is the one value that must be
      // present; duration is optional and defaults to 60 min.
      if (price === null && duration === null) {
        if (leftovers.length >= 2) { duration = leftovers[0]; price = leftovers[1]; if (leftovers[2] != null) deposit = leftovers[2]; }
        else if (leftovers.length === 1) { price = leftovers[0]; } // a lone number is the price
      } else if (price === null) {
        if (leftovers[0] != null) price = leftovers[0];
        if (leftovers[1] != null) deposit = leftovers[1];
      } else if (duration === null) {
        if (leftovers[0] != null) duration = leftovers[0];
        if (leftovers[1] != null) deposit = leftovers[1];
      } else if (leftovers[0] != null) {
        deposit = leftovers[0];
      }
      if (duration === null) duration = 60; // sensible default; editable per service
      if (!name || price === null || price <= 0 || duration <= 0) {
        skipped.push(line);
        continue;
      }
      rows.push({
        name,
        description: '',
        duration_minutes: Math.round(duration),
        price_cents: Math.round(price * 100),
        deposit_required: !!deposit && deposit > 0,
        deposit_cents: deposit && deposit > 0 ? Math.round(deposit * 100) : 0,
      });
    }
    return { rows, skipped };
  }

  async function doImport() {
    const token = session?.access_token;
    const { rows } = parseServiceLines(importText);
    if (!rows.length) { notify('No valid lines to import. Check the format.'); return; }
    setImporting(true);
    let created = 0;
    const failed = [];
    for (const row of rows) {
      try { await api.createService(row, token); created++; }
      catch { failed.push(row.name); }
    }
    setServices(await api.getServices());
    setImporting(false);
    setImportModal(false);
    setImportText('');
    notify(failed.length
      ? `Imported ${created}. Failed: ${failed.join(', ')}`
      : `Imported ${created} service${created !== 1 ? 's' : ''}.`);
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
          <button className={`tab-btn ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
          <button className={`tab-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>Staff & Services</button>
          <button className={`tab-btn ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
          <button className={`tab-btn ${tab === 'discounts' ? 'active' : ''}`} onClick={() => setTab('discounts')}>Discounts</button>
        </div>

        {/* Services Tab */}
        {tab === 'services' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setImportText(''); setImportModal(true); }} style={styles.importBtn}>⇪ Bulk Import</button>
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

        {/* Team Tab */}
        {tab === 'team' && (
          <div>
            <p style={{ fontSize: 14, color: '#9A938A', marginBottom: 20, lineHeight: 1.6, maxWidth: 640 }}>
              Set each person's role. Promote a stylist to <strong>Staff</strong> so they become bookable and can have availability and services.
              <strong>Admins</strong> can manage everything and are also bookable. As an admin, you already appear in the Availability and Staff &amp; Services tabs.
            </p>
            {[...staff, ...clients]
              .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
              .map(p => (
                <div key={p.id} style={styles.staffBlock}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={styles.staffName}>{p.full_name || '(no name)'}{p.id === user.id && <span style={{ fontSize: 12, color: '#C8A24B', marginLeft: 8 }}>· you</span>}</h3>
                      <p style={{ ...styles.staffMeta, marginBottom: 0 }}>{p.phone || 'No phone'}</p>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                      <select
                        className="form-select"
                        value={p.role || 'client'}
                        disabled={p.id === user.id}
                        title={p.id === user.id ? "You can't change your own role" : 'Change role'}
                        onChange={e => changeRole(p.id, e.target.value)}
                      >
                        <option value="client">Client</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
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
                          style={{ accentColor: '#C8A24B' }}
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
                            style={{ accentColor: '#C8A24B' }} />
                          <span style={{ fontWeight: 600, minWidth: 90 }}>{day}</span>
                        </label>
                        {row.active && (
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <input type="time" value={row.start_time} className="form-input" style={{ width: 130 }}
                              onChange={e => setAvailability(a => a.map((r, j) => j === i ? { ...r, start_time: e.target.value } : r))} />
                            <span style={{ color: '#9A938A' }}>to</span>
                            <input type="time" value={row.end_time} className="form-input" style={{ width: 130 }}
                              onChange={e => setAvailability(a => a.map((r, j) => j === i ? { ...r, end_time: e.target.value } : r))} />
                          </div>
                        )}
                        {!row.active && <span style={{ color: '#9A938A', fontSize: 13 }}>Day off</span>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveAvailability} style={styles.saveAvailBtn}>Save Availability</button>
              </div>
            )}
          </div>
        )}

        {/* Discounts Tab */}
        {tab === 'discounts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={openNewDisc} style={styles.addBtn}>+ Add Discount</button>
            </div>
            {discounts.length === 0 ? (
              <p style={{ fontSize: 14, color: '#9A938A' }}>No discount codes yet. Add one to offer a promo at checkout.</p>
            ) : (
              <div style={styles.table}>
                <div style={styles.discHead}>
                  <span>Code</span><span>Discount</span><span>Scope</span><span>Expires</span><span>Status</span><span>Actions</span>
                </div>
                {discounts.map(d => (
                  <div key={d.id} style={styles.discRow}>
                    <span style={styles.svcName}>{d.code}</span>
                    <span style={styles.cell}>{fmtDiscValue(d)}</span>
                    <span style={styles.cell}>{d.scope === 'all' || !d.scope ? 'All services' : d.scope}</span>
                    <span style={styles.cell}>{d.expires_at ? d.expires_at.slice(0, 10) : 'Never'}</span>
                    <span style={styles.cell}>
                      <span style={d.active !== false ? styles.pillActive : styles.pillInactive}>
                        {d.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                    <div style={styles.actions}>
                      <button onClick={() => openEditDisc(d)} style={styles.editBtn}>Edit</button>
                      <button onClick={() => deleteDisc(d.id)} style={styles.deleteBtn}>Delete</button>
                    </div>
                  </div>
                ))}
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
          <div className="form-group">
            <label className="form-label">Category (optional)</label>
            <input className="form-input" list="svc-category-list" placeholder="e.g. Color, Cuts, Extensions"
              value={svcForm.category} onChange={e => setSvcForm(f => ({ ...f, category: e.target.value }))} />
            <datalist id="svc-category-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
            <p style={{ fontSize: 12, color: '#9A938A', marginTop: 4 }}>Used to scope discount codes to a group of services.</p>
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
            <input type="checkbox" checked={svcForm.deposit_required} style={{ accentColor: '#C8A24B' }}
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

      {/* Bulk Import Modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Bulk Import Services">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: '#9A938A', lineHeight: 1.6 }}>
            Paste your service list — <strong>one per line</strong>, as
            <span style={{ color: '#C8A24B' }}> Name, Price</span>. Duration is optional
            (defaults to 60 min — editable per service); add it as
            <span style={{ color: '#C8A24B' }}> Name, Duration, Price</span>, and a further number for a deposit.
            Dollar signs and “min” are fine, and header rows are skipped automatically.
          </p>
          <p style={{ fontSize: 12, color: '#7d776d', lineHeight: 1.5, marginTop: -6 }}>
            Heads-up: every imported service starts at 60 min, which sets its booking length. Edit any that differ
            (e.g. colour or highlights) afterward.
          </p>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
            placeholder={"Women's Cut, 60, 65\nMen's Cut, 30, 35\nRoot Touch-Up, 90 min, $95, 25\nFull Highlight, 150 min, $180, 50"}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          {importText.trim() && (() => {
            const { rows, skipped } = parseServiceLines(importText);
            return (
              <div style={{ fontSize: 12.5, color: '#9A938A', lineHeight: 1.6 }}>
                <div style={{ color: rows.length ? '#9ad9b4' : '#f8a3a3' }}>
                  {rows.length} service{rows.length !== 1 ? 's' : ''} ready to import
                </div>
                {rows.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ color: '#C9C2B5' }}>
                    • {r.name} — {r.duration_minutes} min · ${(r.price_cents / 100).toFixed(2)}
                    {r.deposit_required ? ` · $${(r.deposit_cents / 100).toFixed(2)} deposit` : ''}
                  </div>
                ))}
                {rows.length > 6 && <div>…and {rows.length - 6} more</div>}
                {skipped.length > 0 && (
                  <div style={{ color: '#f8a3a3', marginTop: 6 }}>
                    Skipped {skipped.length} line{skipped.length !== 1 ? 's' : ''} (couldn’t read a duration and price): {skipped.slice(0, 3).join(' | ')}{skipped.length > 3 ? '…' : ''}
                  </div>
                )}
              </div>
            );
          })()}
          <button onClick={doImport} disabled={importing} style={styles.saveAvailBtn}>
            {importing ? 'Importing…' : 'Import Services'}
          </button>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal open={discModal} onClose={() => setDiscModal(false)} title={editDisc ? 'Edit Discount' : 'New Discount'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" placeholder="e.g. SPRING20" value={discForm.code}
              onChange={e => setDiscForm(f => ({ ...f, code: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Type</label>
              <select className="form-select" value={discForm.type}
                onChange={e => setDiscForm(f => ({ ...f, type: e.target.value }))}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{discForm.type === 'percent' ? 'Percent off (1–100)' : 'Amount off ($)'}</label>
              <input className="form-input" type="number" step={discForm.type === 'percent' ? '1' : '0.01'}
                value={discForm.value} onChange={e => setDiscForm(f => ({ ...f, value: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Scope</label>
            <select className="form-select" value={discForm.scope}
              onChange={e => setDiscForm(f => ({ ...f, scope: e.target.value }))}>
              <option value="all">All services</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expires (optional)</label>
            <input className="form-input" type="date" value={discForm.expires_at}
              onChange={e => setDiscForm(f => ({ ...f, expires_at: e.target.value }))} />
          </div>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={discForm.active} style={{ accentColor: '#C8A24B' }}
              onChange={e => setDiscForm(f => ({ ...f, active: e.target.checked }))} />
            Active
          </label>
          <button onClick={saveDisc} style={styles.saveAvailBtn}>Save Discount</button>
        </div>
      </Modal>
    </div>
  );
}

const styles = {
  page: { padding: '48px 0 80px' },
  title: { fontFamily: "'Cormorant', serif", fontSize: 36, marginBottom: 32 },
  addBtn: { padding: '10px 24px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  importBtn: { padding: '10px 20px', borderRadius: 999, background: 'transparent', color: '#C8A24B', border: '1px solid #C8A24B', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  table: { background: '#16161A', borderRadius: 12, border: '1px solid #2A2A2A', overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: '#0E0E10', color: '#C8A24B', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #2A2A2A', alignItems: 'center' },
  discHead: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr 0.9fr 1fr', padding: '12px 20px', background: '#0E0E10', color: '#C8A24B', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  discRow: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr 0.9fr 1fr', padding: '16px 20px', borderBottom: '1px solid #2A2A2A', alignItems: 'center' },
  pillActive: { fontSize: 12, color: '#9ad9b4', border: '1px solid rgba(154,217,180,0.4)', borderRadius: 999, padding: '3px 10px' },
  pillInactive: { fontSize: 12, color: '#9A938A', border: '1px solid #2A2A2A', borderRadius: 999, padding: '3px 10px' },
  svcName: { fontWeight: 600, fontSize: 15 },
  svcDesc: { fontSize: 12, color: '#9A938A', marginTop: 2 },
  cell: { fontSize: 14, color: '#9A938A' },
  actions: { display: 'flex', gap: 8 },
  editBtn: { padding: '5px 14px', borderRadius: 999, background: 'none', border: '1px solid #2A2A2A', fontSize: 12, cursor: 'pointer' },
  deleteBtn: { padding: '5px 14px', borderRadius: 999, background: 'none', border: '1px solid rgba(248,113,113,0.4)', color: '#C0392B', fontSize: 12, cursor: 'pointer' },
  staffBlock: { background: '#16161A', borderRadius: 12, padding: 24, marginBottom: 16, border: '1px solid #2A2A2A' },
  staffName: { fontFamily: "'Cormorant', serif", fontSize: 20, marginBottom: 4 },
  staffMeta: { fontSize: 13, color: '#9A938A', marginBottom: 16 },
  serviceChecks: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  dayRow: { display: 'flex', alignItems: 'center', gap: 20, background: '#16161A', borderRadius: 8, padding: '12px 16px', border: '1px solid #2A2A2A' },
  dayToggle: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 140 },
  saveAvailBtn: { padding: '12px 32px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Jost', sans-serif" },
};
