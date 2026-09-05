// Read-only rendering of one client form submission (waiver or consultation)
// for the admin, plus a print helper that opens a plain white copy.

export const KIND_LABEL = { waiver: 'Agreement & Waiver', consultation: 'Consultation' };

export function fmtWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Consultation questions in display order. Keys match the server's data shape.
const CONSULT_SECTIONS = [
  { title: 'Service requested', rows: [['services', 'Service wanted']] },
  {
    title: 'Current hair',
    rows: [['length', 'Current length'], ['cut_frequency', 'How often cut'], ['chemical_frequency', 'Weeks between chemical services']],
  },
  { title: 'Color history', rows: [['color_before', 'Colored or lightened before'], ['last_color_date', 'Last color service']] },
  { title: 'Perm history', rows: [['perm_before', 'Had a perm before'], ['last_perm_date', 'Last perm service']] },
  { title: 'Extension history', rows: [['ext_before', 'Had extensions before'], ['ext_type', 'Type'], ['ext_feedback', 'Liked / disliked']] },
  { title: 'Health & wellness', rows: [['meds', 'On medications'], ['meds_list', 'Medications'], ['conditions', 'Currently applies']] },
  { title: 'Allergies', rows: [['allergies', 'Allergic to products or smells'], ['allergies_list', 'What kind']] },
  {
    title: 'Hair profile',
    rows: [['wash_frequency', 'Washes per week'], ['colorblind', 'Color blind'], ['feel', 'Hair feels'], ['hairtype', 'Hair type'], ['density', 'Density']],
  },
  { title: 'Goals', rows: [['goals', 'Hair goals'], ['likes_dislikes', 'Likes / dislikes about current hair']] },
];

function show(v) {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '';
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  return v || '';
}

// Rows with an empty answer are skipped so the view reads like a summary,
// not a blank form.
export function consultationRows(data = {}) {
  return CONSULT_SECTIONS.map(sec => ({
    title: sec.title,
    rows: sec.rows.map(([k, label]) => [label, show(data[k])]).filter(([, v]) => v !== ''),
  })).filter(sec => sec.rows.length > 0);
}

export default function FormDetail({ form }) {
  if (!form) return null;
  const d = form.data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={styles.meta}>
        <Row label="Client" value={form.client_name} />
        {form.client_email && <Row label="Email" value={form.client_email} />}
        {form.client_phone && <Row label="Phone" value={form.client_phone} />}
        <Row label="Submitted" value={fmtWhen(form.created_at)} />
        {form.kind === 'waiver' && <Row label="Agreement version" value={form.agreement_version || '—'} />}
        {!form.client_id && <Row label="Account" value="Submitted without signing in" muted />}
      </div>

      {form.kind === 'waiver' ? (
        <div>
          {d.is_guardian && (
            <div style={styles.meta}>
              <Row label="Signed by parent / guardian" value={d.guardian_name || '—'} />
              <Row label="For minor client" value={d.printed_name || form.client_name} />
            </div>
          )}
          <p style={styles.sectionLabel}>Signature</p>
          {form.signature_data_url ? (
            <img src={form.signature_data_url} alt="Client signature" style={styles.sig} />
          ) : (
            <p style={{ fontSize: 13, color: '#9A938A' }}>No signature image stored.</p>
          )}
          <p style={{ fontSize: 12, color: '#9A938A', marginTop: 10, lineHeight: 1.5 }}>
            Signed electronically on the website. Agreed to the full Client Service Agreement, Liability Waiver &amp; Release
            (version {form.agreement_version || '—'}).
            {form.ip ? ` Recorded from ${form.ip}.` : ''}
          </p>
        </div>
      ) : (
        <div>
          {consultationRows(d).map(sec => (
            <div key={sec.title} style={{ marginBottom: 16 }}>
              <p style={styles.sectionLabel}>{sec.title}</p>
              <div style={styles.meta}>
                {sec.rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
              </div>
            </div>
          ))}
          {consultationRows(d).length === 0 && <p style={{ fontSize: 13, color: '#9A938A' }}>No answers were filled in.</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={{ ...styles.rowValue, color: muted ? '#9A938A' : '#EDE7DB' }}>{value}</span>
    </div>
  );
}

// Open a plain, printable copy in a new tab. Everything is escaped — the
// answers are client-typed text.
export function printForm(form) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const d = form.data || {};
  let body = '';
  if (form.kind === 'waiver') {
    body = `
      ${d.is_guardian ? `<p><b>Parent / guardian:</b> ${esc(d.guardian_name)}</p><p><b>Minor client:</b> ${esc(d.printed_name || form.client_name)}</p>` : ''}
      <p><b>Agreement version:</b> ${esc(form.agreement_version || '—')}</p>
      <p style="margin-top:20px;color:#666;font-size:12px">Signature</p>
      ${form.signature_data_url ? `<img src="${form.signature_data_url}" style="max-width:360px;border:1px solid #ccc;border-radius:6px" />` : '<p>(no signature image)</p>'}
      <p style="margin-top:16px;font-size:12px;color:#666">Signed electronically on bladeandash.com. The client agreed to the full Client Service Agreement, Liability Waiver &amp; Release.</p>`;
  } else {
    body = consultationRows(d).map(sec => `
      <h3 style="margin:18px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#555">${esc(sec.title)}</h3>
      <table style="border-collapse:collapse;width:100%">${sec.rows.map(([l, v]) => `<tr><td style="padding:5px 12px 5px 0;color:#666;width:42%;vertical-align:top">${esc(l)}</td><td style="padding:5px 0;vertical-align:top;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>`).join('');
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(form.client_name)} — ${esc(KIND_LABEL[form.kind] || form.kind)}</title>
    <style>body{font-family:Georgia,serif;color:#111;max-width:720px;margin:32px auto;padding:0 24px;font-size:14px;line-height:1.5}h1{font-size:22px;margin:0}h2{font-size:16px;margin:4px 0 18px;color:#444;font-weight:normal}p{margin:6px 0}</style></head>
    <body>
      <h1>Blades &amp; Ash Studio</h1>
      <h2>${esc(KIND_LABEL[form.kind] || form.kind)}</h2>
      <p><b>Client:</b> ${esc(form.client_name)}${form.client_email ? ` · ${esc(form.client_email)}` : ''}${form.client_phone ? ` · ${esc(form.client_phone)}` : ''}</p>
      <p><b>Submitted:</b> ${esc(fmtWhen(form.created_at))}</p>
      ${body}
      <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const styles = {
  meta: { background: '#0E0E10', border: '1px solid #2A2A2A', borderRadius: 10, padding: '4px 14px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid #1E1E22' },
  rowLabel: { fontSize: 13, color: '#9A938A', flex: '0 0 42%' },
  rowValue: { fontSize: 14, textAlign: 'right', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  sectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C8A24B', margin: '0 0 8px' },
  sig: { maxWidth: '100%', width: 360, display: 'block', background: '#fff', borderRadius: 8, border: '1px solid #2A2A2A' },
};
