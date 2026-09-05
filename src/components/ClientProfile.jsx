import { format } from 'date-fns';
import StatusBadge from './StatusBadge';
import { apptServiceNames } from '../utils';
import { fmtWhen } from './FormDetail';

// Admin's at-a-glance view of one client: contact, card on file, forms on
// file, and every appointment with what's been paid on it. All the actions
// (book, notes, card, view a form) are handed up to the Admin page, which
// already owns those flows.
export default function ClientProfile({ summary, onBook, onNotes, onCard, onEdit, onViewForm }) {
  if (!summary) return null;
  const { client, forms, appointments } = summary;
  const now = new Date();
  const upcoming = appointments.filter(a => new Date(a.end_time) >= now && a.status !== 'cancelled');
  const past = appointments.filter(a => !(new Date(a.end_time) >= now && a.status !== 'cancelled'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Contact + primary action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: '#9A938A', lineHeight: 1.7 }}>
          {client.email && <div>{client.email}</div>}
          {client.phone && <div>{client.phone}</div>}
          <div>
            Card on file: <span style={{ color: client.stripe_customer_id ? '#6FCF97' : '#D8BC7E' }}>{client.stripe_customer_id ? 'Yes' : 'No'}</span>
          </div>
        </div>
        <button onClick={() => onBook(client)} style={styles.bookBtn}>+ Book now</button>
      </div>

      {/* Forms */}
      <div>
        <p style={styles.label}>Forms on file</p>
        <FormRow
          title="Agreement & waiver"
          record={forms.waiver}
          onView={onViewForm}
          missing="Not signed — ask them to sign at bladeandash.com/waiver"
        />
        <FormRow
          title="Consultation"
          record={forms.consultation}
          onView={onViewForm}
          missing="Not filled out — bladeandash.com/consultation"
        />
      </div>

      {/* Appointments */}
      <div>
        <p style={styles.label}>Upcoming</p>
        {upcoming.length === 0 ? (
          <p style={styles.empty}>Nothing booked.</p>
        ) : upcoming.map(a => <ApptRow key={a.id} a={a} />)}
      </div>
      {past.length > 0 && (
        <div>
          <p style={styles.label}>Past</p>
          {past.slice(0, 12).map(a => <ApptRow key={a.id} a={a} />)}
          {past.length > 12 && <p style={styles.empty}>Showing the 12 most recent of {past.length}.</p>}
        </div>
      )}

      {/* Secondary actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #2A2A2A', paddingTop: 16 }}>
        <button onClick={() => onNotes(client)} style={styles.smallBtn}>Hair notes</button>
        <button onClick={() => onCard(client)} style={styles.smallBtn}>{client.stripe_customer_id ? 'Manage card' : 'Add card'}</button>
        <button onClick={() => onEdit(client)} style={styles.smallBtn}>Edit details</button>
      </div>
    </div>
  );
}

function FormRow({ title, record, onView, missing }) {
  return (
    <div style={styles.formRow}>
      <div>
        <div style={{ fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: record ? '#6FCF97' : '#D8BC7E', marginTop: 2 }}>
          {record ? `✓ ${fmtWhen(record.created_at)}${record.client_id ? '' : ' · signed without an account'}` : missing}
        </div>
      </div>
      {record && <button onClick={() => onView(record.id)} style={styles.smallBtn}>View</button>}
    </div>
  );
}

// What's been paid on an appointment, in the salon's words.
export function paymentSummary(a) {
  const money = c => `$${((c || 0) / 100).toFixed(2)}`;
  const total = a.total_cents || 0;
  const paid = a.amount_paid_cents || 0;
  const deposit = a.deposit_cents || 0;

  if (a.fee_charged_cents > 0) {
    return { text: `${a.fee_type === 'no_show' ? 'No-show' : 'Late-cancel'} fee charged ${money(a.fee_charged_cents)}`, color: '#f8a3a3' };
  }
  if (total > 0 && paid >= total) return { text: `Paid in full ${money(paid)}`, color: '#6FCF97' };
  if (deposit > 0 && paid >= deposit) return { text: `Deposit paid ${money(paid)} · ${money(total - paid)} due`, color: '#6FCF97' };
  if (paid > 0) return { text: `Paid ${money(paid)} of ${money(total)}`, color: '#D8BC7E' };
  if (deposit > 0) return { text: `Deposit ${money(deposit)} not paid`, color: '#f8a3a3' };
  if (a.card_on_file) return { text: 'Card on file · pay at salon', color: '#9A938A' };
  return { text: 'Nothing paid · no card on this booking', color: '#D8BC7E' };
}

function ApptRow({ a }) {
  const pay = paymentSummary(a);
  const start = new Date(a.start_time);
  return (
    <div style={styles.apptRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {format(start, 'EEE, MMM d, yyyy')} · {format(start, 'h:mm a')}
        </div>
        <div style={{ fontSize: 13, color: '#9A938A', marginTop: 2 }}>
          {apptServiceNames(a)}{a.staff?.full_name ? ` · with ${a.staff.full_name}` : ''}
        </div>
        <div style={{ fontSize: 12.5, color: pay.color, marginTop: 4 }}>{pay.text}</div>
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        <StatusBadge status={a.status} />
        <div style={{ fontSize: 13, color: '#D8BC7E', marginTop: 6 }}>${((a.total_cents || 0) / 100).toFixed(2)}</div>
      </div>
    </div>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C8A24B', margin: '0 0 8px' },
  empty: { fontSize: 13, color: '#9A938A' },
  formRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #2A2A2A' },
  apptRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #2A2A2A' },
  bookBtn: { padding: '10px 22px', borderRadius: 999, background: '#C8A24B', color: '#0E0E10', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  smallBtn: { padding: '5px 14px', borderRadius: 999, background: 'none', border: '1px solid #2A2A2A', fontSize: 12, cursor: 'pointer' },
};
