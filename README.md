# Smart Campus

## Free local setup

This project uses Node.js 24 and Express. For local use it stores complaints in built-in SQLite. When `DATABASE_URL` is set, the backend uses PostgreSQL instead, ready for a hosted database such as Supabase. The app does not move local SQLite complaints to PostgreSQL automatically.

The student complaint form, tracking page, feedback form, and admin dashboard use this backend. Keep the server running while using the pages.
The complaint form includes a free local AI suggestion for category, department, and priority, plus a short extractive summary. If category confidence is below 35%, the form asks the student to choose the category manually rather than applying an uncertain suggestion. Admins can correct a complaint category in its details; the responsible department is updated automatically. Its example set and safety/issue phrase checks include English, Hindi (Devanagari), and Hinglish/mixed text. Possible safety-risk wording is flagged for admin review. It also checks recent complaints for similar text in the same building/category and shows recurring issue patterns to admins. These features run locally and do not send complaint text to a paid AI service.

1. Open a terminal in this project folder.
2. Run `npm install` once to install the free Express package.
3. Run `npm start`.
4. Open `http://localhost:3000` for students or `http://localhost:3000/admin.html` for the admin dashboard.

The local SQLite database file is created automatically in `data/smart-campus.sqlite`. Photo uploads are enabled locally, but disabled by default in production unless `ENABLE_PHOTO_UPLOADS=true` is explicitly set.
Complaints previously saved in a browser's local storage are not copied into the new database automatically.

## Local demo admin login

- Username: `admin`
- Password: `admin123`

These credentials are for local testing only. The login page does not display them. Production mode refuses to start without `DATABASE_URL`, `ADMIN_USERNAME`, and an `ADMIN_PASSWORD` of at least 12 characters; set these only in the hosting provider's private environment settings.

## Backend API

- `POST /api/ai/suggest` — suggest a complaint category, department, and priority from its description
- `POST /api/complaints` — create a complaint
- `POST /api/complaints/:complaintId/track` — check tracking details using the complaint ID and roll number; private student details are not returned
- `PATCH /api/complaints/:complaintId/feedback` — submit feedback after resolution
- `POST /api/admin/login` — sign in as admin
- `GET /api/admin/complaints` — list complaints (admin session required)
- `PATCH /api/admin/complaints/:complaintId` — update status or admin remark
- The same admin complaint endpoint accepts `categoryCode` to correct a complaint's category and responsible department.

Run `npm test` to check the local API and database flow.

## Before public deployment

The app uses SQLite locally and selects PostgreSQL when `DATABASE_URL` is provided. Do not deploy the SQLite database on an ephemeral free web-service filesystem: complaints can be lost on restart, redeploy, or idle spin-down. The selected deployment direction is a private GitHub repository for source, Render Free for the Node/Express server, and Supabase Free PostgreSQL for the shared database. For Render's IPv4 network, choose Supabase's Session Pooler connection string in the Supabase dashboard. Do not use Render Free Postgres for this app; it expires after 30 days. Local SQLite complaints do not automatically transfer, and the cloud schema is created empty when the app starts.

For a Render deployment, use the Free web service plan, the Node runtime, build command `npm install`, and start command `npm start`. Set these environment variables in Render's private Environment settings:

- `NODE_ENV` = `production`
- `DATABASE_URL` = the Supabase PostgreSQL connection string (never commit or share it)
- `ADMIN_USERNAME` = your chosen admin login name
- `ADMIN_PASSWORD` = a unique password of at least 12 characters
- `ENABLE_PHOTO_UPLOADS` = `false` (or leave unset)

The backend uses the database connection string server-side; do not place it in browser JavaScript. Public complaint, tracking, AI, and admin-login requests have basic per-IP rate limits. Photo uploads are disabled in production by default; keep them off until a separate storage plan is set up. The Render Free web service sleeps after inactivity, and the Supabase Free project may pause after a week with little activity. Free plans do not include database backup downloads, so periodically export a backup manually. Review both providers' current limits before sharing a public URL.

Public complaint tracking asks for both the complaint ID and the submitter's roll number and returns only tracking fields. Feedback submission also requires the roll number. Use test data when sharing the public demo. Anyone with the public URL can submit a complaint; the URL is not restricted to friends.

## About the AI suggestions

The project uses a small Naive Bayes text classifier trained from English, Hindi, and Hinglish campus complaint examples stored in the backend code, local English/Hindi/Hinglish phrase checks for possible safety risks and common issue wording, and extractive summarization that selects a representative sentence from the complaint. Category suggestions under 35% confidence are marked for manual review instead of being offered as a definite category. Admins can correct saved categories; department assignments follow the selected category. Similar-complaint matching compares complaint words within the same building and category over the last 30 days. The admin dashboard also groups recent reports by building and category to show recurring patterns. These are teaching/demo features, not confirmed root causes or a dependable emergency detector; language support is limited to the examples and phrase patterns provided. Suggestions and summaries may be wrong or incomplete; students can choose the category themselves, and admins must verify safety alerts and recurring patterns against the original complaint. It does not make phone calls or send SMS/WhatsApp messages.
