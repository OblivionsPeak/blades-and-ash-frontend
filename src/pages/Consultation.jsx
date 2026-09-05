import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// The pre-visit consultation questionnaire. Option lists mirror the server's
// CONSULTATION_OPTIONS — anything else is dropped on save.
const OPTIONS = {
  services: ['Haircut', 'Color', 'Perm', 'Extensions'],
  length: ['Above shoulder', 'Below shoulder', 'Mid back', 'At waist', 'Below waist'],
  conditions: ['Pregnant', 'Postpartum', 'Menopause', 'None'],
  feel: ['Dry', 'Oily', 'Brittle', 'Healthy'],
  hairtype: ['Fine / straight', 'Curly', 'Coarse'],
  density: ['Thin', 'Thick', 'In between', 'Unsure'],
};

const EMPTY = {
  services: [],
  length: '',
  cut_frequency: '',
  chemical_frequency: '',
  color_before: '',
  last_color_date: '',
  perm_before: '',
  last_perm_date: '',
  ext_before: '',
  ext_type: '',
  ext_feedback: '',
  meds: '',
  meds_list: '',
  conditions: [],
  allergies: '',
  allergies_list: '',
  wash_frequency: '',
  colorblind: '',
  feel: [],
  hairtype: '',
  density: '',
  goals: '',
  likes_dislikes: '',
};

export default function Consultation() {
  const { user, profile, session } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [a, setA] = useState(EMPTY);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (profile?.full_name && !name) setName(profile.full_name);
    if (profile?.phone && !phone) setPhone(profile.phone);
    if (user?.email && !email) setEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  const set = (key) => (value) => setA(prev => ({ ...prev, [key]: value }));

  function toggleMulti(key, option, exclusive = null) {
    setA(prev => {
      const cur = prev[key];
      let next;
      if (cur.includes(option)) next = cur.filter(x => x !== option);
      else if (exclusive && option === exclusive) next = [option];
      else next = [...cur.filter(x => x !== exclusive), option];
      return { ...prev, [key]: next };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (a.services.length === 0) {
      setErr('Please pick at least one service.');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitConsultation(
        { client_name: name, client_email: email, client_phone: phone, answers: a },
        session?.access_token
      );
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (ex) {
      setErr(ex.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="form-page">
        <div className="form-page-head">
          <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
          <h1 className="form-page-title">Got it, {name.split(' ')[0] || 'friend'}.</h1>
          <p className="form-page-sub">Thanks for the details — your stylist will read them before you sit down.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/waiver" className="btn btn-primary">Sign the client agreement</Link>
          <Link to="/book" className="btn btn-outline">Book an appointment</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="form-page-head">
        <span className="form-page-label">BLADES &amp; ASH STUDIO</span>
        <h1 className="form-page-title">Client Consultation</h1>
        <p className="form-page-sub">Tell us about your hair, so we get it right the first time.</p>
      </div>

      <form onSubmit={submit}>
        <section className="form-section">
          <div className="form-section-title">Client Information</div>
          <div className="form-row">
            <div className="form-field form-group">
              <label className="form-label" htmlFor="c-name">Name</label>
              <input id="c-name" className="form-input" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            </div>
            <div className="form-field form-group">
              <label className="form-label" htmlFor="c-email">Email</label>
              <input id="c-email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-field form-group">
              <label className="form-label" htmlFor="c-phone">Phone</label>
              <input id="c-phone" className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
            </div>
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Service Requested</div>
          <div className="form-field">
            <span className="form-q">What service are you wanting?</span>
            <Chips options={OPTIONS.services} value={a.services} onToggle={o => toggleMulti('services', o)} multi />
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Current Hair</div>
          <div className="form-field">
            <span className="form-q">What is your current hair length?</span>
            <Chips options={OPTIONS.length} value={a.length} onSelect={set('length')} />
          </div>
          <div className="form-row">
            <TextField label="How often do you get your hair cut?" value={a.cut_frequency} onChange={set('cut_frequency')} />
            <TextField label="How many weeks between chemical services?" hint="Color, perm, etc." value={a.chemical_frequency} onChange={set('chemical_frequency')} />
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Color History</div>
          <div className="form-field">
            <span className="form-q">Have you had your hair colored or lightened before?</span>
            <YesNo value={a.color_before} onChange={set('color_before')} />
            {a.color_before === 'yes' && (
              <div className="form-conditional">
                <TextField label="When was your last color service?" value={a.last_color_date} onChange={set('last_color_date')} />
              </div>
            )}
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Perm History</div>
          <div className="form-field">
            <span className="form-q">Have you had a perm before?</span>
            <YesNo value={a.perm_before} onChange={set('perm_before')} />
            {a.perm_before === 'yes' && (
              <div className="form-conditional">
                <TextField label="When was your last perm service?" value={a.last_perm_date} onChange={set('last_perm_date')} />
              </div>
            )}
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Extension History</div>
          <div className="form-field">
            <span className="form-q">Have you had extensions before?</span>
            <YesNo value={a.ext_before} onChange={set('ext_before')} />
            {a.ext_before === 'yes' && (
              <div className="form-conditional">
                <TextField label="What type of extensions?" value={a.ext_type} onChange={set('ext_type')} />
                <TextArea label="What did you like or dislike about them?" value={a.ext_feedback} onChange={set('ext_feedback')} />
              </div>
            )}
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Health &amp; Wellness</div>
          <p className="form-hint" style={{ margin: '0 0 18px' }}>
            This helps us understand how your hair and skin may respond to services — it stays confidential.
          </p>
          <div className="form-field">
            <span className="form-q">Are you on any medications?</span>
            <YesNo value={a.meds} onChange={set('meds')} />
            {a.meds === 'yes' && (
              <div className="form-conditional">
                <TextField label="What medications are you on?" hint="e.g. GLP-1, thyroid, antidepressant, etc." value={a.meds_list} onChange={set('meds_list')} />
              </div>
            )}
          </div>
          <div className="form-field">
            <span className="form-q">Do any of the following currently apply?</span>
            <Chips options={OPTIONS.conditions} value={a.conditions} onToggle={o => toggleMulti('conditions', o, 'None')} multi />
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Allergies</div>
          <div className="form-field">
            <span className="form-q">Are you allergic to any products or smells?</span>
            <YesNo value={a.allergies} onChange={set('allergies')} />
            {a.allergies === 'yes' && (
              <div className="form-conditional">
                <TextField label="What kind?" value={a.allergies_list} onChange={set('allergies_list')} />
              </div>
            )}
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Hair Profile</div>
          <div className="form-row">
            <TextField label="How many times a week do you wash your hair?" value={a.wash_frequency} onChange={set('wash_frequency')} />
            <div className="form-field">
              <span className="form-q">Are you color blind?</span>
              <span className="form-hint">It helps us know what you're seeing versus what we're seeing.</span>
              <YesNo value={a.colorblind} onChange={set('colorblind')} />
            </div>
          </div>
          <div className="form-field">
            <span className="form-q">How does your hair feel to you?</span>
            <Chips options={OPTIONS.feel} value={a.feel} onToggle={o => toggleMulti('feel', o)} multi />
          </div>
          <div className="form-field">
            <span className="form-q">What is your hair type?</span>
            <Chips options={OPTIONS.hairtype} value={a.hairtype} onSelect={set('hairtype')} />
          </div>
          <div className="form-field">
            <span className="form-q">Is your hair thin, thick, in between, or unsure?</span>
            <Chips options={OPTIONS.density} value={a.density} onSelect={set('density')} />
          </div>
        </section>

        <div className="form-divider" />

        <section className="form-section">
          <div className="form-section-title">Goals</div>
          <TextArea label="What are your hair goals?" value={a.goals} onChange={set('goals')} />
          <TextArea label="What do you like and dislike about your current hair?" value={a.likes_dislikes} onChange={set('likes_dislikes')} />
        </section>

        {err && <p className="form-error" style={{ marginBottom: 16 }}>{err}</p>}

        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit Consultation'}
        </button>
      </form>
    </div>
  );
}

// ── Field helpers ────────────────────────────────────────────

// Single- or multi-select chips. Single: `value` is a string and onSelect
// receives the option (re-clicking clears it). Multi: `value` is an array and
// onToggle receives the option.
function Chips({ options, value, onSelect, onToggle, multi = false }) {
  return (
    <div className="chips">
      {options.map(o => {
        const checked = multi ? value.includes(o) : value === o;
        return (
          <label key={o} className="chip">
            <input
              type={multi ? 'checkbox' : 'radio'}
              checked={checked}
              onChange={() => (multi ? onToggle(o) : onSelect(o))}
              onClick={() => { if (!multi && checked) onSelect(''); }}
            />
            <span>{o}</span>
          </label>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="chips">
      {[['yes', 'Yes'], ['no', 'No']].map(([v, label]) => (
        <label key={v} className="chip">
          <input type="radio" checked={value === v} onChange={() => onChange(v)} />
          <span style={{ minWidth: 60, textAlign: 'center' }}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function TextField({ label, hint, value, onChange }) {
  return (
    <div className="form-field">
      <label className="form-q">
        {label}
        {hint && <span className="form-hint" style={{ marginTop: 2 }}>{hint}</span>}
        <input className="form-input" value={value} onChange={e => onChange(e.target.value)} style={{ marginTop: hint ? 0 : 6 }} />
      </label>
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="form-field">
      <label className="form-q">
        {label}
        <textarea className="form-input form-textarea" value={value} onChange={e => onChange(e.target.value)} style={{ marginTop: 6 }} />
      </label>
    </div>
  );
}
