import { useEffect } from 'react';
import { useSettings, DAY_KEYS } from '../hooks/useSettings';

const DAY_SCHEMA = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

// Injects LocalBusiness (HairSalon) JSON-LD once business info exists. This is
// what feeds Google's local results (hours, address, phone). Renders nothing
// until the salon fills in Admin -> Business Info.
export default function SeoSchema() {
  const s = useSettings();

  useEffect(() => {
    // Need at least a locality to be a useful LocalBusiness entry.
    if (!s.city && !s.address_line) return undefined;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'HairSalon',
      name: s.business_name || 'Blades & Ash Studio',
      url: 'https://bladeandash.com',
      image: 'https://bladeandash.com/og-image-v2.png',
      priceRange: '$$',
    };

    const address = {
      '@type': 'PostalAddress',
      ...(s.address_line && { streetAddress: s.address_line }),
      ...(s.city && { addressLocality: s.city }),
      ...(s.state && { addressRegion: s.state }),
      ...(s.zip && { postalCode: s.zip }),
      addressCountry: 'US',
    };
    schema.address = address;

    if (s.phone) schema.telephone = s.phone;
    if (s.public_email) schema.email = s.public_email;

    const sameAs = [s.instagram, s.facebook, s.tiktok].filter(Boolean);
    if (sameAs.length) schema.sameAs = sameAs;

    if (s.maps_url) schema.hasMap = s.maps_url;

    const hours = s.hours || {};
    const spec = DAY_KEYS.filter((d) => hours[d] && !hours[d].closed).map((d) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_SCHEMA[d],
      opens: hours[d].open,
      closes: hours[d].close,
    }));
    if (spec.length) schema.openingHoursSpecification = spec;

    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'salon-jsonld';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => el.remove();
  }, [s]);

  return null;
}
