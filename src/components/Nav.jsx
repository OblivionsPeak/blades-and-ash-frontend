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
        { to: '/memberships', label: 'Memberships' },
        ...(isStaff ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
        ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
        { to: '/profile', label: 'My Appointments' },
      ]
    : [
        { to: '/', label: 'Home' },
        { to: '/book', label: 'Book' },
        { to: '/memberships', label: 'Memberships' },
      ];

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <svg width="22" height="27" viewBox="0 -16 100 124" style={{ display: 'block' }} aria-hidden="true">
            <g fill="none" stroke="#C8A24B" strokeLinecap="round">
              <path d="M50 4 C42 -5 60 -9 49 -16" strokeWidth="2" opacity="0.65" />
              <path d="M50 5 C58 -1 47 -4 54 -12" strokeWidth="1.4" opacity="0.5" />
            </g>
            <path d="M63 2 C 55 18, 50 28, 47 39 C 41 60, 33 77, 23 90 L 30 91 C 41 77, 50 60, 54 40 C 57 28, 61 14, 63 2 Z" fill="#C8A24B" />
            <path d="M37 2 C 45 18, 50 28, 53 39 C 59 60, 67 77, 77 90 L 70 91 C 59 77, 50 60, 46 40 C 43 28, 39 14, 37 2 Z" fill="#C8A24B" />
            <path d="M35 60 Q50 65 65 60" fill="none" stroke="#C8A24B" strokeWidth="4.6" strokeLinecap="round" />
            <circle cx="50" cy="36" r="3.8" fill="#0E0E10" stroke="#C8A24B" strokeWidth="2.4" />
            <circle cx="24" cy="92" r="6.5" fill="none" stroke="#C8A24B" strokeWidth="3" />
            <circle cx="76" cy="92" r="6.5" fill="none" stroke="#C8A24B" strokeWidth="3" />
          </svg>
          <span style={styles.logoText}>BLADES <span style={{ fontStyle: 'italic', color: '#C8A24B' }}>&amp;</span> ASH</span>
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
    background: '#0E0E10',
    borderBottom: '1px solid #2A2A2A',
  },
  inner: {
    maxWidth: 1200, margin: '0 auto', padding: '0 24px',
    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
  },
  logoScissors: { color: '#C8A24B', fontSize: 20 },
  logoText: {
    fontFamily: "'Cormorant', serif",
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
  linkActive: { color: '#C8A24B', fontWeight: 600 },
  loginBtn: {
    marginLeft: 8, padding: '8px 20px',
    background: '#C8A24B', color: '#0E0E10',
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
  burgerLine: { display: 'block', width: 22, height: 2, background: '#EDE7DB', borderRadius: 2 },
  drawer: {
    display: 'flex', flexDirection: 'column',
    borderTop: '1px solid #2A2A2A', background: '#0E0E10',
    padding: '8px 0',
  },
  drawerLink: {
    padding: '14px 24px', fontSize: 15, fontWeight: 500,
    color: '#CCCCCC', textDecoration: 'none', background: 'none',
    border: 'none', cursor: 'pointer', textAlign: 'left',
    fontFamily: "'Jost', sans-serif",
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
