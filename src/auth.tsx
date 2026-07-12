// Authentication context: simple username + password accounts (Firebase
// Email/Password under the hood). Usernames are mapped to a synthetic email so
// users never have to enter a real one. Sessions persist, so users stay signed
// in until they sign out.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

// Synthetic email domain so a username becomes a valid Firebase login.
const EMAIL_DOMAIN = 'users.calorietracker.app';

/** Normalize a username and turn it into the synthetic login email. */
function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${EMAIL_DOMAIN}`;
}

/** Recover the display username from a signed-in user's synthetic email. */
export function usernameFromUser(user: User): string {
  return user.email?.split('@')[0] ?? 'Account';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function messageFor(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect username or password.';
    case 'auth/email-already-in-use':
      return 'That username is already taken.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please choose a username with letters or numbers.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
    case 'auth/configuration-not-found':
      return 'Accounts are not turned on yet. In Firebase → Authentication → Sign-in method, enable the provider named "Email/Password" — it powers username + password logins and never asks for an email.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

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

  async function signIn(username: string, password: string) {
    if (!auth) return;
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    } catch (err) {
      setError(messageFor((err as { code?: string }).code));
      throw err;
    }
  }

  async function signUp(username: string, password: string) {
    if (!auth) return;
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
    } catch (err) {
      setError(messageFor((err as { code?: string }).code));
      throw err;
    }
  }

  async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
  }

  const value: AuthContextValue = { user, loading, error, signIn, signUp, signOutUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { isFirebaseConfigured };
