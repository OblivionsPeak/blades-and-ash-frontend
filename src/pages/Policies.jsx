import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Public studio policies. Rendered from the same agreement text clients sign
// on the waiver page, so what the website says and what they sign never
// disagree. The signature-specific acknowledgment section is left off.
export default function Policies() {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getWaiverText().then(setDoc).catch(() => setErr('Could not load the policies. Please refresh and try again.'));
  }, []);

  const sections = (doc?.sections || []).filter(s => !/acknowledgment/i.test(s.title));

  return (
    <div className="form-page">
      <div className="form-page-head">
        <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
        <h1 className="form-page-title">Studio Policies</h1>
        <p className="form-page-sub">The short version: book with a card on file, give us 72 hours if plans change.</p>
      </div>

      {/* The bit most people are looking for, up top and in plain words. */}
      <div className="card" style={{ padding: 28, marginBottom: 28, borderColor: '#9A7531' }}>
        <h2 style={{ fontSize: 24, marginBottom: 14 }}>Cancellation policy</h2>
        <ul style={{ margin: '0 0 0 20px', color: '#D6CFC5', fontSize: 15, lineHeight: 1.8 }}>
          <li><strong style={{ color: '#EDE7DB' }}>72+ hours' notice:</strong> no charge. Reschedule or cancel freely.</li>
          <li><strong style={{ color: '#EDE7DB' }}>Less than 72 hours:</strong> 50% of the service fee is charged to the card on file.</li>
          <li><strong style={{ color: '#EDE7DB' }}>Same day or no-show:</strong> 100% of the service fee is charged to the card on file.</li>
        </ul>
        <p style={{ marginTop: 16, fontSize: 14, color: '#9A938A', lineHeight: 1.6 }}>
          Life happens — if something comes up, message us as early as you can and we'll do our best to work with you.
        </p>
      </div>

      {err && <p className="form-error" style={{ textAlign: 'center' }}>{err}</p>}
      {!doc && !err && <div className="loading-center"><div className="spinner" /></div>}

      {doc && (
        <div className="agreement">
          {sections.map(sec => (
            <div key={sec.title}>
              <h3>{sec.title.replace(/^\d+\.\s*/, '')}</h3>
              <p>{sec.body}</p>
              {sec.bullets?.length > 0 && <ul>{sec.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
            </div>
          ))}
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 32 }}>
        <Link to="/waiver" className="btn btn-primary">Sign the client agreement</Link>
        <Link to="/book" className="btn btn-outline">Book an appointment</Link>
      </div>
    </div>
  );
}
