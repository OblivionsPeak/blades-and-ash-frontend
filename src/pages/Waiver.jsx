import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useSettings } from '../hooks/useSettings';
import SignaturePad from '../components/SignaturePad';

// The Client Service Agreement, Liability Waiver & Release — read, then sign.
// The agreement text comes from the API so the page, the stored record, and
// the emailed copy all carry the same wording and version.
export default function Waiver() {
  const { user, profile, session } = useAuth();
  const s = useSettings();

  const [doc, setDoc] = useState(null);
  const [docErr, setDocErr] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isGuardian, setIsGuardian] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null); // { form, emailed }

  useEffect(() => {
    api.getWaiverText().then(setDoc).catch(() => setDocErr('Could not load the agreement. Please refresh and try again.'));
  }, []);

  // Pre-fill from the signed-in account; anything typed wins.
  useEffect(() => {
    if (profile?.full_name && !name) setName(profile.full_name);
    if (profile?.phone && !phone) setPhone(profile.phone);
    if (user?.email && !email) setEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  const addressText = [s.address_line, [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    || 'Suite 10, 260 Needmore Rd, Clarksville, TN';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!agreed) return setErr('Please confirm you have read and agree to the agreement.');
    if (!signature) return setErr('Please sign in the signature box.');
    setSubmitting(true);
    try {
      const res = await api.submitWaiver(
        {
          client_name: name,
          client_email: email,
          client_phone: phone,
          is_guardian: isGuardian,
          guardian_name: guardianName,
          agreed: true,
          signature,
        },
        session?.access_token
      );
      setDone(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (ex) {
      setErr(ex.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const when = new Date(done.form.created_at).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return (
      <div className="form-page">
        <div className="form-page-head">
          <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
          <h1 className="form-page-title">Thank you, {name.split(' ')[0] || 'friend'}.</h1>
          <p className="form-page-sub">Your agreement is signed and on file.</p>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <Row label="Signed" value={when} />
          <Row label="Name" value={name} />
          {isGuardian && <Row label="Parent / guardian" value={guardianName} />}
          <Row label="Copy sent to" value={done.emailed ? email : 'We could not send the email copy — use Print below to keep one.'} />
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, color: '#9A938A', marginBottom: 8 }}>Your signature</p>
            <img src={signature} alt="Your signature" style={{ maxWidth: 320, width: '100%', borderRadius: 8, border: '1px solid #2A2A2A', background: '#fff' }} />
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/consultation" className="btn btn-primary">Fill out the consultation form</Link>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>Print a copy</button>
          <Link to="/book" className="btn btn-ghost">Book an appointment</Link>
        </div>

        {/* Printable copy of the full agreement, hidden on screen. */}
        {doc && (
          <div className="print-only" style={{ marginTop: 32 }}>
            <AgreementText doc={doc} addressText={addressText} />
            <p style={{ marginTop: 24, fontSize: 13 }}>Client name (printed): {name}</p>
            {isGuardian && <p style={{ fontSize: 13 }}>Parent / guardian: {guardianName}</p>}
            <p style={{ fontSize: 13 }}>Signed: {when} · Agreement version {done.form.agreement_version}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="form-page-head">
        <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
        <h1 className="form-page-title">Client Agreement &amp; Waiver</h1>
        <p className="form-page-sub">Please read in full, then sign below. It only takes a minute.</p>
      </div>

      {docErr && <p className="form-error" style={{ textAlign: 'center', marginBottom: 24 }}>{docErr}</p>}
      {!doc && !docErr && <div className="loading-center"><div className="spinner" /></div>}

      {doc && (
        <form onSubmit={submit}>
          <AgreementText doc={doc} addressText={addressText} />

          <div className="form-divider" />

          <div className="form-section">
            <div className="form-section-title">Your details</div>
            <div className="form-row">
              <div className="form-field form-group">
                <label className="form-label" htmlFor="w-name">{isGuardian ? "Client's full name (the minor)" : 'Full name (printed)'}</label>
                <input id="w-name" className="form-input" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
              </div>
              <div className="form-field form-group">
                <label className="form-label" htmlFor="w-email">Email</label>
                <input id="w-email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                <span className="form-hint" style={{ margin: '4px 0 0' }}>We'll email you a copy of what you signed.</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field form-group">
                <label className="form-label" htmlFor="w-phone">Phone</label>
                <input id="w-phone" className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            </div>

            <label className="agree-row" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={isGuardian} onChange={e => setIsGuardian(e.target.checked)} />
              <span>I am signing as the parent or legal guardian of a client under 18.</span>
            </label>
            {isGuardian && (
              <div className="form-conditional form-field form-group" style={{ marginTop: 14 }}>
                <label className="form-label" htmlFor="w-guardian">Parent / guardian full name</label>
                <input id="w-guardian" className="form-input" value={guardianName} onChange={e => setGuardianName(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="form-section-title">Signature</div>
            <label className="agree-row" style={{ marginBottom: 18 }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span>
                I have read this entire agreement, I understand its terms, and I voluntarily agree to be bound by them.
                I confirm I am 18 or older, or am signing as the parent/legal guardian of a minor client.
              </span>
            </label>
            <SignaturePad onChange={setSignature} disabled={submitting} />
          </div>

          {err && <p className="form-error" style={{ marginBottom: 16 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !agreed || !signature}>
              {submitting ? 'Saving…' : 'Sign & Submit'}
            </button>
            <span style={{ fontSize: 12, color: '#9A938A' }}>
              Signed electronically · agreement version {doc.version}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

function AgreementText({ doc, addressText }) {
  return (
    <div className="agreement">
      <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.08em', color: '#9A938A', marginBottom: 4 }}>
        {addressText} · bladeandash.com
      </p>
      <h2 style={{ textAlign: 'center', fontSize: 22, marginBottom: 18 }}>{doc.title}</h2>
      <p style={{ marginBottom: 8 }}>{doc.intro}</p>
      {doc.sections.map(sec => (
        <div key={sec.title}>
          <h3>{sec.title}</h3>
          <p>{sec.body}</p>
          {sec.bullets?.length > 0 && (
            <ul>{sec.bullets.map(b => <li key={b}>{b}</li>)}</ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid #2A2A2A' }}>
      <span style={{ color: '#9A938A', fontSize: 14, flex: '0 0 auto' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
