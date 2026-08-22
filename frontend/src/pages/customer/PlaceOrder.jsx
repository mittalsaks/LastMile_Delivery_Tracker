import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateCharge, createOrder } from '../../api/orderApi';

const emptyAddress = { addressLine: '', city: '', pincode: '' };

export default function PlaceOrder() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    pickupAddress: { ...emptyAddress },
    dropAddress: { ...emptyAddress },
    dimensions: { length: '', breadth: '', height: '' },
    actualWeight: '',
    orderType: 'B2C',
    paymentType: 'Prepaid',
    receiverPhone: '',
  });
  const [charge, setCharge] = useState(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  const updateField = (section, field, value) => {
    setCharge(null); // any change invalidates the previous quote
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  const buildPayload = () => ({
    pickupAddress: form.pickupAddress,
    dropAddress: form.dropAddress,
    dimensions: {
      length: Number(form.dimensions.length),
      breadth: Number(form.dimensions.breadth),
      height: Number(form.dimensions.height),
    },
    actualWeight: Number(form.actualWeight),
    orderType: form.orderType,
    paymentType: form.paymentType,
    receiverPhone: form.receiverPhone,
  });

  const handleCalculate = async (e) => {
    e.preventDefault();
    setError('');
    setCalculating(true);
    try {
      const res = await calculateCharge(buildPayload());
      setCharge(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not calculate charge.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setPlacing(true);
    try {
      const res = await createOrder(buildPayload());
      setPlaced(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  };

  if (placed) {
    return (
      <div className="page">
        <div className="card">
          <h2>Order placed</h2>
          <p>Your order has been created and is now being processed.</p>
          <p className="muted">Order ID: {placed._id}</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => navigate('/customer/orders')}>
              View my orders
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setPlaced(null);
                setCharge(null);
              }}
            >
              Place another order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Place an order</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={handleCalculate}>
        <fieldset>
          <legend>Pickup address</legend>
          <label>
            Address line
            <input
              required
              value={form.pickupAddress.addressLine}
              onChange={(e) => updateField('pickupAddress', 'addressLine', e.target.value)}
            />
          </label>
          <div className="row">
            <label>
              City
              <input
                required
                value={form.pickupAddress.city}
                onChange={(e) => updateField('pickupAddress', 'city', e.target.value)}
              />
            </label>
            <label>
              Pincode
              <input
                required
                value={form.pickupAddress.pincode}
                onChange={(e) => updateField('pickupAddress', 'pincode', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Drop address</legend>
          <label>
            Address line
            <input
              required
              value={form.dropAddress.addressLine}
              onChange={(e) => updateField('dropAddress', 'addressLine', e.target.value)}
            />
          </label>
          <div className="row">
            <label>
              City
              <input
                required
                value={form.dropAddress.city}
                onChange={(e) => updateField('dropAddress', 'city', e.target.value)}
              />
            </label>
            <label>
              Pincode
              <input
                required
                value={form.dropAddress.pincode}
                onChange={(e) => updateField('dropAddress', 'pincode', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Package details</legend>
          <div className="row">
            <label>
              Length (cm)
              <input
                type="number"
                min="0"
                required
                value={form.dimensions.length}
                onChange={(e) => updateField('dimensions', 'length', e.target.value)}
              />
            </label>
            <label>
              Breadth (cm)
              <input
                type="number"
                min="0"
                required
                value={form.dimensions.breadth}
                onChange={(e) => updateField('dimensions', 'breadth', e.target.value)}
              />
            </label>
            <label>
              Height (cm)
              <input
                type="number"
                min="0"
                required
                value={form.dimensions.height}
                onChange={(e) => updateField('dimensions', 'height', e.target.value)}
              />
            </label>
          </div>
          <label>
            Actual weight (kg)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.actualWeight}
              onChange={(e) => {
                setCharge(null);
                setForm((f) => ({ ...f, actualWeight: e.target.value }));
              }}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Order type &amp; payment</legend>
          <div className="row">
            <label>
              Order type
              <select
                value={form.orderType}
                onChange={(e) => {
                  setCharge(null);
                  setForm((f) => ({ ...f, orderType: e.target.value }));
                }}
              >
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
            </label>
            <label>
              Payment type
              <select
                value={form.paymentType}
                onChange={(e) => {
                  setCharge(null);
                  setForm((f) => ({ ...f, paymentType: e.target.value }));
                }}
              >
                <option value="Prepaid">Prepaid</option>
                <option value="COD">COD</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Delivery contact</legend>
          <label>
            Receiver's phone number
            <input
              type="tel"
              required
              placeholder="10-digit mobile number"
              value={form.receiverPhone}
              onChange={(e) => {
                setCharge(null);
                setForm((f) => ({ ...f, receiverPhone: e.target.value }));
              }}
            />
          </label>
          <p className="muted small">Delivery status SMS updates will be sent to this number.</p>
        </fieldset>

        <button className="btn btn-secondary" type="submit" disabled={calculating}>
          {calculating ? 'Calculating…' : 'Calculate charge'}
        </button>
      </form>

      {charge && (
  <div className="card charge-summary">
    <h2>Charge summary</h2>
    <div className="charge-row">
      <span>Base rate</span>
      <strong>₹{charge.data?.charge?.baseRate}</strong>
    </div>
    <div className="charge-row">
      <span>Weight charge (base + per-kg)</span>
      <strong>₹{charge.data?.charge?.weightCharge}</strong>
    </div>
    {charge.data?.charge?.codSurcharge > 0 && (
      <div className="charge-row">
        <span>COD surcharge</span>
        <strong>₹{charge.data?.charge?.codSurcharge}</strong>
      </div>
    )}
    <div className="charge-row total">
      <span>Total</span>
      <strong>₹{charge.data?.charge?.totalCharge}</strong>
    </div>

    <button className="btn btn-primary" onClick={handleConfirm} disabled={placing}>
      {placing ? 'Placing order…' : 'Confirm & place order'}
    </button>
  </div>
)}
    </div>
  );
}