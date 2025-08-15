# Deployments Explorer (Fluid contract deployments)

Minimal dark-themed web app to browse `deployments.md` in a searchable, filterable UI.

## Features
- Search by contract, address, args, salt
- Filter by Network and Category
- Card and Table views
- Modal with full details per section
- Works offline; no build step or backend required

## Quick start

### Option A: Open the file (no server)
1. Open `index.html` in your browser
2. Click "Load file" and select `deployments.md`

Open from terminal (choose your OS):
```bash
# macOS
open index.html
# Windows
start index.html
# Linux (most distros)
xdg-open index.html
```

### Option B: Serve locally (recommended)
From the project directory:
```bash
# Python (3.x)
python3 -m http.server 5173
# or Node
npx http-server -p 5173 .
```
Then open `http://localhost:5173`.

Serving avoids file:// CSP/CORS issues and auto-loads `deployments.md`.

## Deploy (GitHub Pages)
1. Commit `index.html`, `styles.css`, `app.js`, and `deployments.md`
2. Enable GitHub Pages for the repo (Deploy from branch → `main`, root)
3. Visit the Pages URL (the app will fetch `./deployments.md`)

## File structure
```
index.html      # App shell
styles.css      # Dark UI styles
app.js          # Markdown parser + UI logic
deployments.md  # Data source (large markdown with tables)
```

## Notes
- If `deployments.md` changes format, the simple table parser may need updates
- Fallback "Load file" supports browsing any compatible markdown file
- No external dependencies; all logic runs in the browser
