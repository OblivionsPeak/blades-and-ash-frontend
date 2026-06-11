import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <div style={styles.brand}>
          <span style={styles.scissor}>✂</span>
          <span style={styles.name}>BLADES & ASH STUDIO</span>
        </div>
        <div style={styles.links}>
          <Link to="/book" style={styles.link}>Book</Link>
          <Link to="/memberships" style={styles.link}>Memberships</Link>
        </div>
        <p style={styles.copy}>© {new Date().getFullYear()} Blades & Ash Studio. All rights reserved.</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: { background: '#0E0E10', borderTop: '1px solid #2A2A2A', padding: '40px 24px' },
  inner: { maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  links: { display: 'flex', gap: 20 },
  link: { color: '#9A938A', fontSize: 13, textDecoration: 'none' },
  scissor: { color: '#C8A24B', fontSize: 20 },
  name: { fontFamily: "'Cormorant', serif", color: '#fff', fontSize: 16, letterSpacing: '0.1em' },
  copy: { color: '#9A938A', fontSize: 13 },
};
