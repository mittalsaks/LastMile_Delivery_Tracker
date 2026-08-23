import { useEffect } from 'react';

// Global cursor trail — a light stream of glowing blue dots that follows the
// pointer app-wide (matches the approved preview's "global cursor trail").
// Pure DOM + rAF, throttled so it stays cheap and never blocks interaction.
export default function CursorFx() {
  useEffect(() => {
    let lastTime = 0;
    let dots = [];

    function handleMouseMove(e) {
      const now = Date.now();
      if (now - lastTime < 25) return; // throttle for a smooth, light trail
      lastTime = now;

      const dot = document.createElement('div');
      dot.style.position = 'fixed';
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '50%';
      dot.style.background = '#60a5fa';
      dot.style.boxShadow = '0 0 6px 1px rgba(96,165,250,0.6)';
      dot.style.pointerEvents = 'none';
      dot.style.zIndex = '9999';
      dot.style.transform = 'translate(-50%, -50%)';
      dot.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      document.body.appendChild(dot);
      dots.push(dot);

      requestAnimationFrame(() => {
        dot.style.opacity = '0';
        dot.style.transform = 'translate(-50%, -50%) scale(2.4)';
      });

      setTimeout(() => {
        dot.remove();
        dots = dots.filter((d) => d !== dot);
      }, 650);

      if (dots.length > 30) {
        const oldest = dots.shift();
        if (oldest) oldest.remove();
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      dots.forEach((d) => d.remove());
      dots = [];
    };
  }, []);

  return null;
}