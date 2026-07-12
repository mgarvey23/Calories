import { useAuth } from '../auth';
import { isFirebaseConfigured } from '../firebase';

/**
 * Landing screen shown when signed out. If Firebase config is missing it shows
 * setup instructions instead of a broken sign-in button.
 */
export function SignIn({ onUseLocal }: { onUseLocal: () => void }) {
  const { signIn, error } = useAuth();

  return (
    <div className="signin">
      <div className="signin-card">
        <h1>🍎 Calorie Tracker</h1>

        {isFirebaseConfigured ? (
          <>
            <p>Sign in to sync your diary across devices.</p>
            <button className="google-button" onClick={signIn}>
              <span className="google-g">G</span> Sign in with Google
            </button>
            {error && <p className="signin-error">{error}</p>}
          </>
        ) : (
          <div className="setup-notice">
            <p><strong>Firebase isn't configured yet.</strong> You can still use the
            app locally now, and set up sign-in later.</p>
            <ol>
              <li>Create a project at <code>console.firebase.google.com</code>.</li>
              <li>Add a <strong>Web app</strong> and copy its config values.</li>
              <li>Enable <strong>Authentication → Google</strong> sign-in.</li>
              <li>Create a <strong>Firestore database</strong>.</li>
              <li>
                Put the config in a <code>.env</code> file (see <code>.env.example</code>)
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
