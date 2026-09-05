import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// Landing page for the two client forms. Signed-in clients see what they
// already have on file; everyone else just gets the two doors.
export default function Forms() {
  const { user, session } = useAuth();
  const [mine, setMine] = useState(null);

  useEffect(() => {
    if (!session?.access_token) { setMine(null); return; }
    api.getMyForms(session.access_token).then(setMine).catch(() => setMine(null));
  }, [session]);

  const waiver = mine?.forms?.waiver;
  const consult = mine?.forms?.consultation;
  const waiverStale = waiver && mine?.current_waiver_version && waiver.agreement_version !== mine.current_waiver_version;

  return (
    <div className="form-page">
      <div className="form-page-head">
        <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
        <h1 className="form-page-title">Client Forms</h1>
        <p className="form-page-sub">Two quick forms before your first visit. Both take a few minutes on your phone.</p>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <FormCard
          step="1"
          title="Client Agreement & Waiver"
          desc="Our service agreement, cancellation policy, photo release, and liability waiver. Read it, then sign with your finger."
          to="/waiver"
          cta={waiver ? 'Sign again' : 'Read & sign'}
          status={
            !user ? null
              : waiver
                ? (waiverStale ? `Signed ${fmt(waiver.created_at)} · an updated version is available` : `Signed ${fmt(waiver.created_at)}`)
                : 'Not signed yet'
          }
          done={!!waiver && !waiverStale}
        />
        <FormCard
          step="2"
          title="Consultation Form"
          desc="Tell us about your hair — history, health, allergies, and goals — so we get it right the first time."
          to="/consultation"
          cta={consult ? 'Update my answers' : 'Fill it out'}
          status={!user ? null : consult ? `Submitted ${fmt(consult.created_at)}` : 'Not filled out yet'}
          done={!!consult}
        />
      </div>

      <div className="card" style={{ marginTop: 28, padding: '20px 24px' }}>
        <p style={{ fontSize: 14, color: '#9A938A', lineHeight: 1.7 }}>
          Prefer paper? Both forms can be filled out in the studio at your appointment.
          Have a question about our policies first? <Link to="/policies" style={{ color: '#C8A24B' }}>Read them here.</Link>
        </p>
      </div>
    </div>
  );
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FormCard({ step, title, desc, to, cta, status, done }) {
  return (
    <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ color: '#C8A24B', fontSize: 12, letterSpacing: '0.2em' }}>STEP {step}</span>
      <h2 style={{ fontSize: 26 }}>{title}</h2>
      <p style={{ color: '#9A938A', fontSize: 14.5, lineHeight: 1.7, flex: 1 }}>{desc}</p>
      {status && (
        <p style={{ fontSize: 13, color: done ? '#6FCF97' : '#D8BC7E' }}>
          {done ? '✓ ' : ''}{status}
        </p>
      )}
      <Link to={to} className={`btn ${done ? 'btn-outline' : 'btn-primary'}`} style={{ alignSelf: 'flex-start' }}>{cta}</Link>
    </div>
  );
}
