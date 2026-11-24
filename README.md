# MealBlock — Meal Planner & Weight Tracker

A mobile-first, offline-capable web app (PWA) with on-device storage (`localStorage`), ready to host for free on **GitHub Pages**.

## Features
- **Variable Daily Meal Slots**: Add/remove slots freely (up to 20 per day), reorder them, rename labels, adjust portions (`0.5x`, `1x`, `1.5x`, `2x`), copy yesterday's plan, or save your slot layout as default.
- **Fixed Meal Blocks Library**: Save reusable meals with calories (`kcal`), protein (`g`), category, default time, and notes, then swap them into any day's slots in one tap.
- **Adjustable Daily Targets**: Edit daily calorie (`kcal`), protein (`g`), and optional goal weight (`kg`) anytime with live progress bars.
- **Daily Weight Tracker & Chart (kg)**: Log daily weights in `kg` with an interactive SVG trend chart, 7-day rolling average line, goal line, and range filters (`7D`, `30D`, `90D`, `All`).
- **Meal Schedule & Timer**: Set eating times per slot, view a 7-day overview strip and daily timeline, and track the countdown to your next scheduled meal (or start quick `+30m` / `+1h` / `+2h` / `+3h` timers) with optional chime and browser alerts while open.
- **On-Device Storage & JSON Backup**: Export and import full `.json` backups from **Settings**.

## Host for Free on GitHub Pages

1. Create a new repository on GitHub (e.g., `meal-planner`).
2. Upload all files and folders from this directory (`index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icons/`, `js/`) to the repository root (either via GitHub's **Add file → Upload files** page or `git push`).
3. On GitHub, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**, select **`main`** and **`/ (root)`**, then click **Save**.
5. After ~1 minute, GitHub will show your live URL: `https://<your-username>.github.io/<repo-name>/`.

## Add to Your Phone Home Screen
- **iPhone (Safari):** Open your GitHub Pages URL → tap **Share** → **Add to Home Screen**.
- **Android (Chrome):** Open your GitHub Pages URL → tap the **⋮** menu → **Install app** (or **Add to Home screen**).
