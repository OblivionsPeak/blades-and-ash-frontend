import { useEffect, useState } from 'react';
import { api } from '../api';
import { invalidateSettings, DAY_KEYS, DAY_LABELS } from '../hooks/useSettings';

const EMPTY_DAY = { open: '10:00', close: '18:00', closed: false };

// Admin -> Business Info: address, phone, hours, socials. Everything is
// optional — whatever is filled in appears in the site footer and feeds the
// Google (LocalBusiness) listing data automatically.
export default function BusinessInfoTab({ token, notify }) {
  const [form, setForm] = useState({
    business_name: '', address_line: '', city: '', state: '', zip: '',
    phone: '', public_email: '', instagram: '', facebook: '', tiktok: '', maps_url: '',
  });
  // Per-day: { enabled, open, close, closed }
  const [days, setDays] = useState(() =>
    Object.fromEntries(DAY_KEYS.map((d) => [d, { enabled: false, ...EMPTY_DAY }]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setForm((f) => {
          const next = { ...f };
          for (const k of Object.keys(f)) if (typeof s[k] === 'string') next[k] = s[k];
          return next;
        });
        if (s.hours) {
          setDays((prev) => {
            const next = { ...prev };
            for (const d of DAY_KEYS) {
              const h = s.hours[d];
              if (!h) continue;
              next[d] = h.closed
                ? { enabled: true, ...EMPTY_DAY, closed: true }
                : { enabled: true, open: h.open, close: h.close, closed: false };
            }
            return next;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setDay(d, patch) {
    setDays((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));
  }

  async function save() {
    setSaving(true);
    try {
      const hours = {};
      for (const d of DAY_KEYS) {
        const v = days[d];
        if (!v.enabled) continue;
        hours[d] = v.closed ? { closed: true } : { open: v.open, close: v.close };
      }
      const saved = await api.updateSettings({ ...form, hours }, token);
      invalidateSettings(saved);
      notify('Business info saved — the website footer updates right away.');
    } catch (e) {
      notify(e.message || 'Could not save business info.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 14, color: '#9A938A', marginTop: 0 }}>
        Fill in what you have — anything you add shows up in the website footer and helps
        the studio appear correctly on Google. You can come back and finish later.
      </p>

      <h3 style={h3}>Location & contact</h3>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Business name" value={form.business_name} onChange={(v) => setField('business_name', v)} placeholder="Blades & Ash Studio" />
        <Field label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} placeholder="(931) 555-0123" />
        <Field label="Street address" value={form.address_line} onChange={(v) => setField('address_line', v)} placeholder="123 Main St, Suite B" />
        <Field label="Public email" value={form.public_email} onChange={(v) => setField('public_email', v)} placeholder="owner@bladeandash.com" />
        <Field label="City" value={form.city} onChange={(v) => setField('city', v)} placeholder="Clarksville" />
        <Field label="State" value={form.state} onChange={(v) => setField('state', v)} placeholder="TN" />
        <Field label="ZIP" value={form.zip} onChange={(v) => setField('zip', v)} placeholder="37040" />
        <Field label="Google Maps link (optional)" value={form.maps_url} onChange={(v) => setField('maps_url', v)} placeholder="https://maps.app.goo.gl/…" />
      </div>

      <h3 style={h3}>Hours</h3>
      <p style={hint}>Check the days you want listed. Uncheck a day to leave it off the site entirely.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAY_KEYS.map((d) => {
          const v = days[d];
          return (
            <div key={d} style={dayRow}>
              <label style={dayName}>
                <input type="checkbox" checked={v.enabled} onChange={(e) => setDay(d, { enabled: e.target.checked })} />
                <span style={{ marginLeft: 8 }}>{DAY_LABELS[d]}</span>
              </label>
              {v.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={closedLbl}>
                    <input type="checkbox" checked={v.closed} onChange={(e) => setDay(d, { closed: e.target.checked })} />
                    <span style={{ marginLeft: 6 }}>Closed</span>
                  </label>
                  {!v.closed && (
                    <>
                      <input className="form-input" type="time" value={v.open} onChange={(e) => setDay(d, { open: e.target.value })} style={timeInput} />
                      <span style={{ color: '#9A938A' }}>to</span>
                      <input className="form-input" type="time" value={v.close} onChange={(e) => setDay(d, { close: e.target.value })} style={timeInput} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 style={h3}>Social links</h3>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Instagram" value={form.instagram} onChange={(v) => setField('instagram', v)} placeholder="https://instagram.com/…" />
        <Field label="Facebook" value={form.facebook} onChange={(v) => setField('facebook', v)} placeholder="https://facebook.com/…" />
        <Field label="TikTok" value={form.tiktok} onChange={(v) => setField('tiktok', v)} placeholder="https://tiktok.com/@…" />
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={save} disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Business Info'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const h3 = { fontFamily: "'Cormorant', serif", color: '#fff', fontSize: 20, margin: '26px 0 10px' };
const hint = { fontSize: 13, color: '#9A938A', marginTop: 0 };
const dayRow = { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '6px 10px', border: '1px solid #2A2A2A', borderRadius: 8 };
const dayName = { minWidth: 120, color: '#D6CFC5', fontSize: 14, display: 'flex', alignItems: 'center' };
const closedLbl = { color: '#9A938A', fontSize: 13, display: 'flex', alignItems: 'center' };
const timeInput = { width: 110, padding: '6px 8px' };
const saveBtn = {
  background: '#C8A24B', color: '#0E0E10', border: 'none', borderRadius: 8,
  padding: '12px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
