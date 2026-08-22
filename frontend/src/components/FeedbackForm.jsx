import { useEffect, useState } from 'react';
import { getFeedbackForOrder, submitFeedback } from '../api/orderApi';

// Star rating + comment for one delivered order. Fetches any existing
// feedback on mount so re-opening this shows "already rated" pre-filled
// (submitFeedback is an upsert server-side, so re-submitting just edits it).
export default function FeedbackForm({ orderId, onClose }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getFeedbackForOrder(orderId);
        if (!cancelled && res.data) {
          setRating(res.data.rating);
          setComment(res.data.comment || '');
        }
      } catch {
        // no existing feedback — leave the form blank, not an error worth showing
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please select a star rating.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitFeedback(orderId, { rating, comment });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted small">Loading…</p>;

  return (
    <form className="reschedule-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error small">{error}</div>}
      {saved && (
        <div
          className="alert small"
          style={{
            background: 'rgba(34,197,94,0.15)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          Thanks — your feedback has been saved.
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, fontSize: 28, cursor: 'pointer' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            style={{ color: (hoverRating || rating) >= star ? '#facc15' : '#4b5563' }}
          >
            ★
          </span>
        ))}
      </div>

      <label>
        Comment (optional)
        <textarea
          rows={2}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was your delivery experience?"
        />
      </label>

      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : saved ? 'Update feedback' : 'Submit feedback'}
        </button>
        {onClose && (
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </form>
  );
}
