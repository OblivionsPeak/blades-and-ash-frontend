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
