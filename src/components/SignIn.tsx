import { useState } from 'react';
import { useAuth } from '../auth';
import { isFirebaseConfigured } from '../firebase';

/**
 * Landing screen shown when signed out: a simple username + password form with
 * sign-in / create-account modes, plus a local-only option. If Firebase config
 * is missing it shows setup instructions instead.
 */
export function SignIn({ onUseLocal }: { onUseLocal: () => void }) {
  const { signIn, signUp, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || password.length < 6) return;
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(username, password);
      else await signUp(username, password);
    } catch {
      // error surfaced via the auth context
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin-card">
        <h1>🍎 Calorie Tracker</h1>

        {isFirebaseConfigured ? (
          <>
            <p>
              {mode === 'signin'
                ? 'Sign in to sync your diary across devices.'
                : 'Create an account — just a username and password.'}
            </p>
            <form className="auth-form" onSubmit={submit}>
              <input
                type="text"
                placeholder="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password (6+ characters)"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            {error && <p className="signin-error">{error}</p>}
            <button
              className="link-button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin'
                ? "New here? Create an account"
                : 'Already have an account? Sign in'}
            </button>
          </>
        ) : (
          <div className="setup-notice">
            <p><strong>Firebase isn't configured yet.</strong> You can still use the
            app locally now, and set up accounts later.</p>
            <ol>
              <li>Create a project at <code>console.firebase.google.com</code>.</li>
              <li>Add a <strong>Web app</strong> and copy its config values.</li>
              <li>Enable <strong>Authentication → Email/Password</strong>.</li>
              <li>Create a <strong>Firestore database</strong>.</li>
              <li>
                Put the config in <code>.env</code> (see <code>.env.example</code>)
                and restart the dev server.
              </li>
            </ol>
            <p className="setup-hint">Full steps are in the README.</p>
          </div>
        )}

        <button className="local-button" onClick={onUseLocal}>
          Continue without signing in
        </button>
        <p className="setup-hint">
          Local mode keeps your diary on this device only. You can sign in later to
          sync it.
        </p>
      </div>
    </div>
  );
}
