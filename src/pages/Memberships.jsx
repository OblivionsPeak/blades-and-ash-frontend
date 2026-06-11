// Stripe Payment Links for each membership plan.
// The salon owner pastes her own Stripe Payment Link URLs here (one per plan).
// Create them in the Stripe Dashboard → Payment Links, set each to the matching
// recurring monthly price, then replace the placeholder strings below.
// While a value is still the placeholder, that plan's button shows "Coming soon"
// and is disabled rather than linking to a broken URL.
const PAYMENT_LINKS = {
  iron: 'REPLACE_WITH_STRIPE_PAYMENT_LINK',
  forge: 'REPLACE_WITH_STRIPE_PAYMENT_LINK',
  ash: 'REPLACE_WITH_STRIPE_PAYMENT_LINK',
};

const PLANS = [
  {
    key: 'iron',
    name: 'Iron',
    price: 55,
    tagline: 'For the weekly regular.',
    perks: [
      'Family cuts — or anyone who needs a weekly haircut',
      'Can be used for bi-weekly shampoo & blowdry/style',
      'Priority booking with your stylist',
    ],
  },
  {
    key: 'forge',
    name: 'Forge',
    price: 140,
    tagline: 'Color upkeep, shared.',
    featured: true,
    perks: [
      'Root touch-up + haircut every month',
      'Can be shared between 2 people',
      'Priority booking with your stylist',
    ],
  },
  {
    key: 'ash',
    name: 'Ash',
    price: 260,
    tagline: 'The full ritual.',
    perks: [
      'Extension move-up + root touch-up + haircut',
      'Complete monthly maintenance in one plan',
      'Priority booking with your stylist',
    ],
  },
];

export default function Memberships() {
  return (
    <div style={styles.page}>
      <div className="container">
        <div style={styles.header}>
          <span style={styles.eyebrow}>BLADES &amp; ASH MEMBERSHIPS</span>
          <h1 style={styles.title}>Looking your best, on a standing schedule.</h1>
          <p style={styles.sub}>
            Choose a monthly plan and lock in your routine — color, cuts, and care for one
            predictable price. Cancel anytime.
          </p>
        </div>

        <div style={styles.grid}>
          {PLANS.map(plan => {
            const link = PAYMENT_LINKS[plan.key];
            const ready = link && link !== 'REPLACE_WITH_STRIPE_PAYMENT_LINK';
            return (
              <div
                key={plan.key}
                style={{ ...styles.cardPlan, ...(plan.featured ? styles.cardFeatured : {}) }}
              >
                {plan.featured && <span style={styles.badge}>Most Popular</span>}
                <h2 style={styles.planName}>{plan.name}</h2>
                <p style={styles.tagline}>{plan.tagline}</p>
                <div style={styles.priceRow}>
                  <span style={styles.price}>${plan.price}</span>
                  <span style={styles.per}>/ month</span>
                </div>
                <div style={styles.divider} />
                <ul style={styles.perks}>
                  {plan.perks.map((perk, i) => (
                    <li key={i} style={styles.perk}>
                      <span style={styles.check}>✦</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                {ready ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.subscribeBtn, ...(plan.featured ? styles.subscribeBtnFeatured : {}) }}
                  >
                    Subscribe
                  </a>
                ) : (
                  <div>
                    <button style={styles.subscribeDisabled} disabled>Subscribe</button>
                    <p style={styles.comingSoon}>Coming soon</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={styles.footnote}>
          Memberships renew monthly and can be cancelled anytime. Questions about which plan fits?
          {' '}Just ask your stylist at your next visit.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { background: '#0E0E10', minHeight: 'calc(100vh - 64px)', padding: '64px 0 96px' },
  header: { textAlign: 'center', maxWidth: 680, margin: '0 auto 56px' },
  eyebrow: {
    fontSize: 12, letterSpacing: '0.22em', color: '#C8A24B', fontWeight: 600,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: "'Cormorant', serif", fontSize: 44, color: '#EDE7DB',
    margin: '16px 0 16px', lineHeight: 1.1, fontWeight: 600,
  },
  sub: { color: '#9A938A', fontSize: 16, lineHeight: 1.7 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 24, alignItems: 'stretch', maxWidth: 1040, margin: '0 auto',
  },
  cardPlan: {
    position: 'relative', background: '#16161A', border: '1px solid #2A2A2A',
    borderRadius: 18, padding: '40px 32px', display: 'flex', flexDirection: 'column',
  },
  cardFeatured: {
    border: '1px solid #C8A24B',
    background: 'linear-gradient(180deg, #1E1B14 0%, #16161A 60%)',
    boxShadow: '0 12px 48px rgba(200,162,75,0.12)',
  },
  badge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: '#C8A24B', color: '#0E0E10', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 16px',
    borderRadius: 999, whiteSpace: 'nowrap',
  },
  planName: {
    fontFamily: "'Cormorant', serif", fontSize: 34, color: '#D8BC7E', fontWeight: 600,
  },
  tagline: { color: '#9A938A', fontSize: 14, marginTop: 4 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 24 },
  price: { fontFamily: "'Cormorant', serif", fontSize: 52, color: '#EDE7DB', fontWeight: 600, lineHeight: 1 },
  per: { color: '#9A938A', fontSize: 15 },
  divider: { height: 1, background: '#2A2A2A', margin: '28px 0 24px' },
  perks: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, padding: 0, margin: 0 },
  perk: { display: 'flex', gap: 12, alignItems: 'flex-start', color: '#EDE7DB', fontSize: 14.5, lineHeight: 1.5 },
  check: { color: '#C8A24B', fontSize: 13, marginTop: 2, flexShrink: 0 },
  subscribeBtn: {
    marginTop: 32, display: 'block', textAlign: 'center', padding: '14px',
    borderRadius: 999, background: 'transparent', color: '#C8A24B',
    border: '1px solid #C8A24B', fontSize: 15, fontWeight: 700, textDecoration: 'none',
    fontFamily: "'Jost', sans-serif", transition: 'all 0.2s',
  },
  subscribeBtnFeatured: {
    background: '#C8A24B', color: '#0E0E10', border: '1px solid #C8A24B',
  },
  subscribeDisabled: {
    marginTop: 32, width: '100%', padding: '14px', borderRadius: 999,
    background: '#1E1E22', color: '#9A938A', border: '1px solid #2A2A2A',
    fontSize: 15, fontWeight: 700, cursor: 'not-allowed', fontFamily: "'Jost', sans-serif",
  },
  comingSoon: { textAlign: 'center', color: '#9A938A', fontSize: 12, marginTop: 8, letterSpacing: '0.04em' },
  footnote: {
    textAlign: 'center', color: '#9A938A', fontSize: 13.5, lineHeight: 1.7,
    maxWidth: 560, margin: '56px auto 0',
  },
};
