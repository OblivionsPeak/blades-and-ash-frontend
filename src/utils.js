// Appointment item helpers — appointments now carry an `items` array
// ([{ service_id, name, price_cents, duration_minutes }]). Legacy/missing
// `items` fall back to the single synthesized `service` object.

export function apptItems(appointment) {
  if (appointment?.items && appointment.items.length > 0) return appointment.items;
  if (appointment?.service) {
    return [{
      service_id: appointment.service.id,
      name: appointment.service.name,
      price_cents: appointment.service.price_cents,
      duration_minutes: appointment.service.duration_minutes,
    }];
  }
  return [];
}

// Service names joined for compact display, e.g. "Cut · Color · Style".
export function apptServiceNames(appointment) {
  const items = apptItems(appointment);
  if (items.length === 0) return 'Service';
  return items.map(i => i.name).join(' · ');
}

// Display order for service category groups. Unknown categories slot in
// before 'Other'; uncategorized services land in 'Other'.
export const CATEGORY_ORDER = ['Haircuts', 'Color', 'Perms', 'Extensions', 'Treatments & Styling', 'Waxing', 'Add-Ons', 'Other'];

// Group services into [{ category, items }] in CATEGORY_ORDER. If no service
// has a category at all, returns a single flat group with category: null.
export function groupServicesByCategory(services) {
  if (!services.some(s => s.category)) return [{ category: null, items: services }];
  const known = new Set(CATEGORY_ORDER);
  const extras = [...new Set(services.map(s => s.category).filter(c => c && !known.has(c)))].sort();
  const ordered = [...CATEGORY_ORDER.slice(0, -1), ...extras, 'Other'];
  return ordered
    .map(cat => ({ category: cat, items: services.filter(s => (s.category || 'Other') === cat) }))
    .filter(g => g.items.length > 0);
}
