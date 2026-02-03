# Moderator Daily Logger

A local-first moderator productivity tracker built with Express and SQLite. It stores daily totals and individual response logs on disk, then surfaces analytics dashboards and CSV exports.

## Features
- Persistent SQLite database stored at `data/moderator.db`.
- Daily stats form (tickets + working hours).
- Response logger with automatic response-time calculation.
- Analytics dashboard (averages, fastest/slowest, per-day totals, date range totals).
- CSV export for daily stats and response logs.
- Inline edit/delete actions.

## Folder Structure
```
.
├── data/
│   └── moderator.db
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
├── server.js
└── README.md
```

## Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open the app:
   ```
   http://localhost:3000
   ```

## Notes
- Data is stored on disk in SQLite and will persist across refreshes, restarts, and redeploys.
- Exports are available via the "Export" buttons in the UI.
