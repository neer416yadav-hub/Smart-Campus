# Smart Campus

## Free local setup

This project uses Node.js 24 and Express. For local use it stores complaints in built-in SQLite. When `DATABASE_URL` is set, the backend uses PostgreSQL instead, ready for a hosted database such as Supabase. The app does not move local SQLite complaints to PostgreSQL automatically.

The student complaint form, tracking page, feedback form, and admin dashboard use this backend. Keep the server running while using the pages.
The complaint form includes a free local AI suggestion for category, department, and priority, plus a short extractive summary. If category confidence is below 35%, the form asks the student to choose the category manually rather than applying an uncertain suggestion. Admins can correct a complaint category in its details; the responsible department is updated automatically. Its example set and safety/issue phrase checks include English, Hindi (Devanagari), and Hinglish/mixed text. Possible safety-risk wording is flagged for admin review. It also checks recent complaints for similar text in the same building/category and shows recurring issue patterns to admins. These features run locally and do not send complaint text to a paid AI service.

1. Open a terminal in this project folder.
2. Run `npm install` once to install the free Express package.
3. Run `npm start` (or `npm run dev` to auto-restart the server when a file changes).
4. Open `http://localhost:3000` for students or `http://localhost:3000/admin.html` for the admin dashboard.

If port 3000 is already taken, start on a different port instead:

- Windows PowerShell: `$env:PORT='3001'; npm start`
- macOS / Linux: `PORT=3001 npm start`

The local SQLite database file is created automatically in `data/smart-campus.sqlite`. Photo uploads are enabled locally, but disabled by default in production unless `ENABLE_PHOTO_UPLOADS=true` is explicitly set.
Complaints previously saved in a browser's local storage are not copied into the new database automatically.

## Interface and features

The student page and the admin dashboard share one design system (`ui.css` + `theme.js`) so both look and behave the same.

Student page (`index.html`):

- Dark mode toggle with system-preference detection; the choice is remembered in the browser.
- Animated aurora background, glass surfaces, gradient buttons with a click ripple, and scroll-reveal animations. `prefers-reduced-motion` is respected.
- Live "Campus Snapshot" strip (total complaints, resolution rate, average resolution time, top category) that refreshes every 60 seconds.
- "My Complaints" list stored only in the browser's local storage, with one-click tracking and a copy-ID button. It is never uploaded to the server.
- Character counter and a live priority estimate while you type the description.
- Structured AI suggestion card (category, department, priority, confidence) with an emergency warning banner.
- Toast notifications instead of browser `alert()` popups, plus a printable complaint receipt with a copy-ID action.
- Full status history timeline on the tracked complaint.

Admin dashboard (`admin.html`):

- Same dark mode, glass cards, animated counters and toasts.
- Summary cards for total, submitted, in progress, resolved, resolution rate, and average resolution time.
- Donut chart of the category mix, animated category bars, and the existing AI safety / recurring-issue panels.
- **Export CSV** button that downloads exactly the rows currently visible after filtering and sorting.
- **Auto refresh** switch (every 15 seconds) with a "last updated" timestamp.
- Search, filters, sorting, status updates, category correction, admin remarks and feedback viewing all work as before.

## Local demo admin login

- Username: `admin`
- Password: `admin123`

These credentials are for local testing only. The login page does not display them. Production mode refuses to start without `DATABASE_URL`, `ADMIN_USERNAME`, and an `ADMIN_PASSWORD` of at least 12 characters; set these only in the hosting provider's private environment settings. There is no separate teacher login: only the configured admin account can open the admin dashboard.

## Student accounts

Students create an account on the login page (`/login.html`) with their name, roll number, and a password of at least 8 characters. Accounts are stored in the `students` table, and passwords are kept only as salted scrypt hashes. Logging in sets a signed, HttpOnly `smartCampusStudentSession` cookie. `GET /api/student/complaints` returns only the complaints submitted with that account's roll number, and the cookie is tied to the stored password hash so replacing a password invalidates old sessions. Registration and login are rate limited. The admin dashboard is not accessible with a student account.

## Backend API

- `POST /api/student/register` — create a student account and sign in
- `POST /api/student/login` — sign in with roll number and password
- `POST /api/student/logout` — clear the student session cookie
- `GET /api/student/session` — check whether a student is signed in
- `GET /api/student/complaints` — complaints belonging to the signed-in student (student session required)
- `POST /api/ai/suggest` — suggest a complaint category, department, and priority from its description
- `POST /api/complaints` — create a complaint
- `POST /api/complaints/:complaintId/track` — check tracking details using the complaint ID and roll number; private student details are not returned
- `GET /api/stats` — public aggregate counters (total, by status, by priority, resolution rate, average resolution hours, average feedback rating, top categories/departments/buildings). No student data is returned
- `PATCH /api/complaints/:complaintId/feedback` — submit feedback after resolution
- `POST /api/admin/login` — sign in as admin
- `GET /api/admin/complaints` — list complaints (admin session required)
- `PATCH /api/admin/complaints/:complaintId` — update status or admin remark
- The same admin complaint endpoint accepts `categoryCode` to correct a complaint's category and responsible department.

Every status change is recorded on the complaint as a `statusHistory` entry (status, timestamp, note). Setting a complaint to `Resolved` stamps `resolvedAt`; moving it back to another status clears that stamp, which is what the resolution-rate and average-resolution-time figures are computed from.

Run `npm test` to check the local API and database flow.

## Before public deployment

The app uses SQLite locally and selects PostgreSQL when `DATABASE_URL` is provided. Do not deploy the SQLite database on an ephemeral free web-service filesystem: complaints can be lost on restart, redeploy, or idle spin-down. The selected deployment direction is a private GitHub repository for source, Render Free for the Node/Express server, and Supabase Free PostgreSQL for the shared database. For Render's IPv4 network, choose Supabase's Session Pooler connection string in the Supabase dashboard. Do not use Render Free Postgres for this app; it expires after 30 days. Local SQLite complaints do not automatically transfer, and the cloud schema is created empty when the app starts.

For a Render deployment, use the Free web service plan, the Node runtime, build command `npm install`, and start command `npm start`. Set these environment variables in Render's private Environment settings:

- `NODE_ENV` = `production`
- `DATABASE_URL` = the Supabase PostgreSQL connection string (never commit or share it)
- `ADMIN_USERNAME` = your chosen admin login name
- `ADMIN_PASSWORD` = a unique password of at least 12 characters
- `ENABLE_PHOTO_UPLOADS` = `false` (or leave unset)

Alternatively, `render.yaml` in this repository is a Render Blueprint for the web service (health check, `NODE_ENV`, Node version, and the required environment variables). Deploy it with **New → Blueprint** and paste your existing `DATABASE_URL` when prompted. If you prefer Render to create and wire the database for you, the commented-out `databases:` block at the bottom of `render.yaml` does that automatically.

### Fixing a failed deploy (`password authentication failed for user "postgres"`)

This error means the password inside `DATABASE_URL` does not match the database. The app never touches the password, so it is always an environment-variable problem:

1. Open the database provider dashboard (Supabase, Render, …) and copy the connection string again.
2. Make sure no placeholder is left in it. Supabase strings start as `postgres://postgres:[YOUR-PASSWORD]@…` and the `[YOUR-PASSWORD]` part must be replaced with the real database password. If the password contains `@`, `:`, `/`, `#`, or `?`, it must be URL-encoded (for example `@` → `%40`).
3. Paste the full string into `DATABASE_URL` on the hosting provider (Render → Environment).
4. Save and run **Manual Deploy → Clear build cache & deploy**.
5. If the database was recreated, copy the new connection string — the old password stops working.

For Supabase on Render, use the **Session Pooler** connection string from **Project Settings → Database → Connection pooling**. If the password contains special characters, reset it in Supabase and use a simpler one.

The server prints a readable diagnosis on startup, for example:

```
Smart Campus could not connect to PostgreSQL.

  host:     aws-0-ap-south-1.pooler.supabase.com:5432
  database: postgres
  user:     postgres.abcdefghijklmnop
  error:    password authentication failed for user "postgres" (code 28P01)

How to fix it:

  The password or username in DATABASE_URL is wrong.
  ...
```

It also retries transient connection failures (database still starting, DNS not ready) up to five times with backoff before giving up, which avoids most "database was not ready" deploy failures.

### Deploying to Vercel

Vercel runs serverless functions, so `server.js` (which calls `app.listen`) cannot be deployed as-is. This repository includes:

- `api/index.js` — a thin Vercel handler that builds the Express app once per instance and forwards every request to it.
- `vercel.json` — routes all traffic to that handler and bundles the HTML, CSS, JS and image files with it.

Deploy with **New Project → import the repository**. The defaults work, but you should add these environment variables under **Settings → Environment Variables**:

- `DATABASE_URL` = your PostgreSQL connection string (recommended — without it the app runs in demo mode, see below)
- `ADMIN_USERNAME` = your admin login name
- `ADMIN_PASSWORD` = a unique password of at least 12 characters

**Demo mode (no environment variables).** Vercel's filesystem is read-only apart from `/tmp`, so if `DATABASE_URL` is missing the app falls back to a temporary SQLite file in `/tmp` and starts with the default demo admin login (`admin` / `admin123`). That keeps the page reachable, but anything submitted is lost when the function instance recycles, and different instances do not share data. Use it only to preview the interface — add `DATABASE_URL` and a real `ADMIN_PASSWORD` before sharing the URL. `/api/health` reports `"database": "sqlite-temp"` and `"persistent": false` while demo mode is active.

If a required variable is missing outside demo mode, the function returns a JSON error explaining exactly which one, instead of an opaque `500 FUNCTION_INVOCATION_FAILED`. Check it at `https://<project>.vercel.app/api/health`.

A note on platform choice: Render (a long-running server) fits this app better than Vercel, because Vercel spins a new instance at any time and cannot keep a local SQLite file. On Vercel, always use a hosted PostgreSQL database such as Supabase or Neon.

The backend uses the database connection string server-side; do not place it in browser JavaScript. Public complaint, tracking, AI, and admin-login requests have basic per-IP rate limits. Photo uploads are disabled in production by default; keep them off until a separate storage plan is set up. The Render Free web service sleeps after inactivity, and the Supabase Free project may pause after a week with little activity. Free plans do not include database backup downloads, so periodically export a backup manually. Review both providers' current limits before sharing a public URL.

Public complaint tracking asks for both the complaint ID and the submitter's roll number and returns only tracking fields. Feedback submission also requires the roll number. Use test data when sharing the public demo. Anyone with the public URL can submit a complaint; the URL is not restricted to friends.

## About the AI suggestions

The project uses a small Naive Bayes text classifier trained from English, Hindi, and Hinglish campus complaint examples stored in the backend code, local English/Hindi/Hinglish phrase checks for possible safety risks and common issue wording, and extractive summarization that selects a representative sentence from the complaint. Category suggestions under 35% confidence are marked for manual review instead of being offered as a definite category. Admins can correct saved categories; department assignments follow the selected category. Similar-complaint matching compares complaint words within the same building and category over the last 30 days. The admin dashboard also groups recent reports by building and category to show recurring patterns. These are teaching/demo features, not confirmed root causes or a dependable emergency detector; language support is limited to the examples and phrase patterns provided. Suggestions and summaries may be wrong or incomplete; students can choose the category themselves, and admins must verify safety alerts and recurring patterns against the original complaint. It does not make phone calls or send SMS/WhatsApp messages.
