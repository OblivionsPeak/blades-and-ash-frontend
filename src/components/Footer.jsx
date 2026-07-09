import { Link } from 'react-router-dom';
import { useSettings, hoursToRows } from '../hooks/useSettings';

function SocialLink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={styles.social}>
      {label}
    </a>
  );
}

export default function Footer() {
  const s = useSettings();
  const hasAddress = s.address_line || s.city;
  const addressText = [s.address_line, [s.city, s.state].filter(Boolean).join(', '), s.zip]
    .filter(Boolean)
    .join(' · ');
  const mapsHref =
    s.maps_url ||
    (hasAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [s.business_name || 'Blades & Ash Studio', s.address_line, s.city, s.state, s.zip].filter(Boolean).join(' ')
        )}`
      : null);
  const hourRows = hoursToRows(s.hours);
  const email = s.public_email || 'owner@bladeandash.com';
  const hasSocial = s.instagram || s.facebook || s.tiktok;

  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <div style={styles.brand}>
          <img src="/logo-monogram.svg" alt="" width="30" height="30" style={{ display: 'block' }} aria-hidden="true" />
          <span style={styles.name}>BLADES & ASH STUDIO</span>
        </div>

        {/* Business info — appears as the salon fills it in (Admin → Business Info) */}
        {(hasAddress || s.phone || hourRows.length > 0) && (
          <div style={styles.infoGrid}>
            {(hasAddress || s.phone) && (
              <div style={styles.infoCol}>
                <span style={styles.infoHead}>VISIT</span>
                {hasAddress && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={styles.infoLink}>
                    {addressText}
                  </a>
                )}
                {s.phone && (
                  <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} style={styles.infoLink}>
                    {s.phone}
                  </a>
                )}
              </div>
            )}
            {hourRows.length > 0 && (
              <div style={styles.infoCol}>
                <span style={styles.infoHead}>HOURS</span>
                {hourRows.map((r) => (
                  <span key={r.days} style={styles.hoursRow}>
                    <span style={styles.hoursDays}>{r.days}</span> {r.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {hasSocial && (
          <div style={styles.socialRow}>
            {s.instagram && <SocialLink href={s.instagram} label="Instagram" />}
            {s.facebook && <SocialLink href={s.facebook} label="Facebook" />}
            {s.tiktok && <SocialLink href={s.tiktok} label="TikTok" />}
          </div>
        )}

        <div style={styles.links}>
          <Link to="/book" style={styles.link}>Book</Link>
          <Link to="/memberships" style={styles.link}>Memberships</Link>
          <a href={`mailto:${email}`} style={styles.link}>Contact</a>
        </div>
        <a href={`mailto:${email}`} style={styles.email}>{email}</a>
        <p style={styles.copy}>© {new Date().getFullYear()} Blades & Ash Studio. All rights reserved.</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: { background: '#0E0E10', borderTop: '1px solid #2A2A2A', padding: '40px 24px' },
  inner: { maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  infoGrid: { display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'center', margin: '8px 0 4px', textAlign: 'center' },
  infoCol: { display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', minWidth: 180 },
  infoHead: { color: '#C8A24B', fontSize: 11, letterSpacing: '0.2em', marginBottom: 2 },
  infoLink: { color: '#D6CFC5', fontSize: 13, textDecoration: 'none' },
  hoursRow: { color: '#D6CFC5', fontSize: 13 },
  hoursDays: { color: '#9A938A', display: 'inline-block', minWidth: 74, textAlign: 'right', marginRight: 8 },
  socialRow: { display: 'flex', gap: 18, marginTop: 2 },
  social: { color: '#C8A24B', fontSize: 13, textDecoration: 'none', letterSpacing: '0.05em' },
  links: { display: 'flex', gap: 20 },
  link: { color: '#9A938A', fontSize: 13, textDecoration: 'none' },
  scissor: { color: '#C8A24B', fontSize: 20 },
  name: { fontFamily: "'Cormorant', serif", color: '#fff', fontSize: 16, letterSpacing: '0.1em' },
  email: { color: '#C8A24B', fontSize: 13, textDecoration: 'none' },
  copy: { color: '#9A938A', fontSize: 13 },
};
