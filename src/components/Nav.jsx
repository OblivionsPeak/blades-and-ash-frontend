import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Nav() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isStaff = profile?.role === 'staff' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const links = user
    ? [
        { to: '/book', label: 'Book' },
        ...(isStaff ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
        ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
        { to: '/profile', label: 'My Appointments' },
      ]
    : [
        { to: '/', label: 'Home' },
        { to: '/book', label: 'Book' },
      ];

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoScissors}>✂</span>
          <span style={styles.logoText}>BLADES & ASH</span>
        </Link>

        <div style={styles.links}>
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              style={{ ...styles.link, ...(location.pathname === l.to ? styles.linkActive : {}) }}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <button onClick={handleSignOut} style={styles.signOutBtn}>Sign Out</button>
          ) : (
            <Link to="/login" style={styles.loginBtn}>Sign In</Link>
          )}
        </div>

        <button style={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <span style={styles.burgerLine} />
          <span style={styles.burgerLine} />
          <span style={styles.burgerLine} />
        </button>
      </div>

      {menuOpen && (
        <div style={styles.drawer}>
          {links.map(l => (
            <Link key={l.to} to={l.to} style={styles.drawerLink} onClick={() => setMenuOpen(false)}>{l.label}</Link>
          ))}
          {user
            ? <button onClick={() => { handleSignOut(); setMenuOpen(false); }} style={styles.drawerLink}>Sign Out</button>
            : <Link to="/login" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Sign In</Link>
          }
        </div>
      )}
    </nav>
  );
}

const styles = {
  nav: {
    position: 'sticky', top: 0, zIndex: 100,
    background: '#0D0D0D',
    borderBottom: '1px solid #2A2A2A',
  },
  inner: {
    maxWidth: 1200, margin: '0 auto', padding: '0 24px',
    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
  },
  logoScissors: { color: '#C9A84C', fontSize: 20 },
  logoText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18, fontWeight: 700,
    color: '#FFFFFF',
    letterSpacing: '0.08em',
  },
  links: { display: 'flex', alignItems: 'center', gap: 4 },
  link: {
    padding: '8px 14px', borderRadius: 8,
    fontSize: 14, fontWeight: 500, color: '#CCCCCC',
    transition: 'color 0.2s',
    textDecoration: 'none',
  },
  linkActive: { color: '#C9A84C', fontWeight: 600 },
  loginBtn: {
    marginLeft: 8, padding: '8px 20px',
    background: '#C9A84C', color: '#0D0D0D',
    borderRadius: 999, fontSize: 14, fontWeight: 600,
    textDecoration: 'none', transition: 'background 0.2s',
  },
  signOutBtn: {
    marginLeft: 8, padding: '8px 20px',
    background: 'transparent', color: '#CCCCCC',
    border: '1px solid #444', borderRadius: 999,
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  burger: {
    display: 'none', flexDirection: 'column', gap: 5,
    background: 'none', border: 'none', cursor: 'pointer', padding: 8,
  },
  burgerLine: { display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2 },
  drawer: {
    display: 'flex', flexDirection: 'column',
    borderTop: '1px solid #2A2A2A', background: '#0D0D0D',
    padding: '8px 0',
  },
  drawerLink: {
    padding: '14px 24px', fontSize: 15, fontWeight: 500,
    color: '#CCCCCC', textDecoration: 'none', background: 'none',
    border: 'none', cursor: 'pointer', textAlign: 'left',
    fontFamily: "'Inter', sans-serif",
  },
};

// Responsive tweak via style tag
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      nav div[style*="gap: 4px"] { display: none !important; }
      nav button[aria-label="Menu"] { display: flex !important; }
    }
  `;
  document.head.appendChild(style);
}
