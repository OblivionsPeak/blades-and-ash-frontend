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
          <svg width="58" height="70" viewBox="0 -16 100 124" style={{ display: 'block', margin: '0 auto 22px' }} aria-hidden="true">
            <g fill="none" stroke="#C8A24B" strokeLinecap="round">
              <path d="M50 4 C42 -5 60 -9 49 -16" strokeWidth="2" opacity="0.6" />
              <path d="M50 5 C58 -1 47 -4 54 -12" strokeWidth="1.4" opacity="0.45" />
            </g>
            <path d="M63 2 C 55 18, 50 28, 47 39 C 41 60, 33 77, 23 90 L 30 91 C 41 77, 50 60, 54 40 C 57 28, 61 14, 63 2 Z" fill="#C8A24B" />
            <path d="M37 2 C 45 18, 50 28, 53 39 C 59 60, 67 77, 77 90 L 70 91 C 59 77, 50 60, 46 40 C 43 28, 39 14, 37 2 Z" fill="#C8A24B" />
            <path d="M35 60 Q50 65 65 60" fill="none" stroke="#C8A24B" strokeWidth="4.6" strokeLinecap="round" />
            <circle cx="50" cy="36" r="3.8" fill="#0E0E10" stroke="#C8A24B" strokeWidth="2.4" />
            <circle cx="24" cy="92" r="6.5" fill="none" stroke="#C8A24B" strokeWidth="3" />
            <circle cx="76" cy="92" r="6.5" fill="none" stroke="#C8A24B" strokeWidth="3" />
          </svg>
          <p style={styles.heroLabel}>BLADES &amp; ASH STUDIO</p>
          <h1 style={styles.heroTitle}>Sharp Craft.<br /><span style={{ fontStyle: 'italic', color: '#C8A24B' }}>Quiet</span> Luxury.</h1>
          <p style={styles.heroSub}>Precision cuts and dimensional colour, by appointment. Book online anytime — expert hands, unhurried care.</p>
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
        <section style={{ ...styles.section, background: '#0E0E10' }}>
          <div className="container">
            <div style={styles.sectionHead}>
              <span style={{ ...styles.sectionLabel, color: '#C8A24B' }}>THE TEAM</span>
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
    background: '#0E0E10',
    minHeight: '85vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '80px 24px',
  },
  heroInner: { maxWidth: 680 },
  heroLabel: { color: '#C8A24B', fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', marginBottom: 24 },
  heroTitle: {
    fontFamily: "'Cormorant', serif",
    fontSize: 'clamp(48px, 8vw, 80px)',
    color: '#fff', lineHeight: 1.1, marginBottom: 24,
  },
  heroSub: { color: '#AAAAAA', fontSize: 18, lineHeight: 1.6, marginBottom: 40 },
  heroBtn: {
    display: 'inline-block',
    padding: '16px 44px', borderRadius: 999,
    background: '#C8A24B', color: '#0E0E10',
    fontSize: 15, fontWeight: 700, letterSpacing: '0.06em',
    textDecoration: 'none', transition: 'background 0.2s',
  },
  section: { padding: '80px 0' },
  sectionHead: { textAlign: 'center', marginBottom: 48 },
  sectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: '#C8A24B' },
  sectionTitle: { fontFamily: "'Cormorant', serif", fontSize: 40, marginTop: 8 },
  empty: { textAlign: 'center', color: '#888', padding: '40px 0' },
  ctaStrip: { background: '#F9F7F4', padding: '80px 0', borderTop: '1px solid #E0DCDA' },
  ctaTitle: { fontFamily: "'Cormorant', serif", fontSize: 36, marginBottom: 12 },
  ctaSub: { color: '#666', fontSize: 16, marginBottom: 32 },
};
