import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getFirstAdminSetupStatus } from '../api/authApi';

// Reveal-on-scroll: adds `in-view` once an element enters the viewport, so
// sections below the fold animate in as the user scrolls (landing page is
// intentionally scrollable — only the auth pages are one-screen).
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const features = [
  {
    tint: 'rgba(59, 130, 246, 0.15)',
    iconColor: '#60a5fa',
    title: 'Zone detection',
    desc: 'Charges calculated automatically from pincode and volumetric weight.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    tint: 'rgba(34, 197, 94, 0.15)',
    iconColor: '#4ade80',
    title: 'Smart assignment',
    desc: 'Orders auto-assigned to the nearest available agent by zone.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
        <path d="M16 11l2 2 4-4" />
      </svg>
    ),
  },
  {
    tint: 'rgba(249, 115, 22, 0.15)',
    iconColor: '#fb923c',
    title: 'Live tracking',
    desc: 'Full status timeline with email updates at every step.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="6" width="15" height="12" rx="2" />
        <path d="M16 10h3l3 3v5h-6z" />
        <circle cx="6" cy="19" r="1.6" />
        <circle cx="18" cy="19" r="1.6" />
      </svg>
    ),
  },
];

export default function Landing() {
  const [setupAvailable, setSetupAvailable] = useState(false);
  const featuresRef = useReveal();
  const stepsRef = useReveal();
  const testiRef = useReveal();
  const ctaRef = useReveal();

  useEffect(() => {
    getFirstAdminSetupStatus()
      .then((res) => setSetupAvailable(res.setupAvailable))
      .catch(() => setSetupAvailable(false));
  }, []);

  return (
    <div className="landing">
      {setupAvailable && (
        <div className="landing-setup-banner">
          <span>No admin account exists yet — this platform needs one-time setup.</span>
          <Link to="/setup" className="btn btn-primary small">Set up first admin →</Link>
        </div>
      )}
      <div className="landing-bg-blob landing-bg-blob-a" />
      <div className="landing-bg-blob landing-bg-blob-b" />
      <svg className="landing-dotgrid" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="landing-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-dots)" />
      </svg>
      <div className="fx-gridfloor" style={{ position: 'fixed' }} />

      <header className="landing-topbar">
        <span className="brand">LastMile Tracker</span>
        <div className="landing-topbar-actions">
          <Link to="/login" className="btn btn-ghost small">Log in</Link>
          <Link to="/register" className="btn btn-primary small">Sign up</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">● Zone-based delivery platform</span>
          <h1 className="landing-h1">Last-mile delivery, tracked end to end</h1>
          <p className="landing-sub">
            Auto-calculated charges, zone-based agent assignment, and live status
            tracking for every order — from pickup to doorstep.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="btn btn-primary">Get started →</Link>
            <Link to="/login" className="btn btn-ghost">Track an order</Link>
          </div>
          <div className="landing-stats">
            <div><strong>12k+</strong><span>orders delivered</span></div>
            <div><strong>40+</strong><span>zones covered</span></div>
            <div><strong>98%</strong><span>on-time rate</span></div>
          </div>
        </div>

        <div className="landing-illustration tilt-card">
          <p className="small muted">Order #LM-8843 · Out for delivery</p>
          <svg viewBox="0 0 320 140" className="landing-route-svg">
            <circle cx="24" cy="110" r="6" fill="var(--success)" />
            <path
              d="M24 110 C 90 30, 200 150, 290 40"
              fill="none"
              stroke="#B5D4F4"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="landing-route-dash"
            />
            <circle cx="290" cy="40" r="7" fill="var(--brand)" />
            <circle cx="150" cy="88" r="9" fill="none" stroke="#D85A30" strokeWidth="2" />
            <circle cx="150" cy="88" r="9" fill="#F0997B" className="landing-pulse-dot" />
          </svg>
          <div className="landing-float-badge">✓ Agent 4 min away</div>
          <div className="landing-route-labels">
            <span>Warehouse</span><span>Zone C hub</span><span>Doorstep</span>
          </div>
        </div>
      </section>

      <section className="landing-features reveal-stagger reveal" ref={featuresRef}>
        {features.map((f) => (
          <div className="landing-feature-card tilt-card rs-item" key={f.title}>
            <div className="landing-feature-icon" style={{ background: f.tint, color: f.iconColor }}>
              {f.icon}
            </div>
            <p className="landing-feature-title">{f.title}</p>
            <p className="small muted">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="landing-section">
        <div className="landing-section-head reveal in-view">
          <div className="landing-section-eyebrow">How it works</div>
          <h2 className="landing-section-h2">From pickup to doorstep in 3 steps</h2>
          <p className="landing-section-sub">
            A simple, predictable flow — the same one every order follows, every time.
          </p>
        </div>
        <div className="landing-steps reveal-stagger reveal" ref={stepsRef}>
          <div className="landing-step rs-item">
            <div className="landing-step-num">1</div>
            <b>Place the order</b>
            <span>Pincode auto-detects the zone and calculates the charge instantly.</span>
          </div>
          <div className="landing-step rs-item">
            <div className="landing-step-num">2</div>
            <b>Smart assignment</b>
            <span>The nearest available agent in that zone is assigned automatically.</span>
          </div>
          <div className="landing-step rs-item">
            <div className="landing-step-num">3</div>
            <b>Live tracking</b>
            <span>Status updates flow in real time until it's handed over at the door.</span>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="landing-testimonial reveal" ref={testiRef}>
          <div className="landing-testimonial-stars">★★★★★</div>
          <p className="landing-testimonial-quote">
            "We switched our entire fleet onto LastMile in a week. Zone assignment alone cut our
            missed-delivery rate in half."
          </p>
          <div className="landing-testimonial-person">
            <span className="landing-testimonial-avatar">RK</span>
            <div style={{ textAlign: 'left' }}>
              <b>Rakesh Kumar</b>
              <span>Ops Lead, Quickship Logistics</span>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-cta-band reveal" ref={ctaRef}>
        <div className="landing-cta-band-inner">
          <div>
            <p className="landing-cta-title">Ready to ship smarter?</p>
            <p className="small">Create your account and place your first order in minutes.</p>
          </div>
          <Link to="/register" className="btn landing-cta-btn">Sign up free →</Link>
        </div>
      </div>

      <footer className="landing-footer">
        <span>© 2026 LastMile Tracker</span>
        <span>Zone detection · Smart assignment · Live tracking</span>
        {/* Deliberately small/low-emphasis — admin login isn't meant to be a
            primary CTA (see AdminLogin.jsx / setup-first-admin flow), just
            discoverable for anyone who needs it. */}
        <Link to="/admin/login" className="landing-footer-admin-link">
          Admin
        </Link>
      </footer>
    </div>
  );
}