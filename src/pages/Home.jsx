import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ServiceCard from '../components/ServiceCard';
import StaffCard from '../components/StaffCard';

export default function Home() {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    api.getServices().then(setServices).catch(() => {});
    api.getStaff().then(setStaff).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <p style={styles.heroLabel}>✂ BLADES & ASH STUDIO</p>
          <h1 style={styles.heroTitle}>Where Style<br />Meets Craft</h1>
          <p style={styles.heroSub}>Book your appointment online, anytime. Expert stylists, exceptional results.</p>
          <Link to="/book" style={styles.heroBtn}>Book an Appointment</Link>
        </div>
      </section>

      {/* Services */}
      <section style={styles.section}>
        <div className="container">
          <div style={styles.sectionHead}>
            <span style={styles.sectionLabel}>WHAT WE OFFER</span>
            <h2 style={styles.sectionTitle}>Our Services</h2>
          </div>
          {services.length === 0 ? (
            <p style={styles.empty}>Services coming soon.</p>
          ) : (
            <div className="grid-3">
              {services.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link to="/book" className="btn btn-primary btn-lg">Book Now</Link>
          </div>
        </div>
      </section>

      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ ...styles.section, background: '#0D0D0D' }}>
          <div className="container">
            <div style={styles.sectionHead}>
              <span style={{ ...styles.sectionLabel, color: '#C9A84C' }}>THE TEAM</span>
              <h2 style={{ ...styles.sectionTitle, color: '#fff' }}>Meet Your Stylists</h2>
            </div>
            <div className="grid-3">
              {staff.map(s => <StaffCard key={s.id} staff={s} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA strip */}
      <section style={styles.ctaStrip}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={styles.ctaTitle}>Ready for a fresh look?</h2>
          <p style={styles.ctaSub}>Book in minutes. No account required to browse.</p>
          <Link to="/book" style={styles.heroBtn}>Book Your Appointment</Link>
        </div>
      </section>
    </div>
  );
}

const styles = {
  hero: {
    background: '#0D0D0D',
    minHeight: '85vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '80px 24px',
  },
  heroInner: { maxWidth: 680 },
  heroLabel: { color: '#C9A84C', fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', marginBottom: 24 },
  heroTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 'clamp(48px, 8vw, 80px)',
    color: '#fff', lineHeight: 1.1, marginBottom: 24,
  },
  heroSub: { color: '#AAAAAA', fontSize: 18, lineHeight: 1.6, marginBottom: 40 },
  heroBtn: {
    display: 'inline-block',
    padding: '16px 44px', borderRadius: 999,
    background: '#C9A84C', color: '#0D0D0D',
    fontSize: 15, fontWeight: 700, letterSpacing: '0.06em',
    textDecoration: 'none', transition: 'background 0.2s',
  },
  section: { padding: '80px 0' },
  sectionHead: { textAlign: 'center', marginBottom: 48 },
  sectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: '#C9A84C' },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: 40, marginTop: 8 },
  empty: { textAlign: 'center', color: '#888', padding: '40px 0' },
  ctaStrip: { background: '#F9F7F4', padding: '80px 0', borderTop: '1px solid #E0DCDA' },
  ctaTitle: { fontFamily: "'Playfair Display', serif", fontSize: 36, marginBottom: 12 },
  ctaSub: { color: '#666', fontSize: 16, marginBottom: 32 },
};
