# Parkr

<p align="center">
  <img src="public/assets/images/logo/parkr-logo-orange.svg" alt="Parkr logo" width="160">
</p>

Parkr is a smart parking slot sharing marketplace for drivers, parking owners, and administrators. It provides a static web frontend, a Node.js/Express API, optional Firebase integration, a local JSON fallback database, simulated payments, and booking email notifications.

## Features

- Driver workspace for parking search, map-based slot browsing, bookings, payment flow, booking history, and profile updates.
- Owner workspace for adding parking slots, uploading slot photos, managing listed slots, viewing reservations, and tracking earnings.
- Admin workspace for user management, parking slot approval or rejection, booking monitoring, and platform reports.
- Role-based navigation for driver, owner, and admin pages.
- Interactive maps on the driver page using Leaflet and OpenStreetMap.
- Optional Firebase Authentication, Cloud Firestore, and Firebase Storage integration.
- Express API fallback backed by `backend/data/db.json`.
- Local browser storage fallback for offline-friendly development.
- Simulated payment gateway with UPI QR data and test-card metadata.
- Booking confirmation email support through Nodemailer.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Storage | Firebase Firestore, Firebase Storage, local JSON, browser localStorage |
| Authentication | Firebase Authentication with local fallback |
| Maps | Leaflet, OpenStreetMap |
| Email | Nodemailer |
| Deployment config | Firebase Hosting, Vercel |

## Project Structure

```text
Parkr/
|-- backend/
|   |-- data/
|   |   |-- db.js
|   |   `-- db.json
|   |-- routes/
|   |   |-- auth.js
|   |   |-- bookings.js
|   |   |-- payments.js
|   |   |-- reports.js
|   |   `-- slots.js
|   |-- services/
|   |   `-- notificationService.js
|   `-- server.js
|-- firebase/
|   `-- firebase-config.js
|-- public/
|   |-- admin.html
|   |-- driver.html
|   |-- index.html
|   |-- login.html
|   |-- owner.html
|   |-- register.html
|   `-- assets/
|-- .env.example
|-- firebase.json
|-- firestore.rules
|-- package.json
`-- vercel.json
```

## Prerequisites

- Node.js 18 or newer
- npm
- A Firebase project, only if you want cloud auth/database/storage

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

3. Add Firebase values to `.env` if you want Firebase-backed auth and data sync.

4. Start the app:

```bash
npm start
```

The app runs at:

```text
http://127.0.0.1:5500/
```

The health check is available at:

```text
http://127.0.0.1:5500/api/health
```

## Environment Variables

The Express server reads `.env` from the project root.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Server port. Defaults to `5500`. |
| `PARKR_FIREBASE_API_KEY` | No | Firebase web API key. |
| `PARKR_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain. |
| `PARKR_FIREBASE_PROJECT_ID` | No | Firebase project ID. |
| `PARKR_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket. |
| `PARKR_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID. |
| `PARKR_FIREBASE_APP_ID` | No | Firebase app ID. |
| `SMTP_HOST` | No | SMTP host for booking emails. |
| `SMTP_PORT` | No | SMTP port. Defaults to `587`. |
| `SMTP_SECURE` | No | Set to `true` for secure SMTP. |
| `SMTP_USER` | No | SMTP username. |
| `SMTP_PASS` | No | SMTP password. |

If SMTP values are not provided, the notification service attempts to use an Ethereal test email account. If that fails, it logs a simulated email instead.

## Application Pages

| Page | Purpose |
| --- | --- |
| `/index.html` | Landing page and parking search entry point |
| `/register.html` | Register as driver, owner, or admin |
| `/login.html` | Login and route to the selected role workspace |
| `/driver.html` | Driver dashboard, search, map, details, booking, history, profile |
| `/owner.html` | Owner dashboard, add slot, manage slots, bookings, profile |
| `/admin.html` | Admin dashboard, users, slot verification, bookings, reports |

## Data Flow

Parkr can run in three layers:

1. Firebase is used when the Firebase config is valid and Firebase services are reachable.
2. The Express API stores records in `backend/data/db.json` for local persistence.
3. Browser `localStorage` is used as a fast fallback and local cache.

The server also exposes `/firebase/firebase-config.js`, which generates Firebase config from `.env` values at runtime. This is the preferred path when running through Express.

## API Reference

Base URL:

```text
http://127.0.0.1:5500/api
```

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns backend status, service name, timestamp, and uptime |

### Auth and Users

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/auth/users` | List users |
| `GET` | `/auth/lookup?email=<email>` | Find a user's role by email |
| `POST` | `/auth/register` | Register a user |
| `POST` | `/auth/login` | Login a user from the local JSON store |
| `PATCH` | `/auth/users/:id/status` | Update user status |
| `DELETE` | `/auth/users/:id` | Delete a user |

### Parking Slots

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/slots` | List slots |
| `GET` | `/slots/:id` | Get one slot |
| `POST` | `/slots` | Create a slot |
| `PUT` | `/slots/:id` | Update a slot |
| `PATCH` | `/slots/:id/status` | Approve, reject, or change slot status |
| `DELETE` | `/slots/:id` | Delete a slot |

Supported slot query parameters include `location`, `vehicle`, `maxPrice`, `adminOnly`, `ownerId`, and `publicOnly`.

### Bookings

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/bookings` | List bookings |
| `POST` | `/bookings` | Create a booking and reduce available slot count |
| `PATCH` | `/bookings/:id/status` | Update booking status |

Supported booking query parameters include `driverId` and `ownerId`.

### Payments

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/payments/create-order` | Create a simulated payment order |
| `POST` | `/payments/verify` | Mark a payment as paid and update the matching booking |
| `GET` | `/payments` | List payments |

### Reports

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/reports` | Return counts for users, slots, bookings, revenue, pending slots, approved slots, and paid bookings |

## Firebase Setup

1. Create a Firebase project.
2. Enable Authentication with email/password sign-in.
3. Create a Cloud Firestore database.
4. Enable Firebase Storage if you want cloud photo uploads.
5. Copy your Firebase web app config into `.env`.
6. Apply `firestore.rules` if you are using this project for development.

The included Firestore rules are permissive for development. Tighten them before using the app with real users or sensitive data.

## Deployment

### Express Deployment

Deploy the Node.js app when you need API routes, runtime Firebase config, JSON persistence, and email notifications.

```bash
npm start
```

The Express server serves the frontend from `public/` and mounts API routes under `/api`.

### Firebase Hosting

`firebase.json` is configured to serve the static frontend from `public/`.

```bash
firebase deploy
```

Static Firebase Hosting will not run the Express API. Use Firebase services or deploy the backend separately if you need server routes.

### Vercel

`vercel.json` contains static asset cache headers. If deploying only the static frontend, make sure Firebase or another backend path is available for persistent shared data.

## Development Notes

- `backend/data/db.json` is the local JSON database used by the Express routes.
- Owner-created slots start as `pending` and become publicly searchable after admin approval.
- Public slot search only returns approved, available slots with at least one open space.
- Booking creation decreases the related slot's available count.
- Cancelling a booking restores one available slot, up to the slot total.
- Payment verification stores a paid payment record and updates the related booking when possible.
- Driver maps depend on the Leaflet CDN, so an internet connection is required for map tiles and the Leaflet runtime.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Express server |
| `npm run dev` | Start the Express server |

## License

This project uses the ISC license as defined in `package.json`.
