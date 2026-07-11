# Worry Ledger

A quiet, local-first web tool for parking worries instead of carrying them. Capture a worry in seconds, rate how heavy it feels, set a check-in date. When the date arrives, record what actually happened. Over time it builds your personal evidence base, headlined by one number: how many of your worries never came true.

**Everything stays in your browser.** No backend, no accounts, no cookies, no analytics, and no external network requests of any kind. Data lives in localStorage, with JSON export and import for backup.

This is a journal with statistics, not therapy and not medical software.

## Running it

Plain HTML, CSS, and JavaScript with no build step. Because the scripts are ES modules, serve the folder over HTTP rather than opening `index.html` from disk:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying

Push to GitHub and enable GitHub Pages for the repository (Settings, Pages, deploy from branch). No build configuration needed.

## Files

- `index.html` — page structure and dialogs
- `styles.css` — the shared sage-and-white design system
- `engine.js` — pure statistics and date functions, no DOM
- `storage.js` — localStorage, export, import
- `app.js` — wires the UI to the engine and storage
