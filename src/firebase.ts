// ---------------------------------------------------------------------------
// Firebase initialization.
//
// Config comes from Vite env vars (VITE_FIREBASE_*) so no secrets are committed
// to the repo. Firebase web API keys are not secret in the usual sense — access
// is controlled by Firestore security rules and the list of authorized domains
// — but keeping them in env vars keeps the repo clean and per-environment.
//
// If the config is absent the app still loads and shows setup instructions
// instead of crashing, which makes first-time setup easier.
// ---------------------------------------------------------------------------

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

// Tolerate values that were pasted with surrounding quotes or whitespace
// (a common mistake when copying from the firebaseConfig snippet).
function clean(v: string | undefined): string | undefined {
  return v?.trim().replace(/^['"]|['"]$/g, '').trim();
}

const config = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
};

/** True when the minimum config needed to talk to Firebase is present. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  // Enable an on-device cache so the diary keeps working offline and syncs
  // automatically when the connection returns.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    // Optional fields (e.g. a body scan with only some metrics filled) can be
    // undefined; without this, setDoc rejects the whole write and data is lost.
    ignoreUndefinedProperties: true,
  });
}

export const auth = authInstance;
export const db = dbInstance;
