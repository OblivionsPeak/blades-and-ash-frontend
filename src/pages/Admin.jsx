import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import CardSetupForm from '../components/CardSetupForm';
import BusinessInfoTab from '../components/BusinessInfoTab';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// The clients endpoint caps at 200 per request. Ask for the maximum, then lean
// on server-side search for anyone past it.
const CLIENT_PAGE = 200;

// Format a YYYY-MM-DD range for display. Dates are parsed as local (append
// T00:00:00) so the calendar day isn't shifted by the timezone offset.
function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
  if (start === end) return s;
  const e = new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}

// "13:30:00" / "13:30" -> "1:30 PM"
function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Whole-day block -> "All day"; partial block -> "1:30 PM – 3:00 PM"
function formatTimeOffWindow(b) {
  if (!b.start_time || !b.end_time) return 'All day';
  return `${formatTime(b.start_time)} – ${formatTime(b.end_time)}`;
}

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
  const [discForm, setDiscForm] = useState({ code: '', type: 'percent', value: 10, scope: 'all', expires_at: '', active: true, admin_only: false });

  // Payments / reconciliation tab. Defaults to the current month.
  const [payFrom, setPayFrom] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); });
  const [payTo, setPayTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [payments, setPayments] = useState([]);
  const [payTotals, setPayTotals] = useState({ by_method: {}, total_cents: 0 });
  const [payLoading, setPayLoading] = useState(false);

  // Bulk import
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Availability
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [availability, setAvailability] = useState(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '17:00', active: i > 0 && i < 6 }))
  );

  // Time off / blocked dates for the selected staff member
  const [timeOff, setTimeOff] = useState([]);
  const [toForm, setToForm] = useState({ start_date: '', end_date: '', start_time: '', end_time: '', reason: '' });
  const [toErr, setToErr] = useState('');

  // Staff services
  const [staffServices, setStaffServices] = useState({});

  // Team tab — staff and admins are listed outright. Clients are only reachable
  // by searching for them, so a full client book doesn't drown out the team.
  const [promoteSearch, setPromoteSearch] = useState('');
  const [promoteResults, setPromoteResults] = useState([]);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteSearched, setPromoteSearched] = useState(false);

  // Clients tab
  const [clientModal, setClientModal] = useState(false);
  const [editClient, setEditClient] = useState(null); // null = adding a new client
  const [clientForm, setClientForm] = useState({ full_name: '', email: '', phone: '' });
  const [savingClient, setSavingClient] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  // The account list is server-paged and server-searched: `clients` holds at
  // most CLIENT_PAGE rows, `clientsTotal` is how many exist in total.
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsLoading, setClientsLoading] = useState(false);
  // Clients tab has two views: account holders ('accounts') and people who
  // booked without an account ('guests'). Accounts stays the default.
  const [clientView, setClientView] = useState('accounts');
  const [guests, setGuests] = useState([]);
  const [guestsLoaded, setGuestsLoaded] = useState(false);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState('');
  const [guestsTotal, setGuestsTotal] = useState(0);
  // Service-notes modal: which client, their note history
  const [notesModal, setNotesModal] = useState(null); // { client, notes, loading }
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // { id, body }
  // Card-on-file modal: which client, the SetupIntent secret, saved cards
  const [cardModal, setCardModal] = useState(null); // { client, clientSecret, cards, loading }

  // Gallery tab
  const [gallery, setGallery] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

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
      api.getClients(token, { limit: CLIENT_PAGE }).catch(() => ({ clients: [] })),
      api.getDiscounts(token).catch(() => []),
    ])
      .then(([svcs, stf, cl, disc]) => {
        setServices(svcs);
        setStaff(stf);
        const rows = cl.clients || cl || [];
        setClients(rows);
        setClientsTotal(typeof cl.total === 'number' ? cl.total : rows.length);
        setDiscounts(disc.discounts || disc || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [tab, payFrom, payTo, session]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'gallery') loadGallery(); }, [tab]);

  // Guests load once, the first time the Clients tab is opened — the tab's own
  // render never waits on it, and searching filters the loaded list locally
  // rather than firing a request per keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'clients') loadGuests(); }, [tab, session]);

  // Account search runs on the server, so it reaches clients past the page cap.
  // Debounced so typing doesn't fire a request per keystroke. Guests are fully
  // loaded up front and still filter locally.
  const clientSearchFirstRun = useRef(true);
  useEffect(() => {
    if (clientSearchFirstRun.current) { clientSearchFirstRun.current = false; return; }
    if (clientView !== 'accounts') return;
    const t = setTimeout(() => { loadClients(clientSearch); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSearch, clientView, session]);

  // Same treatment for the Team tab's promote lookup.
  useEffect(() => {
    if (tab !== 'team') return;
    const t = setTimeout(() => { searchPromotable(promoteSearch); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoteSearch, tab, session]);

  async function loadGuests() {
    const token = session?.access_token;
    if (!token || guestsLoaded || guestsLoading) return;
    setGuestsLoading(true);
    setGuestsError('');
    try {
      const res = await api.getGuests(token, { limit: 1000, offset: 0 });
      setGuests(res.guests || []);
      // Keep the server's true count: searching filters the loaded list
      // locally, so if the list were ever capped we must say so rather than
      // quietly showing a subset.
      setGuestsTotal(typeof res.total === 'number' ? res.total : (res.guests || []).length);
      setGuestsLoaded(true);
    } catch (e) {
      setGuestsError(e.message || 'Could not load guest bookings.');
    } finally {
      setGuestsLoading(false);
    }
  }

  async function loadGallery() {
    setGalleryLoading(true);
    try {
      setGallery(await api.getGallery());
    } catch (e) {
      notify(e.message || 'Could not load the gallery.');
    } finally {
      setGalleryLoading(false);
    }
  }

  // Shrink a photo in the browser before upload (max 1600px, JPEG) so phone
  // pictures don't push multi-MB originals over a salon Wi-Fi connection.
  async function resizeToJpeg(file, maxDim = 1600, quality = 0.85) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', quality)
    );
  }

  async function uploadGalleryFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploadingCount(files.length);
    let failed = 0;
    for (const file of files) {
      try {
        const blob = await resizeToJpeg(file);
        await api.uploadGalleryPhoto(blob, session?.access_token);
      } catch {
        failed += 1;
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
    await loadGallery();
    notify(failed === 0
      ? `${files.length} photo${files.length > 1 ? 's' : ''} added to the gallery.`
      : `${files.length - failed} added, ${failed} failed — try that one again.`);
  }

  async function deleteGalleryPhoto(name) {
    if (!window.confirm('Remove this photo from the website?')) return;
    try {
      await api.deleteGalleryPhoto(name, session?.access_token);
      setGallery((g) => g.filter((p) => p.name !== name));
      notify('Photo removed.');
    } catch (e) {
      notify(e.message || 'Could not remove the photo.');
    }
  }

  // Load the account list from the server, honouring whatever is in the search
  // box. Searching server-side is what lets her reach clients beyond the page
  // cap — filtering the loaded page locally would hide them permanently.
  async function loadClients(search = clientSearch) {
    const token = session?.access_token;
    if (!token) return;
    setClientsLoading(true);
    try {
      const params = { limit: CLIENT_PAGE, offset: 0 };
      if (search.trim()) params.search = search.trim();
      const res = await api.getClients(token, params);
      const rows = res.clients || res || [];
      setClients(rows);
      setClientsTotal(typeof res.total === 'number' ? res.total : rows.length);
    } catch {
      // Leave the previous list in place rather than blanking the tab.
    } finally {
      setClientsLoading(false);
    }
  }

  async function refreshTeam() {
    const stf = await api.getStaff();
    setStaff(stf);
    await loadClients();
    // Keep any open promote search in step with the new roles.
    if (promoteSearch.trim()) await searchPromotable(promoteSearch);
  }

  // Look up clients by name or phone so one can be promoted to staff/admin.
  async function searchPromotable(search) {
    const token = session?.access_token;
    if (!token || !search.trim()) {
      setPromoteResults([]);
      setPromoteSearched(false);
      return;
    }
    setPromoteLoading(true);
    try {
      const res = await api.getClients(token, { limit: 25, offset: 0, search: search.trim() });
      setPromoteResults(res.clients || res || []);
      setPromoteSearched(true);
    } catch {
      setPromoteResults([]);
      setPromoteSearched(true);
    } finally {
      setPromoteLoading(false);
    }
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
    api.getStaffTimeOff(selectedStaff.id, session.access_token)
      .then(data => setTimeOff(data || []))
      .catch(() => setTimeOff([]));
    setToForm({ start_date: '', end_date: '', start_time: '', end_time: '', reason: '' });
    setToErr('');
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
    setDiscForm({ code: '', type: 'percent', value: 10, scope: 'all', expires_at: '', active: true, admin_only: false });
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
      admin_only: d.admin_only === true,
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
      admin_only: discForm.admin_only === true,
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

  async function loadPayments() {
    const token = session?.access_token;
    if (!token) return;
    setPayLoading(true);
    try {
      const params = {};
      if (payFrom) params.from = new Date(payFrom + 'T00:00:00').toISOString();
      if (payTo) params.to = new Date(payTo + 'T23:59:59').toISOString();
      const res = await api.getPayments(token, params);
      setPayments(res.payments || []);
      setPayTotals(res.totals || { by_method: {}, total_cents: 0 });
    } catch (e) {
      notify(e.message || 'Could not load payments.');
    } finally {
      setPayLoading(false);
    }
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportPaymentsCsv() {
    const header = ['Date', 'Method', 'Kind', 'Amount', 'Client', 'Service', 'Note', 'Recorded by'];
    const lines = [header, ...payments.map(p => [
      new Date(p.created_at).toLocaleString('en-US'),
      p.method,
      p.kind,
      (p.amount_cents / 100).toFixed(2),
      p.client?.full_name || '',
      p.appointment?.service?.name || '',
      p.note || '',
      p.recorder?.full_name || (p.method === 'card' ? 'Stripe' : ''),
    ])];
    const csv = lines.map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payments_${payFrom}_to_${payTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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

  async function addTimeOff() {
    setToErr('');
    const { start_date, end_date, start_time, end_time, reason } = toForm;
    if (!start_date || !end_date) { setToErr('Pick a start and end date.'); return; }
    if (end_date < start_date) { setToErr('End date must be on or after the start date.'); return; }
    // Time window is optional (blank = whole day) but must be complete if used.
    if ((!!start_time) !== (!!end_time)) { setToErr('Enter both a start and end time, or leave both blank for a whole day.'); return; }
    if (start_time && end_time <= start_time) { setToErr('End time must be after the start time.'); return; }
    try {
      const block = await api.addStaffTimeOff(selectedStaff.id, {
        start_date, end_date,
        start_time: start_time || null,
        end_time: end_time || null,
        reason: reason.trim() || null,
      }, session.access_token);
      setTimeOff(list => [...list, block].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setToForm({ start_date: '', end_date: '', start_time: '', end_time: '', reason: '' });
    } catch (e) {
      setToErr(e.message || 'Could not add that time off.');
    }
  }

  async function removeTimeOff(blockId) {
    await api.removeStaffTimeOff(selectedStaff.id, blockId, session.access_token);
    setTimeOff(list => list.filter(b => b.id !== blockId));
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

  function openAddClient() {
    setEditClient(null);
    setClientForm({ full_name: '', email: '', phone: '' });
    setClientModal(true);
  }

  async function openEditClient(c) {
    setEditClient(c);
    setClientForm({ full_name: c.full_name || '', email: '', phone: c.phone || '' });
    setClientModal(true);
    // The client list has no emails (they live in auth) — fetch this one's.
    try {
      const res = await api.getClient(c.id, session?.access_token);
      setClientForm(f => ({ ...f, email: res.client?.email || '' }));
    } catch {
      // Leave email blank; saving with a blank email keeps the current one.
    }
  }

  async function saveClient() {
    const token = session?.access_token;
    if (!clientForm.full_name.trim() || (!editClient && !clientForm.email.trim())) {
      notify('Name and email are required.');
      return;
    }
    setSavingClient(true);
    try {
      const body = {
        full_name: clientForm.full_name.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
      };
      if (editClient) {
        await api.updateClient(editClient.id, body, token);
        await refreshTeam();
        setClientModal(false);
        notify('Client updated.');
      } else {
        const res = await api.createClient(body, token);
        // Once the book is bigger than one page, a new client can land past the
        // cap and look like the add silently failed. Search for them instead so
        // she always sees the person she just created.
        if (clientsTotal >= CLIENT_PAGE) setClientSearch(body.full_name);
        else await refreshTeam();
        setClientModal(false);
        setClientForm({ full_name: '', email: '', phone: '' });
        notify('Client added.');
        // Offer to capture their card right away.
        if (res.client && confirm('Client added. Save a card on file now?')) {
          openCardModal(res.client);
        }
      }
    } catch (e) {
      notify(e.message || (editClient ? 'Could not update client.' : 'Could not add client.'));
    } finally {
      setSavingClient(false);
    }
  }

  async function deleteClient(c) {
    if (!confirm(`Delete ${c.full_name || 'this client'}? Their past appointments are kept, but their profile, notes, and any saved card are removed. This can't be undone.`)) return;
    try {
      await api.deleteClient(c.id, session?.access_token);
      await refreshTeam();
      notify('Client deleted.');
    } catch (e) {
      notify(e.message || 'Could not delete client.');
    }
  }

  async function openNotesModal(client) {
    setNoteText('');
    setEditingNote(null);
    setNotesModal({ client, notes: [], loading: true });
    try {
      const res = await api.getClientNotes(client.id, session?.access_token);
      setNotesModal({ client, notes: res.notes || [], loading: false });
    } catch (e) {
      setNotesModal(null);
      notify(e.message || 'Could not load notes.');
    }
  }

  async function addNote() {
    if (!noteText.trim() || !notesModal) return;
    setSavingNote(true);
    try {
      const res = await api.addClientNote(notesModal.client.id, { body: noteText.trim() }, session?.access_token);
      setNotesModal(m => m && { ...m, notes: [res.note, ...m.notes] });
      setNoteText('');
    } catch (e) {
      notify(e.message || 'Could not save the note.');
    } finally {
      setSavingNote(false);
    }
  }

  async function saveNoteEdit() {
    if (!editingNote?.body.trim() || !notesModal) return;
    setSavingNote(true);
    try {
      const res = await api.updateClientNote(notesModal.client.id, editingNote.id, { body: editingNote.body.trim() }, session?.access_token);
      setNotesModal(m => m && { ...m, notes: m.notes.map(n => n.id === res.note.id ? res.note : n) });
      setEditingNote(null);
    } catch (e) {
      notify(e.message || 'Could not save the note.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteClientNote(notesModal.client.id, noteId, session?.access_token);
      setNotesModal(m => m && { ...m, notes: m.notes.filter(n => n.id !== noteId) });
    } catch (e) {
      notify(e.message || 'Could not delete the note.');
    }
  }

  async function openCardModal(client) {
    const token = session?.access_token;
    setCardModal({ client, clientSecret: null, cards: [], loading: true });
    try {
      const [setup, cardsRes] = await Promise.all([
        api.createCardSetup(client.id, token),
        api.getClientCards(client.id, token).catch(() => ({ cards: [] })),
      ]);
      setCardModal({ client, clientSecret: setup.client_secret, cards: cardsRes.cards || [], loading: false });
    } catch (e) {
      setCardModal(null);
      notify(e.message || 'Could not start card setup.');
    }
  }

  async function onCardSaved() {
    const client = cardModal?.client;
    setCardModal(null);
    notify(`Card saved for ${client?.full_name || 'client'}.`);
    // Refresh so the "Card on file" column picks up the new stripe_customer_id.
    await refreshTeam();
  }

  // Accounts are already filtered by the server — re-filtering here would drop
  // rows the server matched on fields the local check doesn't know about.
  const filteredClients = clients;

  // One row of the Team tab: a person plus their role dropdown. Shared by the
  // staff list and the promote-a-client search results.
  const renderRoleRow = (p) => (
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
  );

  // Same search box drives both views; guests match on name, email, or phone.
  const filteredGuests = clientSearch.trim()
    ? guests.filter(g => {
        const q = clientSearch.trim().toLowerCase();
        return (g.name || '').toLowerCase().includes(q)
          || (g.email || '').toLowerCase().includes(q)
          || (g.phone || '').includes(clientSearch.trim());
      })
    : guests;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div style={styles.page}>
      <div className="container">
        <h1 style={styles.title}>Admin Panel</h1>
        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>Services</button>
          <button className={`tab-btn ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>Clients</button>
          <button className={`tab-btn ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
          <button className={`tab-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>Staff & Services</button>
          <button className={`tab-btn ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
          <button className={`tab-btn ${tab === 'discounts' ? 'active' : ''}`} onClick={() => setTab('discounts')}>Discounts</button>
          <button className={`tab-btn ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>Payments</button>
          <button className={`tab-btn ${tab === 'gallery' ? 'active' : ''}`} onClick={() => setTab('gallery')}>Gallery</button>
          <button className={`tab-btn ${tab === 'business' ? 'active' : ''}`} onClick={() => setTab('business')}>Business Info</button>
        </div>

        {/* Services Tab */}
        {tab === 'services' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setImportText(''); setImportModal(true); }} style={styles.importBtn}>⇪ Bulk Import</button>
              <button onClick={openNewSvc} style={styles.addBtn}>+ Add Service</button>
            </div>
            <div className="admin-table-scroll" style={styles.table}>
              <div className="admin-table-inner" style={styles.tableHead}>
                <span>Service</span><span>Duration</span><span>Price</span><span>Deposit</span><span>Actions</span>
              </div>
              {services.map(s => (
                <div key={s.id} className="admin-table-inner" style={styles.tableRow}>
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

        {/* Clients Tab */}
        {tab === 'clients' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => setClientView('accounts')}
                style={clientView === 'accounts' ? styles.addBtn : styles.importBtn}
              >
                Accounts ({clientsTotal})
              </button>
              <button
                onClick={() => setClientView('guests')}
                style={clientView === 'guests' ? styles.addBtn : styles.importBtn}
              >
                Guests{guestsLoaded ? ` (${guestsTotal})` : ''}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ maxWidth: 280 }}
                placeholder={clientView === 'guests' ? 'Search by name, email, or phone…' : 'Search by name or phone…'}
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
              {clientView === 'accounts' && <button onClick={openAddClient} style={styles.addBtn}>+ Add Client</button>}
            </div>

            {/* Guests view — read-only. Guests have no profile row, so none of
                the client handlers (notes, card, edit, delete) apply here. */}
            {clientView === 'guests' && (
              <div>
                <p style={{ fontSize: 14, color: '#9A938A', marginBottom: 16, lineHeight: 1.6, maxWidth: 640 }}>
                  These are people who booked without creating an account. Their card is captured at booking —
                  to charge a no-show fee, open the appointment itself on the Dashboard.
                </p>
                {guestsLoaded && guestsTotal > guests.length && (
                  <p style={{ fontSize: 13, color: '#C8A24B', marginBottom: 16 }}>
                    Showing the {guests.length} most recent of {guestsTotal} guests. Older ones aren't listed here.
                  </p>
                )}
                {guestsLoading ? (
                  <div className="loading-center"><div className="spinner" /></div>
                ) : guestsError ? (
                  <p style={{ fontSize: 14, color: '#9A938A' }}>{guestsError}</p>
                ) : filteredGuests.length === 0 ? (
                  <p style={{ fontSize: 14, color: '#9A938A' }}>
                    {guests.length === 0 ? 'No guest bookings yet.' : 'No guests match that search.'}
                  </p>
                ) : (
                  <div className="admin-table-scroll" style={styles.table}>
                    <div className="admin-disc-inner" style={styles.discHead}>
                      <span>Guest</span><span>Email</span><span>Phone</span><span>Bookings</span><span>Last visit</span><span>Card on file</span>
                    </div>
                    {filteredGuests.map(g => (
                      <div key={g.email} className="admin-disc-inner" style={styles.discRow}>
                        <div style={styles.svcName}>{g.name || '(no name)'}</div>
                        <span style={styles.cell}>{g.email}</span>
                        <span style={styles.cell}>{g.phone || '—'}</span>
                        <span style={styles.cell}>{g.bookings ?? 0}</span>
                        <span style={styles.cell}>
                          {g.last_appointment_at
                            ? new Date(g.last_appointment_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </span>
                        <span style={styles.cell}>{g.has_card ? 'Yes' : '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {clientView === 'accounts' && !clientSearch.trim() && clientsTotal > clients.length && (
              <p style={{ fontSize: 13, color: '#C8A24B', marginBottom: 16 }}>
                Showing {clients.length} of {clientsTotal} clients, alphabetically. Use the search box to find anyone else — it searches every client, not just this page.
              </p>
            )}

            {clientView === 'accounts' && (filteredClients.length === 0 ? (
              <p style={{ fontSize: 14, color: '#9A938A' }}>
                {clientsLoading
                  ? 'Searching…'
                  : clientSearch.trim()
                    ? 'No clients match that search.'
                    : 'No clients yet. Add one to get started.'}
              </p>
            ) : (
              <div className="admin-table-scroll" style={styles.table}>
                <div className="admin-table-inner" style={styles.tableHead}>
                  <span>Client</span><span>Phone</span><span>Card on file</span><span>Hair notes</span><span>Actions</span>
                </div>
                {filteredClients.map(c => (
                  <div key={c.id} className="admin-table-inner" style={styles.tableRow}>
                    <div style={styles.svcName}>{c.full_name || '(no name)'}</div>
                    <span style={styles.cell}>{c.phone || '—'}</span>
                    <span style={styles.cell}>{c.stripe_customer_id ? 'Yes' : '—'}</span>
                    <span>
                      <button onClick={() => openNotesModal(c)} style={styles.editBtn}>Notes</button>
                    </span>
                    <div style={styles.actions}>
                      <button onClick={() => openCardModal(c)} style={styles.editBtn}>
                        {c.stripe_customer_id ? 'Manage card' : 'Add card'}
                      </button>
                      <button onClick={() => openEditClient(c)} style={styles.editBtn}>Edit</button>
                      <button onClick={() => deleteClient(c)} style={styles.deleteBtn}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Team Tab */}
        {tab === 'team' && (
          <div>
            <p style={{ fontSize: 14, color: '#9A938A', marginBottom: 20, lineHeight: 1.6, maxWidth: 640 }}>
              Your staff and admins. <strong>Staff</strong> are bookable and can have availability and services.
              {' '}<strong>Admins</strong> can manage everything and are also bookable. As an admin, you already appear in the Availability and Staff &amp; Services tabs.
              {' '}Clients are managed in the <strong>Clients</strong> tab — to make one of them staff, use the search below.
            </p>
            {[...staff]
              .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
              .map(p => renderRoleRow(p))}

            {staff.length === 0 && (
              <p style={{ fontSize: 14, color: '#9A938A' }}>No staff or admins yet.</p>
            )}

            {/* Clients live in their own tab. Reach them here only by name, so a
                full client book doesn't bury the actual team. */}
            <div style={{ marginTop: 36, borderTop: '1px solid #2A2A2A', paddingTop: 24 }}>
              <h3 style={{ fontFamily: "'Cormorant', serif", fontSize: 20, color: '#D8BC7E', margin: '0 0 6px' }}>Promote a Client</h3>
              <p style={{ color: '#9A938A', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.5, maxWidth: 640 }}>
                Search for a client by name or phone to make them Staff or an Admin. They'll move up into the list above once their role changes.
              </p>
              <input
                className="form-input"
                style={{ maxWidth: 280, marginBottom: 16 }}
                placeholder="Search clients by name or phone…"
                value={promoteSearch}
                onChange={e => setPromoteSearch(e.target.value)}
              />
              {promoteLoading && <p style={{ fontSize: 14, color: '#9A938A' }}>Searching…</p>}
              {!promoteLoading && promoteSearched && promoteResults.length === 0 && (
                <p style={{ fontSize: 14, color: '#9A938A' }}>No clients match that search.</p>
              )}
              {!promoteLoading && promoteResults.map(p => renderRoleRow(p))}
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
                      <div key={i} className="admin-day-row" style={styles.dayRow}>
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

                {/* Time off / blocked dates */}
                <div style={{ marginTop: 36, borderTop: '1px solid #2A2A2A', paddingTop: 24 }}>
                  <h3 style={{ fontFamily: "'Cormorant', serif", fontSize: 20, color: '#D8BC7E', margin: '0 0 6px' }}>Time Off / Blocked Dates</h3>
                  <p style={{ color: '#9A938A', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.5 }}>
                    Block whole days (vacation, holidays) or just part of a day. Leave the times blank to block the whole day; add a start and end time to block only that window. Blocked times override the weekly schedule — no bookings can be made during them.
                  </p>

                  {timeOff.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {timeOff.map(b => (
                        <div key={b.id} style={styles.timeOffRow}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{formatDateRange(b.start_date, b.end_date)}</span>
                            <span style={{ color: '#D8BC7E', fontSize: 13, marginLeft: 8 }}>{formatTimeOffWindow(b)}</span>
                            {b.reason && <span style={{ color: '#9A938A', fontSize: 13, marginLeft: 8 }}>· {b.reason}</span>}
                          </div>
                          <button onClick={() => removeTimeOff(b.id)} style={styles.timeOffRemove}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="admin-day-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">From</label>
                      <input type="date" className="form-input" style={{ width: 160 }} value={toForm.start_date}
                        onChange={e => setToForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">To</label>
                      <input type="date" className="form-input" style={{ width: 160 }} value={toForm.end_date} min={toForm.start_date || undefined}
                        onChange={e => setToForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Start time <span style={{ color: '#6E6A63' }}>(optional)</span></label>
                      <input type="time" className="form-input" style={{ width: 130 }} value={toForm.start_time}
                        onChange={e => setToForm(f => ({ ...f, start_time: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">End time <span style={{ color: '#6E6A63' }}>(optional)</span></label>
                      <input type="time" className="form-input" style={{ width: 130 }} value={toForm.end_time} min={toForm.start_time || undefined}
                        onChange={e => setToForm(f => ({ ...f, end_time: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                      <label className="form-label">Reason (optional)</label>
                      <input type="text" className="form-input" placeholder="Vacation" value={toForm.reason}
                        onChange={e => setToForm(f => ({ ...f, reason: e.target.value }))} />
                    </div>
                    <button onClick={addTimeOff} style={styles.addBtn}>Add Block</button>
                  </div>
                  {toErr && <p style={{ color: '#f8a3a3', fontSize: 13, marginTop: 8 }}>{toErr}</p>}
                </div>
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
              <div className="admin-table-scroll" style={styles.table}>
                <div className="admin-disc-inner" style={styles.discHead}>
                  <span>Code</span><span>Discount</span><span>Scope</span><span>Expires</span><span>Status</span><span>Actions</span>
                </div>
                {discounts.map(d => (
                  <div key={d.id} className="admin-disc-inner" style={styles.discRow}>
                    <span style={styles.svcName}>
                      {d.code}
                      {d.admin_only && <span style={styles.pillAdminOnly} title="Customers cannot enter this code — apply it from an appointment at checkout.">Salon only</span>}
                    </span>
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

        {/* Payments / Reconciliation Tab */}
        {tab === 'payments' && (
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">From</label>
                <input className="form-input" type="date" value={payFrom} onChange={e => setPayFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">To</label>
                <input className="form-input" type="date" value={payTo} onChange={e => setPayTo(e.target.value)} />
              </div>
              <button onClick={exportPaymentsCsv} style={styles.addBtn} disabled={!payments.length}>Export CSV</button>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {['card', 'cash', 'check', 'other'].map(m => (
                <div key={m} style={styles.totalCard}>
                  <div style={styles.totalLabel}>{m}</div>
                  <div style={styles.totalValue}>${(((payTotals.by_method?.[m]) || 0) / 100).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ ...styles.totalCard, borderColor: '#C8A24B' }}>
                <div style={{ ...styles.totalLabel, color: '#C8A24B' }}>Total</div>
                <div style={{ ...styles.totalValue, color: '#C8A24B' }}>${((payTotals.total_cents || 0) / 100).toFixed(2)}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#9A938A', marginBottom: 16, lineHeight: 1.5 }}>
              Reconcile the <strong>card</strong> total against your Stripe payouts, and the <strong>cash</strong>/<strong>check</strong> totals against your drawer and bank deposits.
            </p>

            {payLoading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : payments.length === 0 ? (
              <p style={{ fontSize: 14, color: '#9A938A' }}>No payments in this date range.</p>
            ) : (
              <div className="admin-table-scroll" style={styles.table}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>{['Date', 'Method', 'Amount', 'Client', 'Service', 'Note'].map(h => <th key={h} style={styles.payTh}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={styles.payTd}>{new Date(p.created_at).toLocaleDateString('en-US')}</td>
                        <td style={styles.payTd}>{p.method}{p.kind === 'fee' ? ' (fee)' : ''}{p.kind === 'refund' ? ' (refund)' : ''}</td>
                        <td style={styles.payTd}>${(p.amount_cents / 100).toFixed(2)}</td>
                        <td style={styles.payTd}>{p.client?.full_name || '—'}</td>
                        <td style={styles.payTd}>{p.appointment?.service?.name || '—'}</td>
                        <td style={styles.payTd}>{p.note || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Gallery Tab */}
        {tab === 'gallery' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: '#9A938A', margin: 0 }}>
                Photos here appear in the "Our Work" section of the website, newest first.
              </p>
              <label style={{ ...styles.addBtn, cursor: 'pointer', opacity: uploadingCount > 0 ? 0.6 : 1 }}>
                {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : '+ Add Photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingCount > 0}
                  style={{ display: 'none' }}
                  onChange={e => { uploadGalleryFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
            </div>
            {galleryLoading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : gallery.length === 0 ? (
              <p style={{ fontSize: 14, color: '#9A938A', padding: '24px 0' }}>
                No photos yet. Tap "Add Photos" and pick your favorite work — they'll show up on the home page right away.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
                {gallery.map(p => (
                  <div key={p.name} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #2A2A2A', aspectRatio: '1' }}>
                    <img src={p.url} alt="Gallery" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button
                      onClick={() => deleteGalleryPhoto(p.name)}
                      title="Remove photo"
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(14,14,16,0.75)', color: '#fff',
                        border: 'none', borderRadius: 6, width: 28, height: 28,
                        cursor: 'pointer', fontSize: 14, lineHeight: 1,
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Business Info Tab */}
        {tab === 'business' && (
          <BusinessInfoTab token={session?.access_token} notify={notify} />
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

      {/* Add / Edit Client Modal */}
      <Modal open={clientModal} onClose={() => setClientModal(false)} title={editClient ? 'Edit Client' : 'Add Client'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!editClient && (
            <p style={{ fontSize: 13, color: '#9A938A', lineHeight: 1.6 }}>
              Creates a client record so you can book appointments for them. They'll get
              booking confirmations at this email, and can claim the account later with
              "Forgot password" if they ever want to sign in.
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={clientForm.full_name}
              onChange={e => setClientForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={clientForm.email}
              onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={clientForm.phone}
              onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
          </div>
          <button onClick={saveClient} disabled={savingClient} style={styles.saveAvailBtn}>
            {savingClient ? 'Saving…' : (editClient ? 'Save Changes' : 'Add Client')}
          </button>
        </div>
      </Modal>

      {/* Client Service Notes Modal */}
      <Modal open={!!notesModal} onClose={() => setNotesModal(null)} title={`Hair Notes — ${notesModal?.client?.full_name || ''}`}>
        {notesModal?.loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : notesModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Add a note</label>
              <textarea
                className="form-input form-textarea"
                style={{ minHeight: 80 }}
                placeholder="e.g. Full highlight — 6N + 20vol, 45 min. Loves the copper tone, wants it brighter next time."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
            </div>
            <button onClick={addNote} disabled={savingNote || !noteText.trim()} style={styles.saveAvailBtn}>
              {savingNote && !editingNote ? 'Saving…' : 'Save Note'}
            </button>

            {notesModal.notes.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9A938A' }}>No notes yet. Jot down formulas, timings, and what they loved — it'll all be here next visit.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
                {notesModal.notes.map(n => (
                  <div key={n.id} style={{ background: '#1E1E22', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: '#9A938A', marginBottom: 6 }}>
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {n.author?.full_name ? ` · ${n.author.full_name}` : ''}
                    </div>
                    {editingNote?.id === n.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          className="form-input form-textarea"
                          style={{ minHeight: 70 }}
                          value={editingNote.body}
                          onChange={e => setEditingNote(en => ({ ...en, body: e.target.value }))}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={saveNoteEdit} disabled={savingNote || !editingNote.body.trim()} style={styles.editBtn}>Save</button>
                          <button onClick={() => setEditingNote(null)} style={styles.editBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: '#EDE7DB', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.body}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => setEditingNote({ id: n.id, body: n.body })} style={styles.editBtn}>Edit</button>
                          <button onClick={() => deleteNote(n.id)} style={styles.deleteBtn}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Card on File Modal */}
      <Modal open={!!cardModal} onClose={() => setCardModal(null)} title={`Card on File — ${cardModal?.client?.full_name || ''}`}>
        {cardModal?.loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : cardModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cardModal.cards.length > 0 && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#9A938A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Saved cards</p>
                {cardModal.cards.map(card => (
                  <div key={card.id} style={{ fontSize: 14, color: '#EDE7DB', padding: '6px 0' }}>
                    💳 {card.brand?.toUpperCase()} •••• {card.last4} — exp {card.exp_month}/{card.exp_year}
                  </div>
                ))}
                <div className="divider" style={{ margin: '12px 0' }} />
                <p style={{ fontSize: 13, color: '#9A938A' }}>Add a new card below (it becomes an additional card on file):</p>
              </div>
            )}
            {cardModal.clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret: cardModal.clientSecret }}>
                <CardSetupForm
                  clientSecret={cardModal.clientSecret}
                  onSuccess={onCardSaved}
                  onError={() => {}}
                />
              </Elements>
            )}
            <p style={{ fontSize: 12, color: '#9A938A', lineHeight: 1.5 }}>
              Card details go directly to Stripe — they're never stored on our server.
            </p>
          </div>
        )}
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
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={discForm.admin_only} style={{ accentColor: '#C8A24B' }}
              onChange={e => setDiscForm(f => ({ ...f, admin_only: e.target.checked }))} />
            Salon only (eligibility-gated)
          </label>
          <p style={{ fontSize: 12, color: '#9A938A', marginTop: -8 }}>
            For codes like military or first-responder discounts: customers can't enter this code
            at booking. You apply it to the appointment yourself at checkout, after verifying eligibility.
          </p>
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
  pillAdminOnly: { fontSize: 11, color: '#C8A24B', border: '1px solid rgba(200,162,75,0.4)', borderRadius: 999, padding: '2px 8px', marginLeft: 8, whiteSpace: 'nowrap' },
  totalCard: { background: '#16161A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 18px', minWidth: 110 },
  totalLabel: { fontSize: 11, textTransform: 'uppercase', color: '#9A938A', letterSpacing: '0.06em', marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: 700, color: '#EDE7DB' },
  payTh: { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A938A', borderBottom: '1px solid #2A2A2A', whiteSpace: 'nowrap' },
  payTd: { padding: '10px 12px', borderBottom: '1px solid #1F1F23', color: '#EDE7DB', verticalAlign: 'top' },
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
  timeOffRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1E1E22', border: '1px solid #2A2A2A', borderRadius: 10 },
  timeOffRemove: { padding: '6px 14px', borderRadius: 999, background: 'none', border: '1px solid #2A2A2A', color: '#C0392B', fontSize: 13, cursor: 'pointer' },
};
