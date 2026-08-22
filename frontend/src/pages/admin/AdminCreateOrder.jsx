import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateCharge, createOrder } from '../../api/orderApi';
import { getCustomers } from '../../api/authApi';
import AdminLayout from '../../components/AdminLayout';

const emptyAddress = { addressLine: '', city: '', pincode: '' };

// Admin equivalent of customer/PlaceOrder.jsx — same calculate-then-confirm
// flow (backend recalculates the charge server-side either way), plus a
// customer picker up top since the admin is placing this order on someone
// else's behalf (POST /orders with customerId — see orderController.resolveCustomer).
export default function AdminCreateOrder() {
  const navigate = useNavigate();

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');

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

  const loadCustomers = async (search) => {
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const res = await getCustomers(search);
      setCustomers(res.data || res);
    } catch (err) {
      setCustomersError(err.response?.data?.message || 'Could not load customers.');
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCustomerSearch = (e) => {
    e.preventDefault();
    loadCustomers(customerSearch);
  };

  const updateField = (section, field, value) => {
    setCharge(null); // any change invalidates the previous quote
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  const buildPayload = () => ({
    customerId,
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
    if (!customerId) {
      setError('Pick a customer to place this order for first.');
      return;
    }
    setCalculating(true);
    try {
      // calculate-charge doesn't need customerId — it never persists anything.
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

  const resetAll = () => {
    setPlaced(null);
    setCharge(null);
    setCustomerId('');
    setForm({
      pickupAddress: { ...emptyAddress },
      dropAddress: { ...emptyAddress },
      dimensions: { length: '', breadth: '', height: '' },
      actualWeight: '',
      orderType: 'B2C',
      paymentType: 'Prepaid',
      receiverPhone: '',
    });
  };

  if (placed) {
    return (
      <AdminLayout title="Create order for customer" subtitle="Place an order on behalf of a customer.">
        <div className="card">
          <h2>Order placed</h2>
          <p>The order has been created and is now being processed.</p>
          <p className="muted">Order ID: {placed._id}</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => navigate('/admin/orders')}>
              Go to all orders
            </button>
            <button className="btn btn-ghost" onClick={resetAll}>
              Create another order
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Create order for customer" subtitle="Place an order on behalf of a customer.">
      {error && <div className="alert alert-error">{error}</div>}
      {customersError && <div className="alert alert-error">{customersError}</div>}

      <form className="filter-bar" onSubmit={handleCustomerSearch}>
        <input
          placeholder="Search customers by name or email…"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button className="btn btn-secondary" type="submit" disabled={customersLoading}>
          Search
        </button>
      </form>

      <div className="card form-grid">
        <fieldset>
          <legend>Customer</legend>
          <label>
            Place this order for
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCharge(null);
                setCustomerId(e.target.value);
              }}
            >
              <option value="" disabled>
                {customersLoading ? 'Loading customers…' : 'Select a customer…'}
              </option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} — {c.email}
                </option>
              ))}
            </select>
          </label>
          {!customersLoading && customers.length === 0 && (
            <p className="muted small">No customers match that search.</p>
          )}
        </fieldset>
      </div>

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
    </AdminLayout>
  );
}