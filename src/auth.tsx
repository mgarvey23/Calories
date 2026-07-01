// Authentication context: exposes the current Google-signed-in user and
// sign-in / sign-out actions to the rest of the app.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

interface AuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: User | null;
  /** True until the initial auth state has been resolved. */
  loading: boolean;
  /** Last sign-in error message, if any. */
  error: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function signIn() {
    if (!auth) return;
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError('Sign-in failed. Please try again.');
    }
  }

  async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
  }

  const value: AuthContextValue = { user, loading, error, signIn, signOutUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { isFirebaseConfigured };
