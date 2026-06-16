const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiFetch(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getServices: () => apiFetch('/api/services'),
  createService: (body, token) => apiFetch('/api/services', { method: 'POST', body: JSON.stringify(body) }, token),
  updateService: (id, body, token) => apiFetch(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
  deleteService: (id, token) => apiFetch(`/api/services/${id}`, { method: 'DELETE' }, token),

  getStaff: () => apiFetch('/api/staff'),
  getStaffServices: (id) => apiFetch(`/api/staff/${id}/services`),
  getStaffAvailability: (id) => apiFetch(`/api/staff/${id}/availability`),
  updateAvailability: (id, body, token) => apiFetch(`/api/staff/${id}/availability`, { method: 'PUT', body: JSON.stringify(body) }, token),
  getStaffTimeOff: (id, token) => apiFetch(`/api/staff/${id}/time-off`, {}, token),
  addStaffTimeOff: (id, body, token) => apiFetch(`/api/staff/${id}/time-off`, { method: 'POST', body: JSON.stringify(body) }, token),
  removeStaffTimeOff: (id, blockId, token) => apiFetch(`/api/staff/${id}/time-off/${blockId}`, { method: 'DELETE' }, token),
  assignStaffService: (id, body, token) => apiFetch(`/api/staff/${id}/services`, { method: 'POST', body: JSON.stringify(body) }, token),
  removeStaffService: (id, serviceId, token) => apiFetch(`/api/staff/${id}/services/${serviceId}`, { method: 'DELETE' }, token),

  getAvailability: (params) => apiFetch(`/api/availability?${new URLSearchParams(params)}`),

  getAppointments: (token, params = {}) => apiFetch(`/api/appointments?${new URLSearchParams(params)}`, {}, token),
  getAppointment: (id, token) => apiFetch(`/api/appointments/${id}`, {}, token),
  createAppointment: (body, token) => apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(body) }, token),
  updateAppointment: (id, body, token) => apiFetch(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
  cancelAppointment: (id, token) => apiFetch(`/api/appointments/${id}`, { method: 'DELETE' }, token),
  rescheduleAppointment: (id, body, token) => apiFetch(`/api/appointments/${id}/reschedule`, { method: 'PUT', body: JSON.stringify(body) }, token),
  chargeFee: (id, body, token) => apiFetch(`/api/appointments/${id}/charge-fee`, { method: 'POST', body: JSON.stringify(body) }, token),
  applyAppointmentDiscount: (id, discountCode, token) => apiFetch(`/api/appointments/${id}/apply-discount`, { method: 'POST', body: JSON.stringify({ discount_code: discountCode }) }, token),
  recordPayment: (id, body, token) => apiFetch(`/api/appointments/${id}/record-payment`, { method: 'POST', body: JSON.stringify(body) }, token),

  createPaymentIntent: (body, token) => apiFetch('/api/payments/create-intent', { method: 'POST', body: JSON.stringify(body) }, token),

  getDiscounts: (token) => apiFetch('/api/discounts', {}, token),
  createDiscount: (body, token) => apiFetch('/api/discounts', { method: 'POST', body: JSON.stringify(body) }, token),
  updateDiscount: (id, body, token) => apiFetch(`/api/discounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
  deleteDiscount: (id, token) => apiFetch(`/api/discounts/${id}`, { method: 'DELETE' }, token),
  validateDiscount: (body, token) => apiFetch('/api/discounts/validate', { method: 'POST', body: JSON.stringify(body) }, token),

  getDashboard: (token) => apiFetch('/api/admin/dashboard', {}, token),
  getPayments: (token, params = {}) => apiFetch(`/api/admin/payments?${new URLSearchParams(params)}`, {}, token),
  getClients: (token) => apiFetch('/api/admin/clients', {}, token),
  createClient: (body, token) => apiFetch('/api/admin/clients', { method: 'POST', body: JSON.stringify(body) }, token),
  createCardSetup: (id, token) => apiFetch(`/api/admin/clients/${id}/card-setup`, { method: 'POST' }, token),
  getClientCards: (id, token) => apiFetch(`/api/admin/clients/${id}/cards`, {}, token),
  updateUserRole: (id, role, token) => apiFetch(`/api/admin/profiles/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }, token),
};
