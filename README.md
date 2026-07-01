# 🍎 Calorie Tracker

A calendar-based calorie tracker that pulls **real product nutrition** from food
databases. Type in a food, pick the matching product, and its calories are added
up automatically — segregated by meal and by day.

Runs entirely in the browser and deploys free to **GitHub Pages** (no server, no
login). Your data is stored locally and can be exported/imported for backup.

## Features

- **Calendar view** — a month grid showing calories logged per day; click any
  day to open it.
- **Meals per day** — every day is split into Breakfast, Lunch, Dinner and
  Snacks.
- **Automatic calorie lookup** — type a food name and search:
  - [Open Food Facts](https://world.openfoodfacts.org/) for real packaged
    products (brands, barcodes, label nutrition) — no API key needed.
  - [USDA FoodData Central](https://fdc.nal.usda.gov/) for generic/whole foods
    (optional free API key for higher rate limits).
- **Barcode scanning** — tap the 📷 button to scan a product barcode with your
  phone camera; the product is looked up on Open Food Facts automatically.
  (Requires HTTPS — works on the deployed site and on `localhost`.)
- **Macro tracking** — protein, carbs and fat are shown per food, per meal and
  as daily totals alongside calories.
- **Recent foods** — foods you've logged before appear as one-tap quick-add
  chips, so repeat meals don't need re-searching.
- **Manual entry fallback** — add a food (with optional macros) by hand when it
  isn't found.
- **Per-serving quantities** — set how many servings you ate; calories and
  macros recompute live.
- **Daily goal + progress** — set a target and see how much you have left.
- **Export / import** — back up your diary as JSON or move it between devices.

- **Accounts & cloud sync** — sign in with Google; your diary is stored in
  Cloud Firestore and synced across all your devices, with offline support.

## Tech stack

React + TypeScript + Vite, with **Firebase** (Google Authentication + Cloud
Firestore) for sign-in and cross-device sync.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Firebase config (see below)
npm run dev            # start the dev server (http://localhost:5173)
npm run build          # type-check and build for production into dist/
npm run preview        # preview the production build locally
```

The app runs without Firebase config, but shows setup instructions instead of a
sign-in button until you provide it.

## Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and
   **create a project**.
2. **Add a Web app** (the `</>` icon). Copy the config values it shows into your
   `.env` file (`VITE_FIREBASE_*`, matching `.env.example`).
3. **Authentication → Get started → Sign-in method →** enable **Google**.
4. **Firestore Database → Create database** (start in production mode).
5. **Firestore → Rules:** paste the contents of [`firestore.rules`](firestore.rules)
   and publish. This restricts each user to their own `users/{uid}` document.
6. **Authentication → Settings → Authorized domains:** add the domains you'll
   use — `localhost` is there by default; add `mgarvey23.github.io` for the
   deployed site.
7. Restart `npm run dev` and sign in.

Your data model in Firestore is one document per user at `users/{uid}` holding
the whole diary. Any diary you created locally before signing in is migrated up
automatically on first sign-in.

## Deploying to GitHub Pages

1. Push to the `main` branch.
2. In the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on
   every push to `main`.
4. Add your Firebase config as **repository secrets** (Settings → Secrets and
   variables → Actions) using the same `VITE_FIREBASE_*` names as `.env.example`,
   so the deployed build can reach Firebase.

The Vite `base` path defaults to `/calories/` to match a project site at
`https://<user>.github.io/calories/`. The deploy workflow overrides it with the
actual repository name automatically. For a custom domain or a user/organization
site (served from the domain root), set `BASE_PATH=/` when building.

## Data model

The core types live in [`src/types.ts`](src/types.ts):

```
DiaryState
├─ settings (daily goal, USDA API key)
└─ days: { "YYYY-MM-DD": DayLog }
                          └─ meals: breakfast | lunch | dinner | snack
                                     └─ MealEntry (food + quantity)
                                                   └─ FoodItem (per-serving nutrition + source)
```

## Notes on "pulling from the web"

The app looks products up through the Open Food Facts and USDA APIs rather than
scraping arbitrary web pages. Those databases already contain millions of real
product labels (contributed and verified), which is far more reliable than
scraping — and it works from a static site with no backend. If you later want
true open-web scraping or barcode scanning with a camera, that would mean adding
a small serverless backend; the current structure leaves room for it.
