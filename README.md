# Tripvero

**Plan Together. Spend Smarter. Travel Better.**

A working React + Express + MongoDB application for group travel planning, shared expenses, personal spending, budgets, ledgers and settlements. Primary records live in MongoDB; browser storage is used only for the theme. Tripvero records payments made elsewhere and does not move money.

## Start locally — easiest option

Requires Node.js **22.12+** (Node 24 is supported), npm, and internet access for the first dependency/MongoDB binary download.

```sh
git clone https://github.com/SarimSheikh1/Tripvero.git
cd Tripvero
npm install
npm run dev:local
```

Open **http://localhost:5173**. Register your own account and create a trip. This command launches a real MongoDB `mongod` process, initializes a single-node replica set for transactions, and starts the API and frontend. It binds the database to loopback and preserves data in `server/.local-data`. No MongoDB installation or cloud account is required for this development option.

Sample accounts are removed. Normal users register through the app. With the local app running, open a second terminal and run `npm run admin:local`. This creates a separate app administrator and saves its random password in the ignored `ADMIN-CREDENTIALS.txt`. Existing admin passwords are preserved on repeated runs. Only the four old sample accounts and their sample-owned trips are removed; migration stops if they are connected to real members or trips.

Sign in with the administrator credentials and open `/app/admin`. The dashboard shows registered users, signed-in active users over 24 hours / 7 days, new users, successful login counts, trips and expenses, plus the latest 100 users. Tracking begins with this update; anonymous visitors are not counted. For a configured database, use `npm run admin:setup`. Optional `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables customize the initial credentials. Never publish the credentials file.

Every trip now includes **Hotels & travel choices**: named hotel/provider quotes, group voting, total and per-person costs, and bus/car comparison using your own return fares, distance, fuel, hire, tolls and passenger capacity. These are estimates, not live hotel listings, bookings or verified prices. Votes do not create expenses. The lowest transport estimate is recommended; hotel favourites follow votes, with cost breaking ties.

Stop with Ctrl+C. Restarting preserves the local database. The ignored `.env.local`, `.local-secret`, `.local-data`, upload directory, and binary cache are never committed. This helper uses `mongodb-memory-server` to manage an actual MongoDB binary; the application's local database is disk-backed, not an in-memory array or localStorage implementation.

## Use your own MongoDB

Use MongoDB Atlas or a MongoDB replica set. A standalone MongoDB process without a replica set cannot run the application's multi-record transactions.

1. Run `npm install` in the root. npm workspaces install both client and server dependencies.
2. Copy `server/.env.example` to `server/.env`.
3. Set `MONGODB_URI` and replace `JWT_SECRET` with a cryptographically random secret of at least 32 characters.
4. Set `CLIENT_URL=http://localhost:5173` for development.
5. Run `npm run dev` at the root to start both applications. Alternatively run `npm run dev -w server` and `npm run dev -w client` in separate terminals.
6. Run `npm run admin:setup` to create the administrator on that database.

Generate a secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Never share or commit that output. For local replica-set installation, start MongoDB with `--replSet rs0`, initialize `rs.initiate()` in mongosh, and use a URI including `?replicaSet=rs0`.

## Implemented product modules

- Public landing page, mobile menu, original pin/wallet wordmark and favicon.
- Registration, login, remember-me, JWT in an HttpOnly cookie, token expiry, logout with revocation, current-user route, editable profile, private profile photo, theme and notification preferences.
- Password reset endpoints and UI backed by one-use hashed reset tokens; SMTP configuration is required to deliver reset links. The email service is reusable for invitations and future verification/reminders.
- Multiple isolated trips, trip creation/editing, destination/dates/type/currency/budget, invitation codes and links, rotation, existing-user member addition, roles, archive/reopen, leave and confirmed owner-only permanent deletion.
- Main and per-trip dashboards with real totals, countdown, category/member/daily charts, daily budget, forecast, rule-based insights, trip health and recap statistics.
- Expense creation/edit/delete, custom categories, multiple payers, chosen participants, four split methods, personal expenses, notes, private receipt uploads, preview, search, date/category/member/amount/shared-personal filters and pagination.
- Group ledger showing paid, shared responsibility, personal spending, settlements sent/received and net balance.
- Smart settlement suggestions, actual payment recording, method/reference/proof/notes, overpayment rejection, removal and immediate balance recalculation.
- Trip/category budgets with approaching-limit warnings and calculated remaining amounts.
- Accommodation nights × rooms × nightly price, booking details/screenshot and optional linked expense; transport bookings and fuel fields; shared/personal meal records with optional expense creation.
- Day/time/location/cost itinerary with assignment, edit/delete/completion and reordering within a day; categorized travel checklist with assignment/completion.
- Authenticated document storage, gallery upload/grid/lightbox/delete, author-owned comments on expenses/itinerary/activity, activity feed and in-app notifications with read/unread/delete/mark-all-read.
- Authenticated Socket.IO connections and trip rooms, membership checks and updates on expenses, settlements, planning, members and comments.
- Trip-wide search, per-trip reports, full expense/member/settlement/ledger/summary CSV exports, spreadsheet-formula escaping, printable reports and browser Save as PDF.
- Light/dark themes, desktop sidebar, tablet drawer, mobile bottom navigation and quick expense action, empty/loading/error states, accessible native dialogs, focus styles and destructive confirmations.

### Financial rules

All split and ledger calculations use integer cents. Equal, percentage and share splits use largest-remainder allocation so rounded participant shares exactly equal the total. Exact splits and multiple-payer totals must match the expense. Participants and payers must be members of the same trip.

A positive balance is receivable; a negative balance is payable. A settlement increases the sender's balance and decreases the recipient's balance. A personal expense must be paid by and allocated only to its author, so it does not shift shared debt. Settlements cannot exceed the sender's debt or recipient's receivable. Mutating financial records uses MongoDB transactions and a shared trip revision to serialize concurrent changes.

For **up to 12 unsettled travelers**, settlement optimization partitions zero-sum balances to find the minimum number of transfers. Larger groups use a fast largest-debtor/largest-creditor simplification; that result is valid but not guaranteed globally minimal, and the UI explicitly says so. Supporting exact optimization for arbitrarily large groups would require an asynchronous solver because the general problem is exponential.

Members with any expense or settlement history cannot be removed, to preserve financial identities. Assign viewer access instead. Archived trips are read-only. Editing a booking or meal after a linked expense is created does not silently change that financial entry: edit the expense explicitly under Expenses. Deleting a planning record also preserves its linked expense.

Currencies supported: PKR, USD, AED, SAR, EUR and GBP. Each trip has one currency. Dashboard totals are grouped by currency without inventing exchange rates.

## Architecture

```text
Tripvero/
├── client/
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── components/     # Shell, dialogs, financial forms, charts, planning
│   │   ├── context/        # Session context
│   │   ├── pages/          # Landing, auth, dashboard, trip, reports, profile
│   │   ├── services/       # Axios, formatting and CSV export
│   │   ├── App.jsx         # Lazy-loaded route tree
│   │   ├── main.jsx
│   │   └── styles.css      # Shared theme and responsive layouts
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/
│   ├── config/             # Environment validation
│   ├── controllers/        # Auth, trips, finances and planning records
│   ├── middleware/         # Authentication, permissions, CSRF, errors
│   ├── models/             # Mongoose models and references
│   ├── routes/             # REST API routes
│   ├── services/           # Money engine, transactions, events, email, storage
│   ├── sockets/            # Authenticated real-time rooms
│   ├── tests/              # Finance and real MongoDB integration tests
│   ├── uploads/            # Private, ignored local files
│   ├── utils/              # Validation and errors
│   ├── app.js
│   ├── server.js
│   ├── seed.js
│   ├── .env.example
│   └── package.json
├── scripts/dev-local.mjs   # Persistent local MongoDB + app launcher
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── compose.yaml
├── README.md
├── LOCAL-DEVELOPMENT.md
├── package-lock.json
└── package.json
```

Stack: React, Vite, JavaScript, Tailwind CSS, React Router, Axios, Lucide, Recharts, Framer Motion, React Hot Toast, Express 5, Mongoose, MongoDB, bcryptjs, JWT, Socket.IO, Multer, Zod, Nodemailer, Helmet and express-rate-limit.

## Environment variables

See `server/.env.example`. Required: `MONGODB_URI`, `JWT_SECRET`. Optional/runtime: `PORT` (5000), `CLIENT_URL` (http://localhost:5173), `NODE_ENV`.

SMTP: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`. No email is sent when the transport is unconfigured. Invitation codes/links remain usable. Public forgot-password responses do not reveal whether an email address exists.

Cloudinary placeholders: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. The current storage provider is local private storage behind authenticated download routes. The service interface is ready to replace with a private signed Cloudinary provider; these variables alone do not enable external hosting.

Client: `VITE_API_URL=/api` by default. Vite proxies `/api` and `/socket.io` to the local backend. Production serves the frontend and API from the same origin, retaining secure cookie and file behavior.

## API overview

Authenticated requests use the `tripvero` cookie. All writes require `X-Tripvero-Request: 1`. Browser requests must come from the configured `CLIENT_URL`.

| Routes                                                   | Methods / purpose                                               |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `/api/health`                                            | GET health                                                      |
| `/api/auth/register`, `/login`, `/logout`                | POST session actions                                            |
| `/api/auth/me`                                           | GET current user                                                |
| `/api/auth/forgot-password`, `/reset-password`           | POST reset actions                                              |
| `/api/users/me`                                          | PATCH profile                                                   |
| `/api/users/me/avatar`                                   | POST multipart photo                                            |
| `/api/users/:userId/avatar`                              | GET private photo for self/shared trip members                  |
| `/api/trips`                                             | GET collection, POST create                                     |
| `/api/trips/join`                                        | POST invite code                                                |
| `/api/trips/:tripId`                                     | GET detail/analytics, PATCH edit, DELETE with name confirmation |
| `/api/trips/:tripId/status`                              | PATCH archive/reopen                                            |
| `/api/trips/:tripId/invite`, `/invite/rotate`            | POST invitations / invalidate old code                          |
| `/api/trips/:tripId/members`                             | GET members, POST add                                           |
| `/api/trips/:tripId/members/:userId`                     | PATCH role, DELETE remove/leave                                 |
| `/api/trips/:tripId/expenses`                            | GET filtered page, POST create                                  |
| `/api/trips/:tripId/expenses/:recordId`                  | PATCH edit, DELETE                                              |
| `/api/trips/:tripId/settlements`                         | GET, POST payment                                               |
| `/api/trips/:tripId/settlements/:recordId`               | DELETE payment                                                  |
| `/api/trips/:tripId/budget`                              | GET detail/analytics, PATCH category budgets                    |
| `/api/trips/:tripId/ledger`, `/reports`                  | GET detail with computed ledger/reports                         |
| `/api/trips/:tripId/search?q=...`                        | GET trip-wide search                                            |
| `/api/trips/:tripId/itinerary/reorder`                   | POST ordered IDs                                                |
| `/api/trips/:tripId/{section}`                           | GET, POST; PATCH/DELETE `/:recordId`                            |
| `/api/trips/:tripId/documents/upload`, `/gallery/upload` | POST multipart `file`                                           |
| `/api/trips/:tripId/documents/:recordId/file`            | GET private inline/download file                                |
| `/api/notifications`                                     | GET notifications                                               |
| `/api/notifications/read-all`                            | PATCH mark all read                                             |
| `/api/notifications/:notificationId`                     | PATCH read/unread, DELETE                                       |

Sections: accommodations, transport, food, itinerary, checklist, documents, gallery, comments, activity. Files are created through upload endpoints; activity is append-only. Most planning lists return at most 500 records; expense lists use page/limit with a maximum of 100 per request.

## Verification

```sh
npm test
npm run build
npm exec prettier -- --check client/src server scripts
```

The tests start a temporary **real MongoDB replica set**, cover register/login/logout, trip create/edit/invite/join, ownership and viewer restrictions, expense create/edit/delete, splits, personal expenses, ledger conservation, settlement recording/rejection/deletion, category budgets, upload signature validation/private access, accommodation expenses, itinerary/comments, archive protection, CSRF and trip deletion.

Tests download MongoDB on the first run, need process-launch permission, and never target the production URI. Financial unit tests include rounded cents, exact/percentage/share validation and minimum-transfer optimization.

Browser verification includes seeded sign-in, expense creation with updated totals/ledger, desktop layout and a 390px mobile viewport. It supplements automated tests; this project still needs an independent security review and acceptance testing before a commercial launch.

Screenshots: add reviewed release captures here, or see screenshots supplied with the local project delivery. No fake product screenshots are used as live application data.

## Deployment

### Node hosting with MongoDB Atlas

1. Set up a MongoDB replica set/Atlas database with a restricted application user.
2. Install dependencies and run `npm run build`.
3. Set `NODE_ENV=production`, a strong `JWT_SECRET`, `MONGODB_URI`, and the exact HTTPS `CLIENT_URL`.
4. Start with `npm start` (or `node server/server.js` with variables exported into the environment).
5. Terminate HTTPS at your hosting proxy; keep `/api` and `/socket.io` on the same origin. Secure cookies require HTTPS.
6. Give uploads durable private storage. Back up MongoDB and files together. Multiple API instances need a shared upload provider and Socket.IO adapter.
7. Configure SMTP if you need email invitations/reset. Keep secrets in the host's secret store.

`Dockerfile` builds the frontend and serves it from Express. For a local container deployment, set a root `.env` from `.env.example`, replace the secret, and run `docker compose up --build`. Open http://localhost:5000. The included MongoDB service has persistent volumes and replica-set initialization; it is not exposed outside the container network. Containers are provided as deployment configuration; Docker was not available for validation in the build environment.

The development launcher is not a production service manager. Do not deploy sample accounts, a loopback development database, or development secrets. Use HTTPS, restricted database credentials, backup/restore checks and durable private file storage for a public service.

## Security and practical limits

Passwords are bcrypt-hashed and excluded from responses. JWTs are HttpOnly, same-site cookies with expiry and revocation. Backend membership/role checks protect every trip route; frontend visibility is only a convenience. Financial mutations recheck membership inside transactions. Input is allowlisted through Zod/Mongoose, query text is escaped, rate limits and Helmet are enabled, CORS is restricted and requests include a CSRF guard.

Uploads allow JPG/PNG/WEBP/PDF only, check extension/MIME/header signature, enforce an 8 MB limit and use random filenames. They are never served through a public static uploads directory. Every member can access the trip's documents, including receipts and IDs; this is stated before upload. Content scanning/OCR and malware scanning are future integrations. Root secrets, files, local database and binaries are ignored by Git.

Available functionality is implemented, but a commercial launch is not certified by the build/test checks. Automatic scheduled reminders, email verification UI, full Urdu/Arabic translation, live currency conversion, maps, external bookings, payment processing, OCR and push delivery are not enabled. Language selection is a saved preference. SMTP and Cloudinary have service/configuration boundaries as described above; no external provider is falsely presented as active. Expense payment status is represented by the group ledger and recorded settlements, rather than an invented per-receipt paid/unpaid allocation.

## Interface language

Choose English or Roman Urdu in the signed-in top bar or Profile. Core navigation, buttons and form labels use an explicit translation dictionary. The account preference persists across login; a browser preference mirrors it for initial rendering. User-entered names, notes and destinations are preserved. Detailed help, some advanced descriptions and server errors currently remain English.
