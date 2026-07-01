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
- **Manual entry fallback** — add a food (with optional macros) by hand when it
  isn't found.
- **Per-serving quantities** — set how many servings you ate; calories and
  macros recompute live.
- **Daily goal + progress** — set a target and see how much you have left.
- **Export / import** — back up your diary as JSON or move it between devices.

## Tech stack

React + TypeScript + Vite. No backend — the diary lives in `localStorage`.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and build for production into dist/
npm run preview  # preview the production build locally
```

## Deploying to GitHub Pages

1. Push to the `main` branch.
2. In the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on
   every push to `main`.

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
