import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

export default function PaymentForm({ amount, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErr('');

    const cardElement = elements.getElement(CardElement);
    const { error, paymentIntent } = await stripe.confirmCardPayment(undefined, {
      payment_method: { card: cardElement },
    });

    setLoading(false);
    if (error) {
      setErr(error.message);
      onError?.(error.message);
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <p style={styles.label}>Card Details</p>
      <div style={styles.cardBox}>
        <CardElement options={CARD_OPTIONS} />
      </div>
      {err && <p style={styles.error}>{err}</p>}
      <button type="submit" disabled={!stripe || loading} style={styles.btn}>
        {loading ? 'Processing…' : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

const CARD_OPTIONS = {
  style: {
    base: { fontSize: '15px', fontFamily: "'Jost', sans-serif", color: '#0E0E10', '::placeholder': { color: '#aaa' } },
    invalid: { color: '#C0392B' },
  },
};

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardBox: {
    padding: '14px 16px', border: '1.5px solid #E0DCDA', borderRadius: 8, background: '#fff',
  },
  error: { fontSize: 14, color: '#C0392B' },
  btn: {
    padding: '13px', borderRadius: 999, background: '#0E0E10', color: '#C8A24B',
    border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Jost', sans-serif", letterSpacing: '0.04em',
  },
};
