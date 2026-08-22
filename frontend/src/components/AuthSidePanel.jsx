function FloatingParticles({ count = 14 }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    left: Math.random() * 100,
    top: 35 + Math.random() * 55,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 8,
  }));
  return (
    <div className="fx-particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="fx-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function AuthSidePanel() {
  return (
    <div className="auth-side">
      <svg className="auth-side-dotgrid" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,0.07)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>
      <div className="auth-side-blob auth-side-blob-a" />
      <div className="auth-side-blob auth-side-blob-b" />
      <div className="fx-gridfloor" />
      <FloatingParticles />

      <div className="auth-side-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
          <path d="M1 6h13v10H1z" />
          <path d="M14 10h4l4 4v2h-8z" />
          <circle cx="6" cy="19" r="1.8" fill="#60a5fa" stroke="none" />
          <circle cx="17" cy="19" r="1.8" fill="#60a5fa" stroke="none" />
        </svg>
        LastMile Tracker
      </div>

      <div className="auth-side-mid">
        <p className="auth-side-headline">Every order,<br />tracked to the door.</p>
        <svg viewBox="0 0 260 110" className="auth-side-route">
          <circle cx="20" cy="90" r="5" fill="#4ade80" />
          <path
            d="M20 90 C 70 30, 160 120, 240 30"
            fill="none"
            stroke="rgba(96,165,250,0.5)"
            strokeWidth="3"
            strokeDasharray="6 6"
            className="auth-side-dash"
          />
          <circle cx="240" cy="30" r="6" fill="#60a5fa" />
          <circle cx="130" cy="75" r="8" fill="none" stroke="#fb923c" strokeWidth="2" />
          <circle cx="130" cy="75" r="8" fill="#fb923c" className="auth-side-pulse" />
        </svg>
      </div>

      <div className="auth-side-stats">
        <div>
          <div className="auth-side-stat-num">12k+</div>
          <div className="auth-side-stat-label">orders delivered</div>
        </div>
        <div>
          <div className="auth-side-stat-num">98%</div>
          <div className="auth-side-stat-label">on-time rate</div>
        </div>
      </div>
    </div>
  );
}