import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px' }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>✂</div>
      <h1 style={{ fontFamily: "'Cormorant', serif", fontSize: 40, marginBottom: 12 }}>Page Not Found</h1>
      <p style={{ color: '#9A938A', marginBottom: 32 }}>Looks like this page got a trim too short.</p>
      <Link to="/" style={{ padding: '12px 32px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
        Back to Home
      </Link>
    </div>
  );
}
