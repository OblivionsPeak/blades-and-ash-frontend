import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export function useAppointments(params = {}) {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.access_token) { setLoading(false); return; }
    setLoading(true);
    api.getAppointments(session.access_token, params)
      .then(data => setAppointments(data.appointments || data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, JSON.stringify(params)]);

  async function cancel(id) {
    if (!session?.access_token) return;
    await api.cancelAppointment(id, session.access_token);
    setAppointments(a => a.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
  }

  return { appointments, loading, error, cancel };
}
