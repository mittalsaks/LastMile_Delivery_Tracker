import { useEffect, useRef } from 'react';

// Renders Google's official "Sign in with Google" button using the Google
// Identity Services script loaded in index.html. On success, Google calls
// back with a JWT ID token (`response.credential`) which we hand up to the
// parent via onCredential — the parent is responsible for sending it to
// POST /api/auth/google (see AuthContext.loginWithGoogle).
//
// If VITE_GOOGLE_CLIENT_ID isn't configured, this renders nothing rather
// than a broken/erroring button — Google Sign-In is optional, email/password
// login always still works.
export default function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onCredential(response.credential);
          } else {
            onError?.('Google did not return a credential. Please try again.');
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };

    // The GSI script (index.html) loads async — poll briefly until it's ready
    // instead of assuming it's already on window.google at mount time.
    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 200);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [clientId, onCredential, onError]);

  if (!clientId) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
      <div ref={buttonRef} />
    </div>
  );
}
