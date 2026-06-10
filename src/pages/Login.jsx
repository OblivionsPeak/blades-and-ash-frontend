import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const from = location.state?.from || null;

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate(from || (profile?.role === 'client' ? '/profile' : '/dashboard'));
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErr(error.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id, full_name: fullName, phone, role: 'client',
      });
    }
    setLoading(false);
    setMsg('Account created! You can now sign in.');
    setTab('signin');
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.scissor}>✂</span>
          <span style={styles.brand}>BLADES & ASH STUDIO</span>
        </div>

        <div className="tab-bar" style={{ marginBottom: 28 }}>
          <button className={`tab-btn ${tab === 'signin' ? 'active' : ''}`} onClick={() => setTab('signin')}>Sign In</button>
          <button className={`tab-btn ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Create Account</button>
        </div>

        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}
        {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" minLength={6} />
            </div>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, background: '#F9F7F4',
  },
  card: {
    background: '#fff', borderRadius: 16,
    padding: 40, width: '100%', maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' },
  scissor: { color: '#C8A24B', fontSize: 22 },
  brand: { fontFamily: "'Cormorant', serif", fontSize: 18, letterSpacing: '0.08em', color: '#0E0E10' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  submitBtn: {
    marginTop: 8, padding: '14px', borderRadius: 999,
    background: '#0E0E10', color: '#C8A24B',
    border: 'none', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: "'Jost', sans-serif", letterSpacing: '0.04em',
  },
};
